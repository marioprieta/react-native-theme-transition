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
 * Maps OS color schemes (`'light'` / `'dark'`) to theme names.
 *
 * @remarks
 * Required when your themes are not named `'light'` and `'dark'`.
 * Both keys must be provided.
 *
 * @typeParam Names - Union of theme name strings.
 */
export type SystemThemeMap<Names extends string> =
  Record<'light' | 'dark', Names>;

/**
 * Configuration for {@link createThemeTransition}.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export interface ThemeTransitionConfig<T extends Record<string, ThemeDefinition>> {
  /**
   * All available themes keyed by name.
   *
   * @remarks
   * Every theme must share the exact same token keys. Mismatched keys
   * cause a runtime error at initialization.
   * The name `'system'` is reserved and cannot be used as a theme name.
   */
  themes: T;

  /**
   * Cross-fade duration in milliseconds.
   * @default 350
   */
  duration?: number;

  /**
   * Maps OS appearance (`'light'` / `'dark'`) to theme names.
   *
   * @remarks
   * Required when your themes are not named `'light'` and `'dark'`
   * and you want to use `initialTheme="system"` or `setTheme('system')`.
   * Both `light` and `dark` must be provided.
   */
  systemThemeMap?: SystemThemeMap<ThemeNames<T>>;

  /**
   * Called when an animated transition begins, before the screenshot capture.
   *
   * @remarks
   * Fires for all animated transitions, including system-driven ones.
   * Does not fire for instant switches (`animated: false`).
   *
   * @param themeName - The target theme name.
   */
  onTransitionStart?: (themeName: ThemeNames<T>) => void;

  /**
   * Called after an animated transition completes and the overlay is removed.
   *
   * @remarks
   * Fires for all animated transitions, including system-driven ones.
   * Does not fire for instant switches (`animated: false`).
   *
   * @param themeName - The newly active theme name.
   */
  onTransitionEnd?: (themeName: ThemeNames<T>) => void;

  /**
   * Called whenever the active theme changes.
   *
   * @remarks
   * Fires for all theme changes: animated transitions, instant switches,
   * and system-driven appearance changes. For animated transitions,
   * fires after `onTransitionEnd`.
   *
   * @param themeName - The newly active theme name.
   */
  onThemeChange?: (themeName: ThemeNames<T>) => void;
}

/**
 * Options for {@link ThemeTransitionAPI.useTheme | setTheme}.
 *
 * @typeParam Names - Union of theme name strings.
 */
export interface SetThemeOptions<Names extends string = string> {
  /**
   * Whether to use the screenshot-overlay cross-fade animation.
   *
   * @remarks
   * When `false`, the theme switches instantly without capturing a screenshot
   * or showing an overlay.
   *
   * @default true
   */
  animated?: boolean;

  /**
   * Called when the animated transition begins, before the screenshot capture.
   *
   * @remarks
   * Only called when `animated` is `true` (the default).
   * Fires after the config-level `onTransitionStart` (if provided).
   *
   * @param themeName - The target theme name.
   */
  onTransitionStart?: (themeName: Names) => void;

  /**
   * Called after the animated transition completes and the overlay is removed.
   *
   * @remarks
   * Only called when `animated` is `true` (the default).
   * Fires after the config-level `onTransitionEnd` (if provided).
   *
   * @param themeName - The newly active theme name.
   */
  onTransitionEnd?: (themeName: Names) => void;
}

/**
 * Internal context value flowing through the provider.
 *
 * @internal
 */
export interface ThemeTransitionContextValue<
  Tokens extends string,
  Names extends string,
> {
  /** Current resolved color values for all tokens. */
  colors: Record<Tokens, string>;
  /** Name of the currently active theme (resolved, never `'system'`). */
  name: Names;
  /** Switch to a new theme or enter system mode. */
  setTheme: (name: Names | 'system', options?: SetThemeOptions<Names>) => void;
  /** `true` while a cross-fade transition overlay is visible. */
  isTransitioning: boolean;
}

/**
 * Public API returned by {@link createThemeTransition}.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export interface ThemeTransitionAPI<T extends Record<string, ThemeDefinition>> {
  /**
   * Provider that supplies animated theme colors via context.
   *
   * @remarks
   * Place this as high as possible in the component tree (ideally wrapping
   * navigation) so the screenshot can capture the entire screen.
   */
  ThemeTransitionProvider: React.FC<{
    children: React.ReactNode;
    /**
     * Theme to render on the first frame.
     *
     * @remarks
     * Pass `'system'` to read the OS appearance synchronously (zero-flash)
     * and subscribe to changes. For custom theme names, provide
     * {@link ThemeTransitionConfig.systemThemeMap | systemThemeMap} in the config.
     */
    initialTheme: ThemeNames<T> | 'system';
  }>;

  /**
   * Hook returning the current theme name, colors, and transition controls.
   *
   * @returns An object with `colors`, `name`, `setTheme`, and `isTransitioning`.
   *
   * @throws If called outside a `ThemeTransitionProvider`.
   */
  useTheme: () => {
    /** Resolved color values for every token in the active theme. */
    colors: { [K in TokenNames<T>]: string };
    /** Name of the currently active theme (resolved, never `'system'`). */
    name: ThemeNames<T>;
    /**
     * Switch to a different theme or enter system mode.
     *
     * @param name - Target theme name or `'system'`.
     * @param options - Optional transition callbacks.
     */
    setTheme: (name: ThemeNames<T> | 'system', options?: SetThemeOptions<ThemeNames<T>>) => void;
    /** `true` while a cross-fade transition is in progress. */
    isTransitioning: boolean;
  };
}
