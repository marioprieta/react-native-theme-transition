/**
 * Screenshot-overlay transition engine and provider.
 *
 * @module
 */

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, AppState, Image, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  ThemeTransitionConfig,
  UseThemeResult,
  SetThemeOptions,
  SystemThemeMap,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';
import { TAG } from './constants';

const ABSOLUTE_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
// Avoids layout clipping on certain Android API levels.
const ROOT_STYLE = { flex: 1 } as const;

/** Calls `fn` and swallows errors with a console.warn tagged by `label`. */
function safeCall<A extends unknown[]>(label: string, fn: ((...args: A) => void) | undefined, ...args: A): void {
  try { fn?.(...args); } catch (e) { console.warn(`${TAG} ${label} threw:`, e); }
}

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
 * Waiting 1 frame lets React flush pending state or the compositor
 * paint a decoded image.
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
 * Normalizes an OS color scheme string to `'light'` or `'dark'`.
 *
 * @remarks
 * Only accepts the two known values. Any other input — including `null`,
 * `undefined`, and `'unspecified'` (returned by RN after
 * `Appearance.setColorScheme('unspecified')`) — defaults to `'light'`.
 *
 * @internal
 */
function normalizeScheme(colorScheme?: string | null, fallback: 'light' | 'dark' = 'light'): 'light' | 'dark' {
  if (colorScheme === 'dark') return 'dark';
  if (colorScheme === 'light') return 'light';
  return fallback;
}

/**
 * Maps an OS color scheme to a theme name via `systemThemeMap`.
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
function mapSchemeToTheme<Names extends string>(
  scheme: 'light' | 'dark',
  mapping?: SystemThemeMap<Names>,
): Names {
  return mapping?.[scheme] ?? (scheme as Names);
}

/**
 * Reads the current OS appearance and maps it to a theme name.
 *
 * @internal Convenience wrapper combining {@link normalizeScheme} and {@link mapSchemeToTheme}.
 */
function resolveSystemTheme<Names extends string>(
  mapping?: SystemThemeMap<Names>,
  fallbackScheme?: 'light' | 'dark',
): Names {
  return mapSchemeToTheme<Names>(normalizeScheme(Appearance.getColorScheme(), fallbackScheme), mapping);
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
    themes, duration = 350, systemThemeMap, darkThemes: darkThemesConfig,
    onTransitionStart: configOnTransitionStart,
    onTransitionEnd: configOnTransitionEnd,
    onThemeChange,
  } = config;

  const darkThemeSet = new Set<string>(
    darkThemesConfig ?? (systemThemeMap ? [systemThemeMap.dark] : ['dark']),
  );

  const schemeOf = (name: string): 'light' | 'dark' => darkThemeSet.has(name) ? 'dark' : 'light';

  type Names = ThemeNames<T>;
  type Tokens = TokenNames<T>;

  const Context = createContext<UseThemeResult<Tokens, Names> | null>(null);

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
    const [activeTheme, setActiveTheme] = useState<{ colors: Record<Tokens, string>; name: Names }>(() => {
      const isInitialSystem = initialTheme === 'system';
      const startTheme = isInitialSystem
        ? resolveSystemTheme<Names>(systemThemeMap)
        : initialTheme;

      if (!(startTheme in themes)) {
        throw new Error(
          `${TAG} initialTheme resolved to "${startTheme}" which does not exist in themes.${
            isInitialSystem ? ' Provide `systemThemeMap` in the config to map OS appearance to your theme names.' : ''
          }`,
        );
      }

      return { colors: getColors(startTheme), name: startTheme };
    });

    const targetThemeRef = useRef(activeTheme.name);
    const rootRef = useRef<View>(null);
    const transitioningRef = useRef(false);
    // Guards async callbacks against running after unmount.
    const mountedRef = useRef(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const systemModeRef = useRef(initialTheme === 'system');
    // State mirror of systemModeRef — triggers the Appearance.setColorScheme effect.
    const [isSystemMode, setIsSystemMode] = useState(initialTheme === 'system');
    const appStateRef = useRef(AppState.currentState);
    // Stores a pending OS scheme change that arrived while a transition was
    // running (and setTheme was rejected). Read by finishTransition.
    const pendingSchemeRef = useRef<'light' | 'dark' | null>(null);

    // Blocks touches within one native frame, without waiting for a React re-render.
    const isBlocking = useSharedValue(false);
    const blockerProps = useAnimatedProps(() => ({
      pointerEvents: isBlocking.value ? 'auto' as const : 'none' as const,
    }));

    // State (not ref) so unsetting it unmounts the Image, freeing the captured bitmap.
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const overlayOpacity = useSharedValue(0);
    // Stable reference prevents Reanimated from re-processing the style on React re-renders.
    const overlayStyle = useMemo(() => ({ opacity: overlayOpacity }), [overlayOpacity]);
    // Settled when the overlay Image fires onLoad (resolve) or onError (reject).
    const overlayDecodeRef = useRef<{ resolve: () => void; reject: () => void } | null>(null);
    const overlaySource = useMemo(() => overlayUri ? { uri: overlayUri } : undefined, [overlayUri]);
    const onOverlayLoad = useCallback(() => {
      overlayDecodeRef.current?.resolve();
    }, []);
    const onOverlayError = useCallback(() => {
      overlayDecodeRef.current?.reject();
    }, []);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    // Keep native UI elements (alerts, date pickers, keyboards) in sync.
    // Only applies in manual mode — in system mode the OS drives native UI
    // via 'unspecified' (set once by setTheme when entering system mode).
    useEffect(() => {
      if (isSystemMode) return;
      if (isTransitioning) return;
      Appearance.setColorScheme(schemeOf(activeTheme.name));
    }, [isSystemMode, activeTheme.name, isTransitioning]);

    const resetTransition = useCallback(() => {
      transitioningRef.current = false;
      isBlocking.value = false;
      setIsTransitioning(false);
      setOverlayUri(null);
    }, [isBlocking]);

    const runTransition = useCallback(async (name: Names, options?: SetThemeOptions<Names>) => {
      try {
        // Two frames so the JS → Shadow Tree → Native UI pipeline fully paints
        // any pending state changes before the screenshot. useTheme({ initialSelection })
        // adds its own requestAnimationFrame before calling setTheme, giving 3
        // total frames — enough for React commit + native paint on 120Hz displays.
        await waitFrames(2);
        if (!mountedRef.current) return;

        const uri = await captureRef(rootRef, { format: 'jpg', quality: 0.8 });
        if (!mountedRef.current) return;

        overlayOpacity.set(1);

        await new Promise<void>((resolve, reject) => {
          overlayDecodeRef.current = { resolve, reject };
          setOverlayUri(uri);
        });
        if (!mountedRef.current) return;

        await waitFrames(1);
        if (!mountedRef.current) return;

        // Deferred until the overlay covers the screen so the re-render
        // doesn't flash state-dependent visuals before the screenshot hides them.
        setIsTransitioning(true);

        setActiveTheme({ colors: getColors(name), name });

        // Wait for React to commit the new theme under the still-opaque overlay.
        await waitFrames(1);
        if (!mountedRef.current) return;

        const finishTransition = () => {
          if (!mountedRef.current) return;
          resetTransition();
          safeCall('config onTransitionEnd', configOnTransitionEnd, name);
          safeCall('per-call onTransitionEnd', options?.onTransitionEnd, name);
          safeCall('config onThemeChange', onThemeChange, name);

          // Reconcile: if the OS appearance changed while the transition was
          // running (stored in pendingSchemeRef by the listener), apply it now.
          if (systemModeRef.current && pendingSchemeRef.current !== null) {
            const resolved = mapSchemeToTheme<Names>(pendingSchemeRef.current, systemThemeMap);
            pendingSchemeRef.current = null;
            if (resolved in themes && resolved !== name) {
              targetThemeRef.current = resolved;
              setActiveTheme({ colors: getColors(resolved), name: resolved });
              safeCall('config onThemeChange', onThemeChange, resolved);
            }
          }
        };

        overlayOpacity.set(withTiming(0, { duration }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(finishTransition);
        }));
      } catch (error) {
        // If capture fails, apply theme instantly — no animation beats a stuck overlay.
        console.warn(
          `${TAG} Failed to capture screenshot. Falling back to instant theme switch.`,
          error,
        );
        if (!mountedRef.current) return;
        setActiveTheme({ colors: getColors(name), name });
        overlayOpacity.set(0);
        resetTransition();
        safeCall('config onThemeChange', onThemeChange, name);
      }
    }, [overlayOpacity, resetTransition]);

    const setTheme = useCallback((name: Names | 'system', options?: SetThemeOptions<Names>): boolean => {
      // When transitioning from manual to system mode, Android's getColorScheme()
      // returns stale values synchronously after setColorScheme('unspecified').
      // Clear the override and defer resolution by one frame so native settles.
      if (name === 'system' && !systemModeRef.current) {
        if (transitioningRef.current) return false;

        // Don't set systemModeRef yet — while it's false the Appearance
        // listener guard (`!systemModeRef.current`) naturally ignores
        // stale events Android fires after setColorScheme('unspecified').
        setIsSystemMode(true);
        Appearance.setColorScheme('unspecified');

        requestAnimationFrame(() => {
          if (!mountedRef.current) return;
          systemModeRef.current = true;
          setTheme('system', options);
        });
        return true;
      }

      const resolvedTheme = name === 'system'
        // When Android returns 'unspecified' (override matched OS, no config change),
        // infer the OS scheme from the current theme's darkness classification.
        ? resolveSystemTheme<Names>(systemThemeMap, schemeOf(targetThemeRef.current))
        : name;

      if (!(resolvedTheme in themes)) {
        const resolutionHint = name === 'system'
          ? ' Provide `systemThemeMap` in the config to map OS appearance to your theme names.'
          : '';
        throw new Error(
          `${TAG} setTheme("${name}") resolved to "${resolvedTheme}" which does not exist in themes.${resolutionHint}`,
        );
      }

      if (transitioningRef.current) return false;

      // Set system mode AFTER the transition guard so a rejected call during an ongoing
      // transition doesn't silently activate system-following mode.
      const wasSystemMode = systemModeRef.current;
      systemModeRef.current = name === 'system';

      // Sync state so the Appearance.setColorScheme effect re-runs.
      if (systemModeRef.current !== wasSystemMode) {
        setIsSystemMode(systemModeRef.current);
      }

      if (resolvedTheme === targetThemeRef.current) {
        // Switching between manual and system mode is a valid change even when
        // the resolved theme is the same — return true so select() keeps the
        // new selection instead of reverting.
        return wasSystemMode !== systemModeRef.current;
      }

      targetThemeRef.current = resolvedTheme;

      if (options?.animated === false) {
        setActiveTheme({ colors: getColors(resolvedTheme), name: resolvedTheme });
        safeCall('config onThemeChange', onThemeChange, resolvedTheme);
        return true;
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
      // isTransitioning is set inside runTransition(), AFTER captureRef, so no React
      // re-render can alter the native view before the screenshot is taken.
      runTransition(resolvedTheme, options).catch(() => {});
      return true;
    }, [isBlocking, resetTransition, runTransition]);

    useEffect(() => {
      const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
        if (!systemModeRef.current) return;
        if (transitioningRef.current) {
          // Can't start a new transition now; store for reconciliation.
          pendingSchemeRef.current = normalizeScheme(colorScheme);
          return;
        }
        if (appStateRef.current === 'active') {
          setTheme('system');
        } else {
          // Background: apply directly (works on Android where JS keeps running).
          // On iOS the JS thread is suspended so this commit may be deferred —
          // the AppState handler below re-applies on foreground return as a safety net.
          const resolved = mapSchemeToTheme<Names>(normalizeScheme(colorScheme), systemThemeMap);
          if (!(resolved in themes) || resolved === targetThemeRef.current) return;
          targetThemeRef.current = resolved;
          setActiveTheme({ colors: getColors(resolved), name: resolved });
          safeCall('config onThemeChange', onThemeChange, resolved);
        }
      });

      // Re-read OS scheme on foreground return. Catches two cases:
      // 1. iOS never delivered Appearance events while suspended.
      // 2. The BG setActiveTheme commit was deferred by iOS suspension.
      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active' && systemModeRef.current) {
          // Re-read OS scheme and force setActiveTheme. Even if the BG path
          // already set targetThemeRef, iOS may have deferred the React commit.
          // Calling setActiveTheme again guarantees an immediate commit now
          // that the app is active.
          const resolved = resolveSystemTheme<Names>(systemThemeMap, schemeOf(targetThemeRef.current));
          if (resolved in themes) {
            const changed = resolved !== targetThemeRef.current;
            targetThemeRef.current = resolved;
            setActiveTheme({ colors: getColors(resolved), name: resolved });
            if (changed) safeCall('config onThemeChange', onThemeChange, resolved);
          }
        }
        appStateRef.current = next;
      });

      return () => {
        appearanceSub.remove();
        appSub.remove();
      };
    }, [setTheme]);

    const contextValue = useMemo(() => ({
      colors: activeTheme.colors, name: activeTheme.name, setTheme, isTransitioning,
    }), [activeTheme, setTheme, isTransitioning]);

    return (
      <Context.Provider value={contextValue}>
        {/* collapsable={false} prevents Android from flattening the view, which breaks captureRef. */}
        <View ref={rootRef} style={ROOT_STYLE} collapsable={false}>
          {children}
          <Animated.View style={ABSOLUTE_FILL} animatedProps={blockerProps} />
          {/* Always mounted so the shared value is permanently connected — no mount-time race. */}
          <Animated.View style={[ABSOLUTE_FILL, overlayStyle]} pointerEvents="none">
            {overlayUri != null ? (
              <Image source={overlaySource} style={ABSOLUTE_FILL} resizeMode="cover" fadeDuration={0} onLoad={onOverlayLoad} onError={onOverlayError} />
            ) : null}
          </Animated.View>
        </View>
      </Context.Provider>
    );
  }

  return { Context, ThemeTransitionProvider };
}
