/**
 * Factory entry point for the theme transition system.
 *
 * @module
 */

import { use } from 'react'
import { TAG } from './constants'
import { createProviderAndContext } from './transitionEngine'
import { TRANSITION_TYPES } from './transitionMeta'
import type {
  ThemeDefinition,
  ThemeNames,
  ThemeTransitionAPI,
  ThemeTransitionConfig,
  TokenNames,
  UseThemeResult,
} from './types'

/**
 * Builds a fully typed theme transition system from a map of themes.
 *
 * @param config - Theme configuration.
 * @returns A {@link ThemeTransitionAPI} bound to the supplied themes.
 * @throws Error on invalid configuration.
 * @see https://react-native-theme-transition.vercel.app/docs/api/create-theme-transition
 */
export function createThemeTransition<T extends Record<string, ThemeDefinition>>(
  config: ThemeTransitionConfig<T>,
): ThemeTransitionAPI<T> {
  const themeNames = Object.keys(config.themes) as ThemeNames<T>[]

  if (themeNames.length === 0) {
    throw new Error(`${TAG} \`themes\` must contain at least one theme.`)
  }

  if (Object.hasOwn(config.themes, 'system')) {
    throw new Error(
      `${TAG} \`"system"\` is a reserved name and cannot be used as a theme key.\n  Hint: rename the theme and use \`systemThemeMap\` to map OS appearance to it.`,
    )
  }

  const referenceTheme = themeNames[0]
  const referenceKeys = Object.keys(config.themes[referenceTheme]).sort()
  for (const name of themeNames) {
    if (name === referenceTheme) continue
    const keys = Object.keys(config.themes[name]).sort()
    if (keys.length !== referenceKeys.length || keys.some((k, i) => k !== referenceKeys[i])) {
      throw new Error(
        `${TAG} Theme "${name}" has different token keys than "${referenceTheme}".\n  Hint: every theme must share identical token keys.`,
      )
    }
  }

  if (config.transition != null && !TRANSITION_TYPES.includes(config.transition)) {
    throw new Error(
      `${TAG} \`transition\` must be one of: ${TRANSITION_TYPES.join(', ')}. Got "${config.transition}".`,
    )
  }

  const assertThemeExists = (name: string, source: string, hint: string) => {
    if (!Object.hasOwn(config.themes, name)) {
      throw new Error(
        `${TAG} ${source} refers to "${name}" which does not exist in themes.\n  Hint: ${hint}`,
      )
    }
  }

  if (config.systemThemeMap) {
    if (
      !Object.hasOwn(config.systemThemeMap, 'light') ||
      !Object.hasOwn(config.systemThemeMap, 'dark')
    ) {
      throw new Error(`${TAG} \`systemThemeMap\` must provide both \`light\` and \`dark\` keys.`)
    }
    for (const [scheme, name] of Object.entries(config.systemThemeMap)) {
      assertThemeExists(
        name,
        `\`systemThemeMap.${scheme}\``,
        'the value must match a key in `themes`.',
      )
    }
  }

  if (config.darkThemes) {
    if (config.darkThemes.length === 0) {
      throw new Error(
        `${TAG} \`darkThemes\` cannot be an empty array.\n  Hint: omit the field to use the default (\`['dark']\` or \`[systemThemeMap.dark]\`), or list at least one theme name.`,
      )
    }
    for (const name of config.darkThemes) {
      assertThemeExists(
        name,
        '`darkThemes`',
        'every entry in `darkThemes` must match a key in `themes`.',
      )
    }
  }

  const { Context, ThemeTransitionProvider } = createProviderAndContext(config)

  function useTheme(): UseThemeResult<TokenNames<T>, ThemeNames<T>> {
    const ctx = use(Context)
    if (!ctx) {
      throw new Error(`${TAG} \`useTheme\` must be used inside a \`ThemeTransitionProvider\`.`)
    }
    return ctx
  }

  return { ThemeTransitionProvider, useTheme }
}
