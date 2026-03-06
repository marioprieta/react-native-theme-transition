import { useContext, useEffect, useRef } from 'react';
import { Appearance } from 'react-native';
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
        '[react-native-theme-transition] useSystemTheme must be used within AnimatedThemeProvider',
      );
    }

    const setTheme = ctx.setTheme;
    // Ref avoids re-subscribing when consumers pass inline objects (which fail
    // referential equality in dependency arrays, causing infinite re-renders).
    const mappingRef = useRef(mapping);
    mappingRef.current = mapping;

    useEffect(() => {
      if (!enabled) return;

      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        const scheme = (colorScheme ?? 'light') as 'light' | 'dark';
        setTheme(mappingRef.current?.[scheme] ?? (scheme as Names));
      });
      return () => subscription.remove();
    }, [enabled, setTheme]);
  };
}
