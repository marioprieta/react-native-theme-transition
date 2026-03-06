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
 * Used by {@link ThemeTransitionConfig.systemThemeMap} to resolve
 * `Appearance.getColorScheme()` into a concrete theme name when the provider
 * is in system mode (`initialTheme="system"` or `setTheme('system')`).
 *
 * Only required when your themes are not named `'light'` and `'dark'`.
 *
 * @typeParam Names - Union of theme name strings.
 */
export type SystemThemeMap<Names extends string> =
  Partial<Record<'light' | 'dark', Names>>;

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

  /** Name of the theme applied on first render. */
  defaultTheme: ThemeNames<T>;

  /**
   * Cross-fade duration in milliseconds.
   * @default 350
   */
  duration?: number;

  /**
   * Maps OS appearance (`'light'` / `'dark'`) to theme names.
   *
   * @remarks
   * Required when your themes are not literally named `'light'` and `'dark'`
   * and you want to use system mode (`initialTheme="system"` or
   * `setTheme('system')`). Without this map, the provider uses the OS scheme
   * value directly as a theme name.
   *
   * @example
   * ```ts
   * systemThemeMap: { light: 'sunrise', dark: 'midnight' }
   * ```
   */
  systemThemeMap?: SystemThemeMap<ThemeNames<T>>;

  /**
   * Called after a theme transition completes and the overlay is removed.
   *
   * @param themeName - The newly active theme name.
   */
  onTransitionEnd?: (themeName: ThemeNames<T>) => void;
}

/**
 * Options for {@link ThemeTransitionAPI.useTheme | setTheme}.
 */
export interface SetThemeOptions {
  /**
   * Whether to use the screenshot-overlay cross-fade animation.
   *
   * @remarks
   * When `false`, the theme switches instantly without capturing a screenshot
   * or showing an overlay. Useful for restoring a persisted theme at startup
   * or syncing from an external store.
   *
   * @default true
   */
  animated?: boolean;

  /**
   * Called after the screenshot is captured, just before the theme switch is applied.
   *
   * @remarks
   * Runs synchronously on the JS thread right after capture. Keep callbacks
   * lightweight (haptics, analytics) — expensive work here delays the
   * visual transition. Only called when `animated` is `true` (the default).
   */
  onCaptured?: () => void;
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
  /**
   * Switch to a new theme or enter system mode.
   *
   * @remarks
   * Pass a theme name for a direct switch, or `'system'` to follow the OS
   * appearance. In system mode, the provider subscribes to
   * `Appearance.addChangeListener` and syncs on `AppState` foreground return.
   */
  setTheme: (name: Names | 'system', options?: SetThemeOptions) => void;
  /** `true` while a cross-fade transition overlay is visible. */
  isTransitioning: boolean;
}

/**
 * Public API returned by {@link createThemeTransition}.
 *
 * @remarks
 * This interface is the primary documentation surface for consumers.
 * IDE tooltips resolve from these property definitions when consumers
 * destructure the factory return value.
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
     * Initial theme or system mode.
     *
     * @remarks
     * Pass a theme name to start with that theme, or `'system'` to read the
     * OS appearance synchronously on the first frame (zero-flash) and subscribe
     * to system changes for the lifetime of the provider.
     *
     * When `'system'` is used with custom theme names, provide
     * {@link ThemeTransitionConfig.systemThemeMap | systemThemeMap} in the
     * factory config to map `'light'`/`'dark'` to your theme names.
     *
     * Defaults to {@link ThemeTransitionConfig.defaultTheme} when omitted.
     */
    initialTheme?: ThemeNames<T> | 'system';
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
     * @remarks
     * Pass a theme name for a direct switch with animated cross-fade,
     * or `'system'` to follow the OS appearance. When in system mode,
     * calling `setTheme` with a specific theme name exits system mode.
     *
     * @param name - Target theme name or `'system'`.
     * @param options - Optional transition callbacks.
     */
    setTheme: (name: ThemeNames<T> | 'system', options?: SetThemeOptions) => void;
    /** `true` while a cross-fade transition is in progress. */
    isTransitioning: boolean;
  };
}
