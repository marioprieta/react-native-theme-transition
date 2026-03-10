/**
 * Screenshot-overlay transition engine and provider.
 *
 * @remarks
 * View hierarchy: content root → shared-value touch blocker → animated overlay
 * with decoded screenshot `Image`. The overlay is always mounted (no mount-time
 * race with the shared opacity value); only the `Image` inside is conditional.
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
    // State mirror of systemModeRef — drives the Appearance.setColorScheme effect.
    const [isSystemMode, setIsSystemMode] = useState(initialTheme === 'system');
    const appStateRef = useRef(AppState.currentState);
    // Pending OS scheme change that arrived mid-transition. Applied by finishTransition.
    const pendingSchemeRef = useRef<'light' | 'dark' | null>(null);
    // Last observed OS scheme — lets manual→system resolve without calling
    // setColorScheme('unspecified') (which flashes the Android status bar).
    const lastKnownOsSchemeRef = useRef<'light' | 'dark'>(
      normalizeScheme(Appearance.getColorScheme()),
    );
    // Manual override scheme while a deferred setColorScheme('unspecified') is pending.
    // finishTransition uses this to correct the theme if the OS scheme diverged.
    const deferredSystemRestoreRef = useRef<'light' | 'dark' | null>(null);

    // SharedValue (not state) so touch blocking takes effect on the native thread
    // within one frame, without waiting for a React re-render cycle.
    const isBlocking = useSharedValue(false);
    const blockerProps = useAnimatedProps(() => ({
      pointerEvents: isBlocking.value ? 'auto' as const : 'none' as const,
    }));

    // State (not ref) so unsetting it unmounts the Image, freeing the captured bitmap.
    const [overlayUri, setOverlayUri] = useState<string | null>(null);
    const overlayOpacity = useSharedValue(0);
    // Stable ref so Reanimated doesn't re-process the style on every render.
    const overlayStyle = useMemo(() => ({ opacity: overlayOpacity }), [overlayOpacity]);
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

    // Sync native UI (alerts, keyboards) with theme. Skipped in system mode
    // where the OS drives appearance via 'unspecified'.
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

    const runTransition = useCallback(async (initialName: Names, options?: SetThemeOptions<Names>) => {
      let name: Names = initialName;
      try {
        // 2 frames for JS → Shadow Tree → Native UI to paint before capture.
        // useTheme's requestAnimationFrame adds a 3rd — enough for 120Hz.
        await waitFrames(2);
        if (!mountedRef.current) return;

        // jpg 0.8: ~30% smaller than png, no visible degradation during a cross-fade.
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

        // Deferred: setting this earlier would re-render under the overlay,
        // flashing state-dependent visuals before the screenshot hides them.
        setIsTransitioning(true);

        setActiveTheme({ colors: getColors(name), name });

        // Deferred setColorScheme('unspecified') — done now while the overlay is
        // opaque so any theme correction (OS scheme diverged) is invisible to the user.
        if (deferredSystemRestoreRef.current !== null) {
          const manualScheme = deferredSystemRestoreRef.current;

          let resolved = false;
          const realScheme = await new Promise<'light' | 'dark'>((resolve) => {
            const sub = Appearance.addChangeListener(({ colorScheme }) => {
              if (resolved) return;
              resolved = true;
              sub.remove();
              resolve(normalizeScheme(colorScheme));
            });
            Appearance.setColorScheme('unspecified');
            // No event → OS scheme already matches the manual override.
            requestAnimationFrame(() => {
              if (resolved) return;
              resolved = true;
              sub.remove();
              resolve(manualScheme);
            });
          });
          if (!mountedRef.current) return;

          deferredSystemRestoreRef.current = null;
          lastKnownOsSchemeRef.current = realScheme;

          const corrected = mapSchemeToTheme<Names>(realScheme, systemThemeMap);
          if (corrected in themes && corrected !== name) {
            name = corrected as Names;
            targetThemeRef.current = corrected;
            setActiveTheme({ colors: getColors(corrected), name: corrected });
          }
        }

        await waitFrames(1);
        if (!mountedRef.current) return;

        const finishTransition = () => {
          if (!mountedRef.current) return;
          resetTransition();
          safeCall('config onTransitionEnd', configOnTransitionEnd, name);
          safeCall('per-call onTransitionEnd', options?.onTransitionEnd, name);
          safeCall('config onThemeChange', onThemeChange, name);

          // Apply any OS scheme change that arrived mid-transition.
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
      // Manual→system: resolve from cached OS scheme to avoid the Android
      // status bar flash that setColorScheme('unspecified') causes pre-overlay.
      if (name === 'system' && !systemModeRef.current) {
        if (transitioningRef.current) return false;

        setIsSystemMode(true);
        systemModeRef.current = true;
        deferredSystemRestoreRef.current = schemeOf(targetThemeRef.current);
        return setTheme('system', options);
      }

      const resolvedTheme = name === 'system'
        ? mapSchemeToTheme<Names>(lastKnownOsSchemeRef.current, systemThemeMap)
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

      // After transition guard — a rejected call must not activate system mode.
      const wasSystemMode = systemModeRef.current;
      systemModeRef.current = name === 'system';

      if (systemModeRef.current !== wasSystemMode) {
        setIsSystemMode(systemModeRef.current);
      }

      if (resolvedTheme === targetThemeRef.current) {
        // Manual↔system mode switch is valid even when the resolved theme matches —
        // returning true prevents select() from reverting the user's selection.
        return wasSystemMode !== systemModeRef.current;
      }

      targetThemeRef.current = resolvedTheme;

      if (options?.animated === false) {
        setActiveTheme({ colors: getColors(resolvedTheme), name: resolvedTheme });
        safeCall('config onThemeChange', onThemeChange, resolvedTheme);
        return true;
      }

      // Block before user callbacks to prevent re-entrant setTheme.
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
      runTransition(resolvedTheme, options).catch(() => {});
      return true;
    }, [isBlocking, resetTransition, runTransition]);

    useEffect(() => {
      const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
        if (!systemModeRef.current) return;
        lastKnownOsSchemeRef.current = normalizeScheme(colorScheme);
        // Deferred restore listener in runTransition handles these.
        if (deferredSystemRestoreRef.current !== null) return;
        if (transitioningRef.current) {
          pendingSchemeRef.current = normalizeScheme(colorScheme);
          return;
        }
        if (appStateRef.current === 'active') {
          setTheme('system');
        } else {
          // Background: apply directly. iOS may defer — AppState handler re-applies on foreground.
          const resolved = mapSchemeToTheme<Names>(normalizeScheme(colorScheme), systemThemeMap);
          if (!(resolved in themes) || resolved === targetThemeRef.current) return;
          targetThemeRef.current = resolved;
          setActiveTheme({ colors: getColors(resolved), name: resolved });
          safeCall('config onThemeChange', onThemeChange, resolved);
        }
      });

      // Re-read OS scheme on foreground return — iOS may not deliver
      // Appearance events while suspended, or may defer the React commit.
      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active' && systemModeRef.current) {
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
        {/* collapsable={false}: Android flattens views by default, breaking captureRef. */}
        <View ref={rootRef} style={ROOT_STYLE} collapsable={false}>
          {children}
          <Animated.View style={ABSOLUTE_FILL} animatedProps={blockerProps} />
          {/* Always mounted — avoids shared-value race on conditional mount. */}
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
