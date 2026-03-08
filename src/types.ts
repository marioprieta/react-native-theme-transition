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
   * Theme names that use a dark color scheme.
   *
   * @remarks
   * The library automatically calls `Appearance.setColorScheme` to keep
   * native UI elements (alerts, date pickers, keyboards) in sync with
   * the active theme. Themes listed here get `'dark'`; all others get `'light'`.
   * In system mode, `'unspecified'` is used so the OS drives the appearance.
   *
   * **Do not call `Appearance.setColorScheme` yourself** — the library manages
   * it internally. Calling it manually can corrupt state on Android.
   *
   * @default `[systemThemeMap.dark]` if `systemThemeMap` is provided, otherwise `['dark']`.
   */
  darkThemes?: ThemeNames<T>[];

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
   * Not called if the screenshot capture fails mid-transition, even when
   * `onTransitionStart` has already fired. In that case the library falls back to an
   * instant switch and only `onThemeChange` fires. Design `onTransitionStart` handlers
   * to be resilient to a missing matching `onTransitionEnd`.
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
   * Not called if the screenshot capture fails mid-transition, even when
   * `onTransitionStart` has already fired. In that case the library falls back to an
   * instant switch and only `onThemeChange` fires.
   *
   * @param themeName - The newly active theme name.
   */
  onTransitionEnd?: (themeName: Names) => void;
}

/**
 * Base return type of the {@link ThemeTransitionAPI.useTheme | useTheme} hook.
 *
 * @typeParam Tokens - Union of token name strings.
 * @typeParam Names - Union of theme name strings.
 */
export interface UseThemeResult<
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
   * @param name - Target theme name or `'system'`.
   * @param options - Optional transition configuration.
   * @returns `true` if the theme change was accepted, `false` if rejected
   *          (already transitioning or same theme).
   */
  setTheme: (name: Names | 'system', options?: SetThemeOptions<Names>) => boolean;
  /** `true` while a cross-fade transition overlay is visible. */
  isTransitioning: boolean;
}

/**
 * Selection state returned by {@link ThemeTransitionAPI.useTheme | useTheme}
 * when called with `{ initialSelection }`.
 *
 * @typeParam Names - Union of theme name strings.
 */
export interface ThemeSelectionResult<Names extends string> {
  /** The currently selected option (may be `'system'`). */
  selected: Names | 'system';
  /**
   * Select a theme with transition-safe timing.
   *
   * @remarks
   * Updates the selection highlight immediately, then defers `setTheme`
   * to the next animation frame so the selection is painted before
   * the library captures the screenshot. Rapid presses during an
   * ongoing transition are silently ignored.
   *
   * @param option - Theme name or `'system'`.
   */
  select: (option: Names | 'system') => void;
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
   * Hook returning the current theme state and transition controls.
   *
   * @remarks
   * **Without arguments** — returns theme colors, name, `setTheme`, and
   * `isTransitioning`. Use this in any component that reads or changes the theme.
   *
   * **With `{ initialSelection }`** — also returns `selected` and `select` for
   * building theme selection UIs (button groups, toggles, checkmark lists) with
   * transition-safe timing. On iOS (especially 120Hz ProMotion), calling
   * `setTheme` synchronously after a UI state update can cause the screenshot
   * to capture the old state, producing visible flickering. The `select`
   * function handles this automatically by deferring `setTheme` to the next
   * animation frame.
   *
   * `initialSelection` sets the starting value of `selected` (read once, like
   * `useState`). When omitted, defaults to the current theme name from context.
   *
   * @throws If called outside a `ThemeTransitionProvider`.
   *
   * @example
   * ```tsx
   * // Reading theme colors in any component
   * const { colors, name } = useTheme();
   * ```
   *
   * @example
   * ```tsx
   * // Building a theme selection UI
   * function ThemePicker() {
   *   const { selected, select, colors, isTransitioning } = useTheme({ initialSelection: 'system' });
   *   return (
   *     <View style={{ flexDirection: 'row', gap: 8 }}>
   *       {(['system', 'light', 'dark'] as const).map((option) => (
   *         <Pressable
   *           key={option}
   *           onPress={() => select(option)}
   *           disabled={isTransitioning}
   *           style={{ backgroundColor: option === selected ? colors.primary : 'transparent' }}
   *         >
   *           <Text>{option}</Text>
   *         </Pressable>
   *       ))}
   *     </View>
   *   );
   * }
   * ```
   */
  useTheme: {
    /** Returns current theme state and controls. */
    (): UseThemeResult<TokenNames<T>, ThemeNames<T>>;
    /**
     * Returns theme state, controls, and selection tracking with transition-safe timing.
     * @param options.initialSelection - Starting value for `selected`. Defaults to the current theme name.
     */
    (options: { initialSelection?: ThemeNames<T> | 'system' }): UseThemeResult<TokenNames<T>, ThemeNames<T>> & ThemeSelectionResult<ThemeNames<T>>;
  };
}
