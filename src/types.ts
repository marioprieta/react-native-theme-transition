/**
 * Map of theme token names to color values.
 *
 * @remarks
 * Each theme is a flat record where keys are token names (e.g. `"background"`,
 * `"textPrimary"`) and values are color strings accepted by React Native
 * (hex, rgb, rgba, named colors).
 */
export type ThemeDefinition = Record<string, string>;

/**
 * Union of theme names available in a theme configuration.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export type ThemeNames<T extends Record<string, ThemeDefinition>> =
  keyof T & string;

/**
 * Union of token names shared across all themes in a configuration.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export type TokenNames<T extends Record<string, ThemeDefinition>> =
  keyof T[ThemeNames<T>] & string;

/**
 * Configuration for {@link createAnimatedTheme}.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export interface AnimatedThemeConfig<T extends Record<string, ThemeDefinition>> {
  /**
   * All available themes keyed by name.
   *
   * @remarks
   * Every theme must share the exact same token keys. Mismatched keys
   * cause a runtime error at initialization.
   */
  themes: T;

  /** Name of the theme applied on first render. */
  defaultTheme: ThemeNames<T>;

  /**
   * Cross-fade duration in milliseconds.
   * @default 350
   */
  duration?: number;

  /**
   * Called after a theme transition completes and the overlay is removed.
   *
   * @param themeName - The newly active theme name.
   */
  onTransitionEnd?: (themeName: ThemeNames<T>) => void;
}

/**
 * Options for {@link AnimatedThemeAPI.useTheme | setTheme}.
 */
export interface SetThemeOptions {
  /**
   * Whether to use the screenshot-overlay cross-fade animation.
   *
   * @remarks
   * When `false`, the theme switches instantly without capturing a screenshot
   * or showing an overlay. Useful for system theme changes that happen while
   * the app is in the background.
   *
   * @default true
   */
  animated?: boolean;

  /**
   * Called after the screenshot is captured, just before the theme switch is applied.
   *
   * @remarks
   * At this point the screenshot will be displayed as a static overlay on the
   * next frame — ideal for triggering haptic feedback or logging analytics.
   * Only called when `animated` is `true` (the default).
   */
  onCaptured?: () => void;
}

/**
 * Internal context value flowing through the provider.
 *
 * @internal
 */
export interface AnimatedThemeContextValue<
  Tokens extends string,
  Names extends string,
> {
  /** Current resolved color values for all tokens. */
  colors: Record<Tokens, string>;
  /** Name of the currently active theme. */
  name: Names;
  /** Switch to a new theme, optionally with transition callbacks. */
  setTheme: (name: Names, options?: SetThemeOptions) => void;
  /** `true` while a cross-fade transition overlay is visible. */
  isTransitioning: boolean;
}

/**
 * Public API returned by {@link createAnimatedTheme}.
 *
 * @remarks
 * This interface is the primary documentation surface for consumers.
 * IDE tooltips resolve from these property definitions when consumers
 * destructure the factory return value.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export interface AnimatedThemeAPI<T extends Record<string, ThemeDefinition>> {
  /**
   * Provider that supplies animated theme colors via context.
   *
   * @remarks
   * Place this as high as possible in the component tree (ideally wrapping
   * navigation) so the screenshot can capture the entire screen.
   */
  AnimatedThemeProvider: React.FC<{
    children: React.ReactNode;
    /** Optional initial theme; defaults to {@link AnimatedThemeConfig.defaultTheme}. */
    initialTheme?: ThemeNames<T>;
  }>;

  /**
   * Hook returning the current theme name, colors, and transition controls.
   *
   * @returns An object with `colors`, `name`, `setTheme`, and `isTransitioning`.
   *
   * @throws If called outside an `AnimatedThemeProvider`.
   */
  useTheme: () => {
    /** Resolved color values for every token in the active theme. */
    colors: { [K in TokenNames<T>]: string };
    /** Name of the currently active theme. */
    name: ThemeNames<T>;
    /**
     * Switch to a different theme with an animated cross-fade.
     *
     * @param name - Target theme name.
     * @param options - Optional transition callbacks.
     */
    setTheme: (name: ThemeNames<T>, options?: SetThemeOptions) => void;
    /** `true` while a cross-fade transition is in progress. */
    isTransitioning: boolean;
  };

  /**
   * Hook that syncs the active theme with the system appearance (light/dark).
   *
   * @param enabled - When `true` or omitted, subscribes to OS appearance changes.
   *   Pass `false` explicitly to deactivate the listener.
   * @param mapping - Maps system appearance to theme names. Falls back to
   *   using the appearance value (`'light'`/`'dark'`) as the theme name.
   *
   * @throws If called outside an `AnimatedThemeProvider`.
   */
  useSystemTheme: (
    enabled?: boolean,
    mapping?: Partial<Record<'light' | 'dark', ThemeNames<T>>>,
  ) => void;
}
