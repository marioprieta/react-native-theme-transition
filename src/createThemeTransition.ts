/**
 * Factory that wires the theme transition provider, context, and hooks.
 *
 * @remarks
 * Validates theme configuration at initialization: ensures at least one theme
 * exists and that all themes share identical token keys.
 * Returns a self-contained API ({@link ThemeTransitionAPI}) with no singletons,
 * so multiple theme scopes can coexist in the same app.
 *
 * @module
 */

import type {
  ThemeTransitionAPI,
  ThemeTransitionConfig,
  ThemeDefinition,
  ThemeNames,
} from './types';
import { createProviderAndContext } from './provider';
import { createUseTheme } from './hooks/useTheme';

/**
 * Creates a fully typed theme transition system.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 * @param config - Theme configuration including available themes and defaults.
 * @returns A provider component and hooks scoped to the supplied themes.
 *
 * @example
 * ```tsx
 * const { ThemeTransitionProvider, useTheme } = createThemeTransition({
 *   themes: { light: { bg: '#fff' }, dark: { bg: '#000' } },
 * });
 * ```
 */
export function createThemeTransition<
  T extends Record<string, ThemeDefinition>,
>(config: ThemeTransitionConfig<T>): ThemeTransitionAPI<T> {
  const themeNames = Object.keys(config.themes) as ThemeNames<T>[];

  if (themeNames.length === 0) {
    throw new Error('[react-native-theme-transition] `themes` must contain at least one theme.');
  }

  if ('system' in config.themes) {
    throw new Error(
      '[react-native-theme-transition] `"system"` is a reserved name and cannot be used as a theme key. Rename the theme and use `systemThemeMap` to map OS appearance to it.',
    );
  }

  const referenceTheme = themeNames[0];
  const referenceKeys = Object.keys(config.themes[referenceTheme]).sort();
  for (const name of themeNames) {
    if (name === referenceTheme) continue;
    const keys = Object.keys(config.themes[name]).sort();
    if (keys.length !== referenceKeys.length || keys.some((k, i) => k !== referenceKeys[i])) {
      throw new Error(
        `[react-native-theme-transition] Theme "${name}" has different token keys than "${referenceTheme}". All themes must share identical keys.`,
      );
    }
  }

  if (config.duration != null && (typeof config.duration !== 'number' || !isFinite(config.duration) || config.duration < 0)) {
    throw new Error(
      '[react-native-theme-transition] `duration` must be a finite non-negative number.',
    );
  }

  if (config.systemThemeMap) {
    for (const [scheme, name] of Object.entries(config.systemThemeMap)) {
      if (!(name in config.themes)) {
        throw new Error(
          `[react-native-theme-transition] \`systemThemeMap.${scheme}\` maps to "${name}" which does not exist in themes.`,
        );
      }
    }
  }

  const { Context, ThemeTransitionProvider } = createProviderAndContext(config);

  return {
    ThemeTransitionProvider,
    useTheme: createUseTheme<T>(Context),
  };
}
