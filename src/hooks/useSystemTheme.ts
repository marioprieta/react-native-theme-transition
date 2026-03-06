import { useContext, useEffect, useRef } from 'react';
import { Appearance, AppState } from 'react-native';
import type { Context } from 'react';
import type {
  ThemeTransitionContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from '../types';

/**
 * Factory that produces the `useSystemTheme` hook bound to a specific context.
 *
 * @internal Used by {@link createThemeTransition}; not part of the public API.
 */
export function createUseSystemTheme<
  T extends Record<string, ThemeDefinition>,
>(
  Ctx: Context<ThemeTransitionContextValue<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Names = ThemeNames<T>;

  return function useSystemTheme(
    enabled?: boolean,
    mapping?: Partial<Record<'light' | 'dark', Names>>,
  ): void {
    const ctx = useContext(Ctx);
    if (!ctx) {
      throw new Error(
        '[react-native-theme-transition] `useSystemTheme` must be used inside an `ThemeTransitionProvider`.',
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

      const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
        const scheme = (colorScheme ?? 'light') as 'light' | 'dark';
        if (appStateRef.current === 'active') {
          setTheme(resolveTheme(scheme));
        } else {
          // Apply instantly while backgrounded so React state matches the iOS
          // snapshot. Without this, returning to the app shows a stale theme.
          setTheme(resolveTheme(scheme), { animated: false });
        }
      });

      // Safety net: if a background Appearance event delivered an incorrect
      // scheme (iOS snapshot capture bug), correct it on foreground return.
      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active') {
          const scheme = (Appearance.getColorScheme() ?? 'light') as 'light' | 'dark';
          setTheme(resolveTheme(scheme), { animated: false });
        }
        appStateRef.current = next;
      });

      return () => {
        appSub.remove();
        appearanceSub.remove();
      };
    }, [enabled, setTheme]);
  };
}
