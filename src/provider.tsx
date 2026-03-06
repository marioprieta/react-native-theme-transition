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
 * Returns the current OS color scheme, defaulting to `'light'` when unavailable.
 *
 * @internal
 */
function getScheme(colorScheme?: string | null): 'light' | 'dark' {
  return (colorScheme ?? 'light') as 'light' | 'dark';
}

/**
 * Maps an OS color scheme to a theme name.
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

    const [resolved, setResolved] = useState(() => ({
      colors: getColors(startTheme),
      name: startTheme,
    }));

    const targetRef = useRef(startTheme);
    const rootRef = useRef<View>(null);
    const transitioningRef = useRef(false);
    // Guards async callbacks against running after unmount.
    const mountedRef = useRef(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Tracks whether the provider is in system-following mode.
    const systemModeRef = useRef(isInitialSystem);

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

        const uri = await captureRef(rootRef, { format: 'png', quality: 0.9 });
        if (!mountedRef.current) return;

        overlayOpacity.set(1);
        setOverlayUri(uri);
        setResolved({ colors: getColors(name), name });

        // Wait for the native UI thread to repaint the new theme beneath the overlay.
        await waitFrames(2);
        if (!mountedRef.current) return;

        const finishTransition = () => {
          if (!mountedRef.current) return;
          resetTransition();
          configOnTransitionEnd?.(name);
          options?.onTransitionEnd?.(name);
          onThemeChange?.(name);
        };

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
        setResolved({ colors: getColors(name), name });
        resetTransition();
        onThemeChange?.(name);
      }
    }, [isBlocking, overlayOpacity, resetTransition]);

    const setTheme = useCallback((name: Names | 'system', options?: SetThemeOptions<Names>) => {
      const resolved = name === 'system'
        ? resolveScheme<Names>(getScheme(Appearance.getColorScheme()), systemThemeMap)
        : name;

      if (name === 'system') {
        systemModeRef.current = true;
      } else {
        systemModeRef.current = false;
      }

      if (resolved === targetRef.current) return;
      if (transitioningRef.current) return;

      targetRef.current = resolved;

      if (options?.animated === false) {
        setResolved({ colors: getColors(resolved), name: resolved });
        onThemeChange?.(resolved);
        return;
      }

      configOnTransitionStart?.(resolved);
      options?.onTransitionStart?.(resolved);
      transitioningRef.current = true;
      isBlocking.value = true;

      setIsTransitioning(true);
      transition(resolved, options);
    }, [isBlocking, transition]);

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
