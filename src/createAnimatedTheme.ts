import type {
  AnimatedThemeAPI,
  AnimatedThemeConfig,
  ThemeDefinition,
  ThemeNames,
} from './types';
import { createProviderAndContext } from './provider';
import { createUseTheme } from './hooks/useTheme';
import { createUseSystemTheme } from './hooks/useSystemTheme';

export function createAnimatedTheme<
  T extends Record<string, ThemeDefinition>,
>(config: AnimatedThemeConfig<T>): AnimatedThemeAPI<T> {
  const themeNames = Object.keys(config.themes) as ThemeNames<T>[];

  if (themeNames.length === 0) {
    throw new Error('[react-native-animated-theme] At least one theme must be provided.');
  }

  if (!(config.defaultTheme in config.themes)) {
    throw new Error(
      `[react-native-animated-theme] Default theme "${config.defaultTheme}" not found.`,
    );
  }

  const referenceKeys = Object.keys(config.themes[config.defaultTheme]).sort();
  for (const name of themeNames) {
    const keys = Object.keys(config.themes[name]).sort();
    if (keys.length !== referenceKeys.length || keys.some((k, i) => k !== referenceKeys[i])) {
      throw new Error(
        `[react-native-animated-theme] Theme "${name}" has different keys than "${config.defaultTheme}".`,
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
