import { useContext, useEffect, useRef } from 'react';
import { Appearance, AppState } from 'react-native';
import type { Context } from 'react';
import type {
  AnimatedThemeContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from '../types';

/**
 * Factory that produces the `useSystemTheme` hook bound to a specific context.
 *
 * @internal Used by {@link createAnimatedTheme}; not part of the public API.
 */
export function createUseSystemTheme<
  T extends Record<string, ThemeDefinition>,
>(
  Ctx: Context<AnimatedThemeContextValue<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Names = ThemeNames<T>;

  return function useSystemTheme(
    enabled?: boolean,
    mapping?: Partial<Record<'light' | 'dark', Names>>,
  ): void {
    const ctx = useContext(Ctx);
    if (!ctx) {
      throw new Error(
        '[react-native-theme-transition] `useSystemTheme` must be used inside an `AnimatedThemeProvider`.',
      );
    }

    const setTheme = ctx.setTheme;
    // Ref avoids re-subscribing when consumers pass inline objects (which fail
    // referential equality in dependency arrays, causing infinite re-renders).
    const mappingRef = useRef(mapping);
    mappingRef.current = mapping;

    const appStateRef = useRef(AppState.currentState);

    useEffect(() => {
      if (enabled === false) return;

      const resolveTheme = (scheme: 'light' | 'dark') =>
        mappingRef.current?.[scheme] ?? (scheme as Names);

      // Sync with the current system scheme on mount.
      const initialScheme = (Appearance.getColorScheme() ?? 'light') as 'light' | 'dark';
      setTheme(resolveTheme(initialScheme), { animated: false });

      // Ignore appearance events fired while backgrounded (iOS fires with
      // incorrect values during its snapshot capture). When the app returns
      // to foreground, read the real scheme and apply instantly — no animation,
      // matching native platform behavior.
      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active') {
          const scheme = (Appearance.getColorScheme() ?? 'light') as 'light' | 'dark';
          setTheme(resolveTheme(scheme), { animated: false });
        }
        appStateRef.current = next;
      });

      // Animate only when the change happens while the app is in the foreground
      // (e.g. Control Center toggle, split-screen).
      const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
        if (appStateRef.current !== 'active') return;
        const scheme = (colorScheme ?? 'light') as 'light' | 'dark';
        setTheme(resolveTheme(scheme));
      });

      return () => {
        appSub.remove();
        appearanceSub.remove();
      };
    }, [enabled, setTheme]);
  };
}
