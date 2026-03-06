/**
 * Screenshot-overlay provider and context factory.
 *
 * @remarks
 * The provider renders three layers inside a single root `<View>`:
 * 1. **Children** — the app's live component tree.
 * 2. **Touch blocker** — an invisible `Animated.View` whose `pointerEvents`
 *    are driven by a Reanimated shared value, blocking all interaction
 *    within one native frame of `setTheme` being called.
 * 3. **Snapshot overlay** — an `<Animated.View>` containing the captured
 *    screenshot, faded from opaque to transparent via Reanimated.
 *
 * @module
 */

import { createContext, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  AnimatedThemeConfig,
  AnimatedThemeContextValue,
  SetThemeOptions,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
// flex: 1 instead of height: '100%' — avoids layout clipping on certain Android API levels.
const ROOT_STYLE = { flex: 1 } as const;

/**
 * Waits for `n` native animation frames to complete.
 *
 * @remarks
 * React Native's rendering pipeline spans three phases:
 * 1. **JS thread** — React reconciliation produces a virtual tree.
 * 2. **Shadow Tree** — Yoga calculates layout from the virtual tree.
 * 3. **Native UI thread** — platform views are painted on screen.
 *
 * Each phase runs on its own frame cadence (~16.67 ms at 60 fps).
 * Waiting 1 frame lets React flush pending state; waiting 2 frames
 * ensures the native UI thread has repainted the new layout.
 *
 * @param n - Number of animation frames to wait.
 */
function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = n;
    const tick = () => {
      if (--remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Creates the React Context and provider component for a given theme configuration.
 *
 * @internal Used by {@link createAnimatedTheme}; not part of the public API.
 */
export function createProviderAndContext<
  T extends Record<string, ThemeDefinition>,
>(config: AnimatedThemeConfig<T>) {
  const { themes, defaultTheme, duration = 350, onTransitionEnd } = config;

  type Names = ThemeNames<T>;
  type Tokens = TokenNames<T>;

  const Context = createContext<AnimatedThemeContextValue<Tokens, Names> | null>(null);

  function AnimatedThemeProvider({
    children,
    initialTheme,
  }: {
    children: React.ReactNode;
    initialTheme?: Names;
  }) {
    const startTheme = initialTheme ?? defaultTheme;

    const [resolved, setResolved] = useState(() => ({
      colors: { ...themes[startTheme] } as Record<Tokens, string>,
      name: startTheme,
    }));

    const targetRef = useRef(startTheme);
    const rootRef = useRef<View>(null);
    const transitioningRef = useRef(false);
    // Guards async callbacks against running after unmount.
    const mountedRef = useRef(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Drives pointerEvents on the blocker overlay via the UI thread (useAnimatedProps),
    // bypassing React reconciliation so blocking is active within one native frame.
    const isBlocking = useSharedValue(false);
    const blockerProps = useAnimatedProps(() => ({
      pointerEvents: isBlocking.value ? 'auto' as const : 'none' as const,
    }));

    // State (not ref) so unsetting it unmounts the Image, freeing the captured bitmap.
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const overlayOpacity = useSharedValue(0);
    const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.get() }));

    useEffect(() => {
      return () => {
        mountedRef.current = false;
      };
    }, []);

    async function transition(name: Names, onCaptured?: () => void) {
      try {
        // Pending React state (e.g. disabled buttons) must commit before we capture,
        // otherwise the screenshot contains stale UI.
        await waitFrames(1);
        if (!mountedRef.current) return;

        // quality 0.9: reduces base64 payload ~30% vs 1.0, no visible degradation.
        const uri = await captureRef(rootRef, { format: 'png', quality: 0.9 });
        if (!mountedRef.current) return;

        overlayOpacity.set(1);
        setOverlayUri(uri);
        onCaptured?.();
        setResolved({ colors: { ...themes[name] } as Record<Tokens, string>, name });

        // Frame 1: React reconciles new theme to Shadow Tree.
        // Frame 2: Native UI thread repaints. Without both, overlay fades to unpainted layout.
        await waitFrames(2);
        if (!mountedRef.current) return;

        const finishTransition = () => {
          if (!mountedRef.current) return;
          setOverlayUri(null);
          transitioningRef.current = false;
          isBlocking.value = false;
          setIsTransitioning(false);
          onTransitionEnd?.(name);
        };

        // Tied to the animation completion so cleanup happens in the exact frame
        // the fade ends, avoiding drift from JS thread scheduling.
        overlayOpacity.set(withTiming(0, { duration }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(finishTransition);
        }));
      } catch (error) {
        // If capture fails, apply theme instantly — no animation beats a stuck overlay.
        console.warn(
          '[react-native-theme-transition] Failed to capture screenshot. Falling back to instant theme switch.',
          error,
        );
        if (!mountedRef.current) return;
        setResolved({ colors: { ...themes[name] } as Record<Tokens, string>, name });
        transitioningRef.current = false;
        isBlocking.value = false;
        setIsTransitioning(false);
      }
    }

    function setTheme(name: Names, options?: SetThemeOptions) {
      if (name === targetRef.current) return;
      if (transitioningRef.current) return;

      targetRef.current = name;

      // Instant switch — skip screenshot/overlay entirely.
      if (options?.animated === false) {
        setResolved({ colors: { ...themes[name] } as Record<Tokens, string>, name });
        onTransitionEnd?.(name);
        return;
      }

      transitioningRef.current = true;
      isBlocking.value = true;

      setIsTransitioning(true);
      transition(name, options?.onCaptured);
    }

    const value = { colors: resolved.colors, name: resolved.name, setTheme, isTransitioning };

    return (
      <Context.Provider value={value}>
        {/* Required on Android — RN flattens view nodes by default, which breaks captureRef targeting. */}
        <View ref={rootRef} style={ROOT_STYLE} collapsable={false}>
          {children}
          {/* pointerEvents driven by a shared value so blocking activates within one
             native frame, without waiting for a React re-render cycle. */}
          <Animated.View style={FILL} animatedProps={blockerProps} />
          {overlayUri != null ? (
            <Animated.View style={[FILL, overlayStyle]} pointerEvents="none">
              <Image source={{ uri: overlayUri }} style={FILL} resizeMode="cover" />
            </Animated.View>
          ) : null}
        </View>
      </Context.Provider>
    );
  }

  return { Context, AnimatedThemeProvider };
}
