import { useContext } from 'react';
import type { Context } from 'react';
import type {
  ThemeTransitionContextValue,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from '../types';

/**
 * Factory that produces the `useTheme` hook bound to a specific context.
 *
 * @internal Used by {@link createThemeTransition}; not part of the public API.
 */
export function createUseTheme<T extends Record<string, ThemeDefinition>>(
  Ctx: Context<ThemeTransitionContextValue<TokenNames<T>, ThemeNames<T>> | null>,
) {
  type Tokens = TokenNames<T>;
  type Names = ThemeNames<T>;

  return function useTheme(): ThemeTransitionContextValue<Tokens, Names> {
    const ctx = useContext(Ctx);
    if (!ctx) {
      throw new Error(
        '[react-native-theme-transition] `useTheme` must be used inside a `ThemeTransitionProvider`.',
      );
    }
    return ctx;
  };
}
