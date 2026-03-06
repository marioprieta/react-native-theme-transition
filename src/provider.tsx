/**
 * Screenshot-overlay provider and context factory.
 *
 * @remarks
 * The provider renders three layers inside a single root `<View>`:
 * 1. **Children** — the app's live component tree.
 * 2. **Gesture blocker** — an invisible overlay that intercepts touches
 *    during transitions so users can't interact with partially-painted UI.
 * 3. **Snapshot overlay** — an `<Animated.View>` containing the captured
 *    screenshot, faded from opaque to transparent via Reanimated.
 *
 * @module
 */

import { createContext, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import type {
  AnimatedThemeConfig,
  AnimatedThemeContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';

// flex: 1 instead of height: '100%' — avoids layout clipping on certain Android API levels.
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
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

/** @internal */
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
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Blocks scroll and touches during the overlay fade without UI-thread coordination.
    const blockGesture = Gesture.Pan();

    // State (not ref) so unsetting it unmounts the Image, freeing the captured bitmap.
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const overlayOpacity = useSharedValue(0);
    const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.get() }));

    useEffect(() => {
      return () => {
        mountedRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    async function transition(name: Names, onCaptured?: () => void) {
      try {
        // Let pending state flush through React reconciliation before capturing.
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

        overlayOpacity.set(withTiming(0, { duration }));
        timeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setOverlayUri(null);
          transitioningRef.current = false;
    
          setIsTransitioning(false);
          onTransitionEnd?.(name);
        }, duration);
      } catch {
        // If capture fails, apply theme instantly — no animation beats a stuck overlay.
        if (!mountedRef.current) return;
        setResolved({ colors: { ...themes[name] } as Record<Tokens, string>, name });
        onCaptured?.();
        transitioningRef.current = false;
  
        setIsTransitioning(false);
      }
    }

    function setTheme(name: Names, options?: { onCaptured?: () => void }) {
      if (name === targetRef.current) {
        options?.onCaptured?.();
        return;
      }
      if (transitioningRef.current) return;

      targetRef.current = name;
      transitioningRef.current = true;

      setIsTransitioning(true);
      transition(name, options?.onCaptured);
    }

    const value = { colors: resolved.colors, name: resolved.name, setTheme, isTransitioning };

    return (
      <Context.Provider value={value}>
        {/* Required on Android — RN flattens view nodes by default, which breaks captureRef targeting. */}
        <View ref={rootRef} style={ROOT_STYLE} collapsable={false}>
          {children}
          <GestureDetector gesture={blockGesture}>
            {/* JS-driven pointer blocking for consistent cross-platform behavior. */}
            <View style={FILL} pointerEvents={isTransitioning ? 'auto' : 'none'} />
          </GestureDetector>
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
