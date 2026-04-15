/**
 * Public entry point for react-native-theme-transition.
 *
 * @remarks
 * The transition engine snapshots the current native view into a Skia
 * `SkImage`, swaps the theme tokens underneath, and animates the
 * snapshot away with one of nine styles (fade, circular reveal, heart,
 * star, wipe, slide, split, pixelize, dissolve). Touch input is blocked
 * by a shared value on the UI thread so React never sees the blocking
 * state change.
 *
 * @see {@link createThemeTransition} for the main API entry.
 * @packageDocumentation
 */

export { createThemeTransition } from './createThemeTransition'
export { TRANSITION_META, TRANSITION_TYPES } from './transitionMeta'

export type {
  ColorScheme,
  OriginSpec,
  SetThemeOptions,
  SystemThemeMap,
  ThemeDefinition,
  ThemeNames,
  ThemeTransitionAPI,
  ThemeTransitionConfig,
  TokenNames,
  TransitionOrigin,
  TransitionType,
  UseThemeResult,
} from './types'
