import { useContext } from 'react';
import type { Context } from 'react';
import type {
  AnimatedThemeContextValue,
  SetThemeOptions,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from '../types';

/** @internal Used by createAnimatedTheme. */
export function createUseTheme<T extends Record<string, ThemeDefinition>>(
  Ctx: Context<AnimatedThemeContextValue<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Tokens = TokenNames<T>;
  type Names = ThemeNames<T>;

  type ThemeValue = {
    colors: { [K in Tokens]: string };
    name: Names;
    setTheme: (name: Names, options?: SetThemeOptions) => void;
    isTransitioning: boolean;
  };

  return function useTheme(): ThemeValue {
    const ctx = useContext(Ctx);
    if (!ctx) {
      throw new Error(
        '[react-native-animated-theme] useTheme must be used within AnimatedThemeProvider',
      );
    }
    return ctx as ThemeValue;
  };
}
