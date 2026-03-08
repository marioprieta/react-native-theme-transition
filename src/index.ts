/**
 * Public entry point for react-native-theme-transition.
 *
 * @remarks
 * The transition mechanism works in five steps:
 * 1. Blocks touch input via a Reanimated shared value (instant, no React re-render).
 * 2. Captures the current native view via `react-native-view-shot`.
 * 3. Overlays the snapshot as an absolute-positioned `Image` (`onLoad` confirms decode).
 * 4. Mutates context to inject new theme colors underneath.
 * 5. Fades the overlay to zero via `react-native-reanimated` — the native repaint
 *    completes during the first frames while the overlay is still near-opaque.
 *
 * @see {@link createThemeTransition} for the main API surface.
 * @packageDocumentation
 */

export { createThemeTransition } from './createThemeTransition';

export type {
  ThemeTransitionConfig,
  ThemeTransitionAPI,
  UseThemeResult,
  ThemeSelectionResult,
  SystemThemeMap,
  SetThemeOptions,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';
