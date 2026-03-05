import { useContext, useEffect, useRef } from 'react';
import { Appearance } from 'react-native';
import type { Context } from 'react';
import type {
  AnimatedThemeContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from '../types';

/** @internal */
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
