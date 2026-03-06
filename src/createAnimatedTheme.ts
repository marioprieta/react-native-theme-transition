/**
 * Factory that wires the animated theme provider, context, and hooks.
 *
 * @remarks
 * Validates theme configuration at initialization: ensures at least one theme
 * exists, that {@link AnimatedThemeConfig.defaultTheme | defaultTheme} refers
 * to an actual theme, and that all themes share identical token keys.
 * Returns a self-contained API ({@link AnimatedThemeAPI}) with no singletons,
 * so multiple theme scopes can coexist in the same app.
 *
 * @module
 */

import type {
  AnimatedThemeAPI,
  AnimatedThemeConfig,
  ThemeDefinition,
  ThemeNames,
} from './types';
import { createProviderAndContext } from './provider';
import { createUseTheme } from './hooks/useTheme';
import { createUseSystemTheme } from './hooks/useSystemTheme';

/**
 * Creates a fully typed animated theme system.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 * @param config - Theme configuration including available themes and defaults.
 * @returns A provider component and hooks scoped to the supplied themes.
 *
 * @example
 * ```tsx
 * const { AnimatedThemeProvider, useTheme } = createAnimatedTheme({
 *   themes: { light: { bg: '#fff' }, dark: { bg: '#000' } },
 *   defaultTheme: 'light',
 * });
 * ```
 */
export function createAnimatedTheme<
  T extends Record<string, ThemeDefinition>,
>(config: AnimatedThemeConfig<T>): AnimatedThemeAPI<T> {
  const themeNames = Object.keys(config.themes) as ThemeNames<T>[];

  if (themeNames.length === 0) {
    throw new Error('[react-native-theme-transition] At least one theme must be provided.');
  }

  if (!(config.defaultTheme in config.themes)) {
    throw new Error(
      `[react-native-theme-transition] Default theme "${config.defaultTheme}" not found.`,
    );
  }

  const referenceKeys = Object.keys(config.themes[config.defaultTheme]).sort();
  for (const name of themeNames) {
    const keys = Object.keys(config.themes[name]).sort();
    if (keys.length !== referenceKeys.length || keys.some((k, i) => k !== referenceKeys[i])) {
      throw new Error(
        `[react-native-theme-transition] Theme "${name}" has different keys than "${config.defaultTheme}".`,
      );
    }
  }

  const { Context, AnimatedThemeProvider } = createProviderAndContext(config);

  return {
    AnimatedThemeProvider,
    useTheme: createUseTheme<T>(Context),
    useSystemTheme: createUseSystemTheme<T>(Context),
  };
}
