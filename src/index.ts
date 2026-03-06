/**
 * Public entry point for react-native-theme-transition.
 *
 * @remarks
 * The transition mechanism works in five steps:
 * 1. Captures the current native view via `react-native-view-shot`.
 * 2. Overlays the snapshot as an absolute-positioned `Image`.
 * 3. Mutates context to inject new theme colors underneath.
 * 4. Waits for the native UI thread to repaint beneath the overlay.
 * 5. Fades the overlay to zero using `react-native-reanimated`.
 *
 * @see {@link createThemeTransition} for the main API surface.
 * @packageDocumentation
 */

export { createThemeTransition } from './createThemeTransition';

export type {
  ThemeTransitionConfig,
  ThemeTransitionAPI,
  SetThemeOptions,
  ThemeDefinition,
  ThemeNames,
  TokenNames,
} from './types';
