/**
 * Public entry point for react-native-theme-transition.
 *
 * @remarks
 * The transition mechanism works in five steps:
 * 1. Blocks touch input instantly via a Reanimated shared value (no React re-render).
 * 2. Captures a snapshot of the current native view using `@shopify/react-native-skia`.
 * 3. Renders the snapshot as an overlay in a Skia Canvas.
 * 4. Swaps the context colors to the new theme underneath the overlay.
 * 5. Animates the overlay away using the selected transition — fade,
 *    circular reveal, wipe, slide, split, heart, star, pixelize,
 *    or dissolve.
 *
 * @see {@link createThemeTransition} — main API entry.
 * @see {@link useReducedMotion} — hook for the OS "Reduce Motion" setting.
 * @packageDocumentation
 */

export { createThemeTransition } from './createThemeTransition'
export { useReducedMotion } from './hooks/useReducedMotion'
export type { TransitionKind } from './transitionMeta'
export { TRANSITION_META, TRANSITION_TYPES } from './transitionMeta'

export type {
  OriginSpec,
  SelectOptions,
  SetThemeOptions,
  SystemThemeMap,
  ThemeDefinition,
  ThemeNames,
  ThemeTransitionAPI,
  ThemeTransitionConfig,
  TokenNames,
  TransitionOrigin,
  TransitionType,
  UseThemeOptions,
  UseThemeResult,
} from './types'
