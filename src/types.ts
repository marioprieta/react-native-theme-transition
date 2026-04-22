import type { View } from 'react-native'
import type { TransitionType } from './transitionMeta'

/**
 * Supported transition names.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/types#transitiontype
 */
export type { TransitionType }

/**
 * A flat record of theme tokens. Keys are token names, values are
 * React Native color strings. Every theme in a configuration must
 * declare the same set of keys.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/types#themedefinition
 */
export type ThemeDefinition = Record<string, string>

/**
 * Explicit origin point for a reveal transition, in React Native
 * density-independent points relative to the provider's root view.
 * Both `x` and `y` must be finite numbers; the engine throws on `NaN`
 * or `Infinity` to prevent silent geometry corruption inside the
 * overlay's bounding-radius math.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/types#transitionorigin
 */
export interface TransitionOrigin {
  /** Horizontal offset from the left edge of the provider, in points. Must be finite. */
  x: number
  /** Vertical offset from the top edge of the provider, in points. Must be finite. */
  y: number
}

/**
 * Origin for a reveal transition. Either an explicit
 * {@link TransitionOrigin} or a React ref whose center is measured
 * just before the animation starts. A ref that has unmounted or
 * returns no coordinates falls back to the center of the screen.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/types#originspec
 */
export type OriginSpec = TransitionOrigin | React.RefObject<View | null>

/** Union of the theme names declared in `T`. */
export type ThemeNames<T extends Record<string, ThemeDefinition>> = keyof T & string

/** Union of the token names shared across every theme in `T`. */
export type TokenNames<T extends Record<string, ThemeDefinition>> = keyof T[ThemeNames<T>] & string

/** Binary OS color scheme. Never `'unspecified'`. */
export type ColorScheme = 'light' | 'dark'

/**
 * Maps OS color schemes to theme names. Required when your themes are
 * not literally named `'light'` and `'dark'` and you want to use
 * `initialTheme="system"` or `setTheme('system')`.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/types#systemthememap
 */
export type SystemThemeMap<Names extends string> = Record<ColorScheme, Names>

/**
 * Configuration for {@link createThemeTransition}.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/api/create-theme-transition
 */
export interface ThemeTransitionConfig<T extends Record<string, ThemeDefinition>> {
  /**
   * All available themes keyed by name. Every theme must share the
   * same token keys; mismatches throw at initialization. The name
   * `'system'` is reserved.
   */
  themes: T

  /**
   * Whether theme changes animate by default. When `false`, every
   * `setTheme` call switches instantly unless the caller passes
   * `{ animated: true }`.
   *
   * @default true
   */
  animated?: boolean

  /**
   * Default transition kind. Override per call via
   * `setTheme(name, { transition })`.
   *
   * @default 'fade'
   */
  transition?: TransitionType

  /**
   * Maps OS appearance to your theme names. Required when your themes
   * are not named `'light'` and `'dark'` and you want to use
   * `'system'` mode. Complements
   * {@link ThemeTransitionConfig.darkThemes}.
   */
  systemThemeMap?: SystemThemeMap<ThemeNames<T>>

  /**
   * Theme names that should register as a dark color scheme with the
   * OS via `Appearance.setColorScheme`. Only needed with two or more
   * dark themes; otherwise derived from
   * {@link ThemeTransitionConfig.systemThemeMap} (or `['dark']` if
   * neither is provided). Must contain at least one entry when
   * supplied; the engine throws on an empty array. Omit the field to
   * fall back to the default.
   *
   * @see https://react-native-theme-transition.vercel.app/docs/api/create-theme-transition#darkthemes
   * @throws Error if supplied as an empty array, or if any entry is not a known theme name.
   */
  darkThemes?: ThemeNames<T>[]

  /**
   * Fires when an animated transition begins, before snapshot capture.
   *
   * @param themeName - Theme becoming active.
   * @see https://react-native-theme-transition.vercel.app/docs/guides/callbacks
   */
  onTransitionStart?: (themeName: ThemeNames<T>) => void

  /**
   * Fires after an animated transition completes and the overlay is
   * removed.
   *
   * @param themeName - Theme that is now active.
   * @see https://react-native-theme-transition.vercel.app/docs/guides/callbacks
   */
  onTransitionEnd?: (themeName: ThemeNames<T>) => void

  /**
   * Fires whenever the active theme changes, regardless of path. The
   * only callback guaranteed to fire on every code path. In `'system'`
   * mode it can fire twice for a single `setTheme` call if the OS
   * appearance changes while the transition is still in flight.
   *
   * @param themeName - Theme that is now active.
   * @see https://react-native-theme-transition.vercel.app/docs/guides/callbacks
   */
  onThemeChange?: (themeName: ThemeNames<T>) => void
}

/** Common fields shared by every variant in {@link SetThemeOptions}. */
interface BaseSetThemeOptions<Names extends string> {
  /**
   * Whether to animate this specific change. `false` switches
   * instantly, with no snapshot or overlay. When omitted, inherits
   * {@link ThemeTransitionConfig.animated} (which itself defaults to
   * `true`).
   */
  animated?: boolean

  /**
   * Duration in milliseconds. Overrides the per-transition default.
   * Must be a non-negative finite number; the engine throws on `NaN`,
   * `Infinity`, or negative values.
   *
   * @default 350 for `fade`, `circularReveal`, `wipe`, `slide`, `split`; 800 for `heart`, `star`; 750 for `pixelize`, `dissolve`
   * @throws Error if not a non-negative finite number.
   */
  duration?: number

  /**
   * Easing function. Accepts any Reanimated `EasingFunction`, a
   * worklet-safe `(t: number) => number`.
   *
   * @default Easing.out(Easing.cubic)
   */
  easing?: (t: number) => number

  /**
   * Per-call start callback. Fires after
   * {@link ThemeTransitionConfig.onTransitionStart} and only when the
   * change is animated.
   *
   * @param themeName - Theme becoming active.
   */
  onTransitionStart?: (themeName: Names) => void

  /**
   * Per-call end callback. Fires after
   * {@link ThemeTransitionConfig.onTransitionEnd}. Skipped on
   * capture-failure fallbacks.
   *
   * @param themeName - Theme that is now active.
   */
  onTransitionEnd?: (themeName: Names) => void
}

/**
 * Fade. The old snapshot's opacity drops to zero, revealing the new
 * theme. Default transition; the `transition` field can be omitted.
 */
interface FadeVariant {
  transition?: 'fade'
}

/**
 * Reveal. A shape (circle, heart, star) grows from a point,
 * uncovering the new theme.
 */
interface RevealVariant {
  transition: 'circularReveal' | 'heart' | 'star'
  /**
   * Point or ref where the shape expands from (or shrinks into when
   * `inverted`). Falls back to the center of the screen.
   */
  origin?: OriginSpec
  /**
   * Reverse the direction. The new theme fills the screen and the old
   * theme shrinks inside the shape until it vanishes.
   *
   * @default false
   */
  inverted?: boolean
}

/**
 * Wipe and slide. Directional reveal; `direction` names where the
 * motion is heading. The new theme always enters from the opposite
 * edge and moves toward `direction`.
 */
interface WipeVariant {
  transition: 'wipe' | 'slide'
  /**
   * Cardinal direction the motion is heading.
   *
   * @default 'right'
   */
  direction?: 'left' | 'right' | 'up' | 'down'
}

/**
 * Split. The screen splits in two and each half animates. With
 * `inverted: false` the halves part outward from the centerline like
 * curtains. With `inverted: true` they close inward from the edges
 * like shutters.
 */
interface SplitVariant {
  transition: 'split'
  /**
   * How the screen is divided. `'left-right'` splits vertically;
   * `'top-bottom'` splits horizontally.
   *
   * @default 'left-right'
   */
  mode?: 'left-right' | 'top-bottom'
  /**
   * Reverse the animation. `false` parts outward from the center;
   * `true` closes inward from the edges.
   *
   * @default false
   */
  inverted?: boolean
}

/**
 * Pixelize. Both old and new snapshots crossfade through a shared
 * pixel grid that peaks at the midpoint.
 */
interface PixelizeVariant {
  transition: 'pixelize'
  /**
   * Maximum pixel block size in points at the animation's midpoint.
   * Higher values give a chunkier mosaic. Must be a finite number
   * `>= 2`; the engine throws on smaller, `NaN`, or `Infinity` values.
   *
   * @default 52
   * @throws Error if not a finite number `>= 2`.
   */
  blockSize?: number
}

/**
 * Dissolve. The old snapshot disintegrates via a noise threshold; as
 * `progress` rises, more cells turn transparent until the new theme is
 * fully visible.
 */
interface DissolveVariant {
  transition: 'dissolve'
  /**
   * Noise cell size in points. Higher values give bigger, more
   * visible specks; lower values give finer sand. Must be a finite
   * number `>= 1`; the engine throws on smaller, `NaN`, or `Infinity`
   * values.
   *
   * @default 5
   * @throws Error if not a finite number `>= 1`.
   */
  noiseSize?: number
}

/**
 * Options for {@link UseThemeResult.setTheme}. The `transition` field
 * selects a variant and determines which extra fields are valid for
 * that variant.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/types#setthemeoptions
 */
export type SetThemeOptions<Names extends string = string> = BaseSetThemeOptions<Names> &
  (FadeVariant | RevealVariant | WipeVariant | SplitVariant | PixelizeVariant | DissolveVariant)

/**
 * Return value of {@link ThemeTransitionAPI.useTheme}. Two orthogonal
 * concepts: `theme` (what is currently painted, always concrete) and
 * `preference` (what the user explicitly picked, can be `'system'`).
 *
 * @see https://react-native-theme-transition.vercel.app/docs/api/use-theme
 */
export interface UseThemeResult<Tokens extends string, Names extends string> {
  /**
   * The theme currently painted on screen. Always a concrete theme,
   * never `'system'`.
   */
  theme: {
    /** Name of the painted theme. Always concrete. */
    name: Names
    /** Resolved color tokens for the painted theme. */
    colors: Record<Tokens, string>
    /**
     * Binary light or dark classification, derived from
     * {@link ThemeTransitionConfig.darkThemes}.
     */
    scheme: ColorScheme
  }

  /**
   * The theme the user explicitly picked. May be `'system'`. Mirrors
   * the last argument passed to {@link UseThemeResult.setTheme}.
   */
  preference: Names | 'system'

  /** `true` while a transition overlay is visible. */
  isTransitioning: boolean

  /**
   * Change the user's {@link UseThemeResult.preference}.
   *
   * @param name - Concrete theme name, or `'system'` to follow the OS.
   * @param options - Per-call transition configuration.
   * @returns `'accepted'` if the change will apply, `'ignored'` if rejected (same preference or transition in flight).
   * @see https://react-native-theme-transition.vercel.app/docs/api/use-theme#settheme
   */
  setTheme: (name: Names | 'system', options?: SetThemeOptions<Names>) => 'accepted' | 'ignored'
}

/**
 * Public API returned by {@link createThemeTransition}.
 *
 * @see https://react-native-theme-transition.vercel.app/docs/api/create-theme-transition
 */
export interface ThemeTransitionAPI<T extends Record<string, ThemeDefinition>> {
  /**
   * Provider that supplies animated theme colors via context.
   *
   * @see https://react-native-theme-transition.vercel.app/docs/api/provider
   */
  ThemeTransitionProvider: (props: {
    /** Your app tree. */
    children: React.ReactNode
    /**
     * Theme to render on the first frame. Read once on mount, like
     * the initializer of `useState`; later changes to this prop are
     * ignored.
     */
    initialTheme: ThemeNames<T> | 'system'
  }) => React.ReactNode

  /**
   * Hook that returns the {@link UseThemeResult} for the nearest
   * provider.
   *
   * @throws Error if called outside a `ThemeTransitionProvider`.
   * @see https://react-native-theme-transition.vercel.app/docs/api/use-theme
   */
  useTheme: () => UseThemeResult<TokenNames<T>, ThemeNames<T>>
}
