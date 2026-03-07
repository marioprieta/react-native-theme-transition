/**
 * Screenshot-overlay provider and context factory.
 *
 * @module
 */

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, AppState, Image, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  ThemeTransitionConfig,
  ThemeTransitionContextValue,
  SetThemeOptions,
  SystemThemeMap,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
// Avoids layout clipping on certain Android API levels.
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
 * Waiting 1 frame lets React flush pending state; waiting 3 frames
 * gives the shadow tree and native UI thread time to repaint, even on
 * slower devices or complex layouts.
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
 * Returns the current OS color scheme, defaulting to `'light'` when unavailable.
 *
 * @remarks
 * Only accepts the two known values. Any other input — including `null`,
 * `undefined`, and `'unspecified'` (returned by RN after
 * `Appearance.setColorScheme('unspecified')`) — defaults to `'light'`.
 *
 * @internal
 */
function getScheme(colorScheme?: string | null): 'light' | 'dark' {
  if (colorScheme === 'dark') return 'dark';
  return 'light';
}

/**
 * Maps an OS color scheme to a theme name.
 *
 * @remarks
 * The fallback `scheme as Names` is only safe when the themes are named `'light'` and
 * `'dark'`. Callers that use custom theme names must validate the result against `themes` —
 * both `ThemeTransitionProvider` (for `initialTheme="system"`) and `setTheme`
 * (for `setTheme('system')`) perform this validation and throw a clear error if the
 * resolved name is not a registered theme.
 *
 * @internal
 */
function resolveScheme<Names extends string>(
  scheme: 'light' | 'dark',
  mapping?: SystemThemeMap<Names>,
): Names {
  return mapping?.[scheme] ?? (scheme as Names);
}

/**
 * Creates the React Context and provider component for a given theme configuration.
 *
 * @internal Used by {@link createThemeTransition}; not part of the public API.
 */
export function createProviderAndContext<
  T extends Record<string, ThemeDefinition>,
>(config: ThemeTransitionConfig<T>) {
  const {
    themes, duration = 350, systemThemeMap,
    onTransitionStart: configOnTransitionStart,
    onTransitionEnd: configOnTransitionEnd,
    onThemeChange,
  } = config;

  type Names = ThemeNames<T>;
  type Tokens = TokenNames<T>;

  const Context = createContext<ThemeTransitionContextValue<Tokens, Names> | null>(null);

  function getColors(name: Names): Record<Tokens, string> {
    return { ...themes[name] } as Record<Tokens, string>;
  }

  function ThemeTransitionProvider({
    children,
    initialTheme,
  }: {
    children: React.ReactNode;
    initialTheme: Names | 'system';
  }) {
    // Initialization runs only once (lazy useState), keeping every subsequent render clean.
    const [resolved, setResolved] = useState<{ colors: Record<Tokens, string>; name: Names }>(() => {
      const isInitialSystem = initialTheme === 'system';
      const startScheme = getScheme(Appearance.getColorScheme());
      const startTheme = isInitialSystem
        ? resolveScheme<Names>(startScheme, systemThemeMap)
        : initialTheme;

      if (!(startTheme in themes)) {
        throw new Error(
          `[react-native-theme-transition] initialTheme resolved to "${startTheme}" which does not exist in themes.${
            isInitialSystem ? ' Provide `systemThemeMap` in the config to map OS appearance to your theme names.' : ''
          }`,
        );
      }

      return { colors: getColors(startTheme), name: startTheme };
    });

    const targetRef = useRef(resolved.name);
    const rootRef = useRef<View>(null);
    const transitioningRef = useRef(false);
    // Guards async callbacks against running after unmount.
    const mountedRef = useRef(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Tracks whether the provider is in system-following mode.
    const systemModeRef = useRef(initialTheme === 'system');

    // Blocks touches within one native frame, without waiting for a React re-render.
    const isBlocking = useSharedValue(false);
    const blockerProps = useAnimatedProps(() => ({
      pointerEvents: isBlocking.value ? 'auto' as const : 'none' as const,
    }));

    // State (not ref) so unsetting it unmounts the Image, freeing the captured bitmap.
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const overlayOpacity = useSharedValue(0);
    const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.get() }));

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    const resetTransition = useCallback(() => {
      transitioningRef.current = false;
      isBlocking.value = false;
      setIsTransitioning(false);
      setOverlayUri(null);
    }, [isBlocking]);

    const transition = useCallback(async (name: Names, options?: SetThemeOptions<Names>) => {
      try {
        // Pending React state must commit before capture to avoid stale screenshots.
        await waitFrames(1);
        if (!mountedRef.current) return;

        const uri = await captureRef(rootRef, { format: 'jpg', quality: 0.8 });
        if (!mountedRef.current) return;

        overlayOpacity.set(1);
        setOverlayUri(uri);

        // Separate React commits: the overlay must mount and paint before the
        // color switch. Without this yield, both state updates batch into one
        // commit and Android can paint the new colors before the overlay is visible.
        await waitFrames(1);
        if (!mountedRef.current) return;

        setResolved({ colors: getColors(name), name });

        // Wait for the native UI thread to repaint the new theme beneath the overlay.
        await waitFrames(3);
        if (!mountedRef.current) return;

        const finishTransition = () => {
          if (!mountedRef.current) return;
          resetTransition();
          try { configOnTransitionEnd?.(name); } catch (e) { console.warn('[react-native-theme-transition] config onTransitionEnd threw:', e); }
          try { options?.onTransitionEnd?.(name); } catch (e) { console.warn('[react-native-theme-transition] per-call onTransitionEnd threw:', e); }
          try { onThemeChange?.(name); } catch (e) { console.warn('[react-native-theme-transition] config onThemeChange threw:', e); }
        };

        overlayOpacity.set(withTiming(0, { duration }, () => {
          'worklet';
          scheduleOnRN(finishTransition);
        }));
      } catch (error) {
        // If capture fails, apply theme instantly — no animation beats a stuck overlay.
        console.warn(
          '[react-native-theme-transition] Failed to capture screenshot. Falling back to instant theme switch.',
          error,
        );
        if (!mountedRef.current) return;
        setResolved({ colors: getColors(name), name });
        resetTransition();
        try { onThemeChange?.(name); } catch (e) { console.warn('[react-native-theme-transition] config onThemeChange threw:', e); }
      }
    }, [overlayOpacity, resetTransition]);

    const setTheme = useCallback((name: Names | 'system', options?: SetThemeOptions<Names>) => {
      const resolvedTheme = name === 'system'
        ? resolveScheme<Names>(getScheme(Appearance.getColorScheme()), systemThemeMap)
        : name;

      // Guard: setTheme('system') with custom theme names and no systemThemeMap falls back
      // to 'light'/'dark' which may not be registered themes. Fail loudly instead of
      // silently producing undefined color tokens.
      if (!(resolvedTheme in themes)) {
        throw new Error(
          `[react-native-theme-transition] setTheme('system') resolved to "${resolvedTheme}" which does not exist in themes. ` +
          `Provide \`systemThemeMap\` in the config to map OS appearance to your theme names.`,
        );
      }

      if (transitioningRef.current) return;

      // Set system mode AFTER the transition guard so a rejected call during an ongoing
      // transition doesn't silently activate system-following mode.
      systemModeRef.current = name === 'system';

      if (resolvedTheme === targetRef.current) return;

      targetRef.current = resolvedTheme;

      if (options?.animated === false) {
        setResolved({ colors: getColors(resolvedTheme), name: resolvedTheme });
        try { onThemeChange?.(resolvedTheme); } catch (e) { console.warn('[react-native-theme-transition] config onThemeChange threw:', e); }
        return;
      }

      // Block touches and mark as transitioning BEFORE firing user callbacks to prevent
      // re-entrant setTheme calls from starting a concurrent transition.
      transitioningRef.current = true;
      isBlocking.value = true;

      try {
        configOnTransitionStart?.(resolvedTheme);
        options?.onTransitionStart?.(resolvedTheme);
      } catch (e) {
        // Reset guards so a callback error doesn't permanently block transitions.
        resetTransition();
        throw e;
      }
      setIsTransitioning(true);
      transition(resolvedTheme, options);
    }, [isBlocking, resetTransition, transition]);

    const appStateRef = useRef(AppState.currentState);

    useEffect(() => {
      const appearanceSub = Appearance.addChangeListener(() => {
        if (!systemModeRef.current) return;
        if (appStateRef.current === 'active') {
          setTheme('system');
        } else {
          // Instant while backgrounded so React state matches the iOS snapshot.
          setTheme('system', { animated: false });
        }
      });

      // iOS can deliver a stale scheme during snapshot capture; re-read on foreground.
      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active' && systemModeRef.current) {
          setTheme('system', { animated: false });
        }
        appStateRef.current = next;
      });

      return () => {
        appearanceSub.remove();
        appSub.remove();
      };
    }, [setTheme]);

    const value = useMemo(() => ({
      colors: resolved.colors, name: resolved.name, setTheme, isTransitioning,
    }), [resolved, setTheme, isTransitioning]);

    return (
      <Context.Provider value={value}>
        {/* collapsable={false} prevents Android from flattening the view, which breaks captureRef. */}
        <View ref={rootRef} style={ROOT_STYLE} collapsable={false}>
          {children}
          <Animated.View style={FILL} animatedProps={blockerProps} />
          {overlayUri != null ? (
            <Animated.View style={[FILL, overlayStyle]} pointerEvents="none">
              <Image source={{ uri: overlayUri }} style={FILL} resizeMode="cover" fadeDuration={0} />
            </Animated.View>
          ) : null}
        </View>
      </Context.Provider>
    );
  }

  return { Context, ThemeTransitionProvider };
}
