import type { View } from 'react-native'
import type { SplitAxis, TransitionType, WipeDirection } from './transitionMeta'

/**
 * Supported transition names.
 *
 * @remarks
 * Derived from {@link TRANSITION_META}. Use this type to constrain user
 * input and to build strongly-typed UI controls for transition selection.
 */
export type { TransitionType }

/**
 * Map of theme token names to color values.
 *
 * @remarks
 * Each theme is a flat record where keys are token names (e.g. `"background"`,
 * `"textPrimary"`) and values are color strings accepted by React Native
 * (hex, rgb, rgba, named colors). Every theme in a configuration must declare
 * the exact same keys.
 *
 * @example
 * ```ts
 * const light: ThemeDefinition = { background: '#ffffff', textPrimary: '#111' }
 * const dark: ThemeDefinition  = { background: '#111111', textPrimary: '#fff' }
 * ```
 */
export type ThemeDefinition = Record<string, string>

/**
 * Origin point for reveal-style transitions.
 *
 * @remarks
 * Coordinates are relative to the root provider view and use React Native
 * density-independent points (not raw pixels). In most layouts the root
 * fills the screen, so `{ x, y }` matches screen coordinates.
 */
export interface TransitionOrigin {
  /** Horizontal offset in points from the left edge of the provider. */
  x: number
  /** Vertical offset in points from the top edge of the provider. */
  y: number
}

/**
 * Origin for a reveal transition — either an explicit point or a React ref
 * whose center will be measured at call time.
 *
 * @remarks
 * When a ref is passed, the library calls `measure()` on the target view
 * just before the animation starts. If the view has unmounted or returns
 * no coordinates, the transition falls back to the center of the screen.
 *
 * @example
 * ```ts
 * // Explicit point
 * setTheme('dark', { transition: 'circularReveal', origin: { x: 100, y: 200 } })
 *
 * // Ref — centered on the pressed button
 * const buttonRef = useRef<View>(null)
 * setTheme('dark', { transition: 'circularReveal', origin: buttonRef })
 * ```
 */
export type OriginSpec = TransitionOrigin | React.RefObject<View | null>

/**
 * Union of theme names available in a theme configuration.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export type ThemeNames<T extends Record<string, ThemeDefinition>> = keyof T & string

/**
 * Union of token names shared across all themes in a configuration.
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export type TokenNames<T extends Record<string, ThemeDefinition>> = keyof T[ThemeNames<T>] & string

/**
 * Maps OS color schemes (`'light'` / `'dark'`) to theme names.
 *
 * @remarks
 * Required when your themes are not named `'light'` and `'dark'`.
 * Both keys must be provided.
 *
 * @example
 * ```ts
 * systemThemeMap: { light: 'daylight', dark: 'midnight' }
 * ```
 *
 * @typeParam Names - Union of theme name strings.
 */
export type SystemThemeMap<Names extends string> = Record<'light' | 'dark', Names>

/**
 * Configuration for {@link createThemeTransition}.
 *
 * @remarks
 * Every field except `themes` is optional and has a sensible default. All
 * callback ordering follows this sequence on every animated transition:
 *
 * 1. `config.onTransitionStart`
 * 2. `options.onTransitionStart` (per-call, if provided)
 * 3. animation plays
 * 4. `config.onTransitionEnd`
 * 5. `options.onTransitionEnd` (per-call, if provided)
 * 6. `onThemeChange`
 *
 * For instant switches (`animated: false` or Reduce Motion), only
 * `onThemeChange` fires.
 *
 * @example
 * ```ts
 * const { ThemeTransitionProvider, useTheme } = createThemeTransition({
 *   themes: {
 *     light: { background: '#fff', text: '#111' },
 *     dark:  { background: '#111', text: '#fff' },
 *   },
 *   transition: 'circularReveal',
 *   duration: 450,
 *   onThemeChange: (name) => console.log('theme is now', name),
 * })
 * ```
 *
 * @typeParam T - Your application's theme map, keyed by theme name.
 */
export interface ThemeTransitionConfig<T extends Record<string, ThemeDefinition>> {
  /**
   * All available themes keyed by name.
   *
   * @remarks
   * Every theme must share the exact same token keys. Mismatched keys
   * throw at initialization. The name `'system'` is reserved.
   */
  themes: T

  /**
   * Whether theme changes animate by default.
   *
   * @remarks
   * When `false`, every `setTheme` and `select` call switches instantly
   * unless the caller explicitly opts in with `{ animated: true }`. Useful
   * for apps that want fully instant switching without per-call opt-outs.
   *
   * @default true
   */
  animated?: boolean

  /**
   * Global duration override in milliseconds for every transition.
   *
   * @remarks
   * Precedence: per-call `setTheme(name, { duration })` wins over this,
   * which wins over each transition's per-kind default.
   *
   * Leave unset to let each transition use its own per-kind default:
   * 350ms for `fade` / `circularReveal` / `wipe` / `slide` / `split`,
   * 800ms for `heart` / `star`, 750ms for `pixelize` /
   * `dissolve`.
   *
   * @default per-kind default (see above)
   */
  duration?: number

  /**
   * Default transition animation type.
   *
   * @remarks
   * Override per call via `setTheme(name, { transition })`.
   *
   * @default 'fade'
   */
  transition?: TransitionType

  /**
   * Honor the OS "Reduce Motion" accessibility setting.
   *
   * @remarks
   * When `true` and the user has Reduce Motion enabled in system settings,
   * every theme change skips the animation and switches instantly. This is
   * independent of {@link animated} — it only takes effect when an
   * animation would otherwise run. Read the current value in your own UI
   * via the exported `useReducedMotion()` hook.
   *
   * @default true
   */
  reduceMotion?: boolean

  /**
   * Maps OS appearance (`'light'` / `'dark'`) to your theme names.
   *
   * @remarks
   * Only needed when your themes are NOT named literally `'light'` and
   * `'dark'` and you want to use `initialTheme="system"` or
   * `setTheme('system')`. Both entries must be provided.
   *
   * This field answers: "when the OS says dark mode, which of MY themes
   * is the dark one?" See {@link darkThemes} for the related but
   * separate "which themes should register as dark with the OS?".
   *
   * @example
   * ```ts
   * systemThemeMap: { light: 'daylight', dark: 'midnight' }
   * ```
   */
  systemThemeMap?: SystemThemeMap<ThemeNames<T>>

  /**
   * Function that picks the "root background" color from the current theme.
   *
   * @remarks
   * The library paints this color behind the children tree so that any
   * transparent regions produced during the snapshot capture (for example,
   * the area below a scrolled `ScrollView` on Android, where `view.draw`
   * can leave gaps) fall back to the theme's background instead of the
   * activity's window color (which is typically white).
   *
   * If you omit it, the library uses the first token in the current theme
   * — which works if your first token is the background color, but for
   * anything else you should set this explicitly:
   *
   * @example
   * ```ts
   * createThemeTransition({
   *   themes: { light: { bg: '#fff', text: '#111' }, ... },
   *   backgroundColor: (colors) => colors.bg,
   * })
   * ```
   *
   * Since the library already paints this color behind your tree, you
   * usually don't need a background on your own root `ScrollView`. If
   * you do set one, put it on `contentContainerStyle` — NOT on the
   * ScrollView's `style` — otherwise Android's native drawing cache
   * will leave off-screen regions stuck on the previous theme's color
   * after a swap. See the Android ScrollView entry in the
   * Troubleshooting guide for details.
   *
   * @default `Object.values(colors)[0]` (the first token in each theme)
   */
  backgroundColor?: (colors: Record<TokenNames<T>, string>) => string

  /**
   * Theme names that should register as a dark color scheme with the OS.
   *
   * @remarks
   * The library calls `Appearance.setColorScheme` so native UI (alerts,
   * date pickers, keyboards) matches your active theme. Themes listed here
   * register as `'dark'`; all others register as `'light'`. In system
   * mode, `'unspecified'` is used so the OS drives the appearance.
   *
   * **You only need to set this when you have two or more dark themes**
   * (e.g. `['dark', 'midnight']`). With a single dark theme the library
   * auto-derives it from `systemThemeMap.dark`, or falls back to `['dark']`.
   *
   * Complements {@link systemThemeMap}: `systemThemeMap` tells the library
   * how to RESOLVE `'system'`; `darkThemes` tells the OS how your active
   * theme should be classified.
   *
   * **Do not call `Appearance.setColorScheme` yourself.** The library
   * tracks system-mode internally; manual calls can desync that state and
   * cause the next `setTheme('system')` to misbehave on Android.
   *
   * @example
   * ```ts
   * createThemeTransition({
   *   themes: { light, dark, midnight, rose },
   *   darkThemes: ['dark', 'midnight'],
   *   systemThemeMap: { light: 'light', dark: 'dark' },
   * })
   * ```
   *
   * @default `[systemThemeMap.dark]` when `systemThemeMap` is provided, otherwise `['dark']`.
   */
  darkThemes?: ThemeNames<T>[]

  /**
   * Fires when an animated transition begins, before the snapshot capture.
   *
   * @remarks
   * Runs for every animated transition, including system-driven ones.
   * Does not run for instant switches (`animated: false` or Reduce Motion).
   * Not guaranteed to have a matching `onTransitionEnd` — if the capture
   * fails mid-transition, only `onThemeChange` fires on the fallback.
   *
   * @param themeName - The theme becoming active.
   */
  onTransitionStart?: (themeName: ThemeNames<T>) => void

  /**
   * Fires after an animated transition completes and the overlay is removed.
   *
   * @remarks
   * Runs for every animated transition. Does not run for instant switches
   * or when snapshot capture fails mid-transition.
   *
   * @param themeName - The theme that is now active.
   */
  onTransitionEnd?: (themeName: ThemeNames<T>) => void

  /**
   * Fires whenever the active theme changes, regardless of path.
   *
   * @remarks
   * Runs for animated transitions (after `onTransitionEnd`), instant
   * switches, system-driven OS appearance changes, and capture-failure
   * fallbacks. Use this as your single source of truth for "theme is now
   * X" side effects (analytics, persistence).
   *
   * @param themeName - The theme that is now active.
   */
  onThemeChange?: (themeName: ThemeNames<T>) => void
}

/**
 * Options shared by every transition variant in {@link SetThemeOptions}.
 *
 * @typeParam Names - Union of theme name strings.
 */
interface BaseSetThemeOptions<Names extends string = string> {
  /**
   * Whether to animate this specific theme change.
   *
   * @remarks
   * When `false`, the theme switches instantly — no snapshot, no overlay.
   * Overrides the config-level {@link ThemeTransitionConfig.animated}.
   *
   * @default `config.animated ?? true`
   */
  animated?: boolean

  /**
   * Transition duration in milliseconds. Overrides the config-level default
   * and any per-kind defaults.
   *
   * Precedence when omitted: per-call > config.duration > per-kind default
   * from `TRANSITION_META` (350ms for fade / reveal / strip, 800ms for shape,
   * 750ms for shader).
   */
  duration?: number

  /**
   * Easing function for the animation. Accepts any Reanimated
   * `EasingFunction` (a worklet-safe `(t: number) => number`).
   *
   * @default `Easing.out(Easing.cubic)`
   *
   * @example
   * ```ts
   * import { Easing } from 'react-native-reanimated'
   * setTheme('dark', { easing: Easing.inOut(Easing.quad) })
   * ```
   */
  easing?: (t: number) => number

  /**
   * Per-call transition-start callback.
   *
   * @remarks
   * Runs in addition to {@link ThemeTransitionConfig.onTransitionStart} —
   * the config-level callback fires first, then this one. Only called when
   * `animated` is truthy.
   *
   * @param themeName - The target theme name.
   */
  onTransitionStart?: (themeName: Names) => void

  /**
   * Per-call transition-end callback.
   *
   * @remarks
   * Runs after {@link ThemeTransitionConfig.onTransitionEnd}. Not called if
   * snapshot capture fails — in that case the library falls back to an
   * instant switch and only `onThemeChange` fires.
   *
   * @param themeName - The theme that is now active.
   */
  onTransitionEnd?: (themeName: Names) => void
}

/**
 * Fade — the old snapshot fades its opacity to zero, revealing the new
 * theme underneath. This is the default transition, so you can omit the
 * `transition` field entirely.
 */
interface FadeVariant {
  transition?: 'fade'
}

/**
 * Reveal-style transitions: a shape (circle, heart, star) grows
 * out of a point, uncovering the new theme as it expands.
 *
 * @remarks
 * Set `inverted: true` to flip the animation — the new theme fills the
 * screen immediately and the old theme *shrinks* inside the shape until
 * it vanishes. Useful for dismissal-style effects.
 */
interface RevealVariant {
  transition: 'circularReveal' | 'heart' | 'star'
  /**
   * Point or ref where the shape expands from (or shrinks into, when
   * `inverted`).
   *
   * @default Center of the screen.
   */
  origin?: OriginSpec
  /**
   * Reverse the direction: the new theme fills the screen and the old
   * theme shrinks inside the shape until gone.
   *
   * @default false
   */
  inverted?: boolean
}

/**
 * Wipe / Slide — reveal the new theme via a directional effect.
 *
 * @remarks
 * - `'wipe'` clips the old snapshot so the new theme is revealed as the
 *   wipe edge sweeps across the screen. `direction: 'right'` sweeps from
 *   the left edge to the right edge.
 * - `'slide'` captures a second snapshot of the new theme and pushes
 *   both snapshots across the screen like a carousel — the old slides
 *   out one edge and the new slides in from `direction`. `direction: 'right'`
 *   pushes the old frame leftward off-screen and reveals the new one
 *   entering from the right.
 */
interface WipeVariant {
  transition: 'wipe' | 'slide'
  /**
   * Cardinal direction of the effect. For `'wipe'`, the direction the wipe
   * edge sweeps toward. For `'slide'`, the edge the new theme enters from.
   * @default 'left'
   */
  direction?: WipeDirection
}

/**
 * Split — the screen is split in two along the chosen axis. Two visually
 * distinct effects depending on `inverted`:
 *
 * - **Parting** (`inverted: false`, default): the new theme appears as a
 *   strip at the center of the screen and grows toward both edges — the
 *   old theme "parts" like curtains.
 * - **Shutters** (`inverted: true`): the new theme appears at the two
 *   edges and grows toward the center — the old theme gets squeezed into
 *   a shrinking strip at the middle, like closing shutters.
 */
interface SplitVariant {
  transition: 'split'
  /**
   * Axis the split runs along. `'horizontal'` splits the screen into top
   * and bottom halves; `'vertical'` into left and right halves.
   * @default 'horizontal'
   */
  axis?: SplitAxis
  /**
   * Swap the effect from parting (center-to-edges) to shutters
   * (edges-to-center).
   * @default false
   */
  inverted?: boolean
}

/**
 * Pixelize — captures a snapshot of both the old and new themes and
 * crossfades them through a shared pixel grid. The block size ramps up
 * to `blockSize` at the midpoint and back down, so both frames dissolve
 * into mosaic at the peak and resolve into clarity at the endpoints.
 */
interface PixelizeVariant {
  transition: 'pixelize'
  /**
   * Maximum pixel block size in points. Higher values produce a chunkier
   * mosaic at the peak of the effect.
   * @default 52
   */
  blockSize?: number
}

/**
 * Dissolve — the old snapshot disintegrates via noise threshold, with
 * random speckles turning transparent until the new theme is fully visible.
 */
interface DissolveVariant {
  transition: 'dissolve'
  /**
   * Noise cell size in points. Higher values produce bigger, more visible
   * specks; lower values give a finer sand texture.
   * @default 5
   */
  grainSize?: number
}

/**
 * Options for {@link UseThemeResult.setTheme}.
 *
 * @remarks
 * The `transition` field selects a variant and determines which extra
 * options are valid for that variant. TypeScript rejects invalid
 * combinations at compile time — e.g. passing `direction` when
 * `transition` is `'fade'` is a type error.
 *
 * @example
 * ```ts
 * // Default fade
 * setTheme('dark')
 *
 * // Circular reveal from a pressed button, 500ms
 * setTheme('dark', {
 *   transition: 'circularReveal',
 *   origin: buttonRef,
 *   duration: 500,
 * })
 *
 * // Wipe to the right
 * setTheme('dark', { transition: 'wipe', direction: 'right' })
 *
 * // Pixelize with custom block size
 * setTheme('dark', { transition: 'pixelize', blockSize: 40 })
 *
 * // Inverted heart — old theme shrinks into a heart shape
 * setTheme('dark', { transition: 'heart', origin: ref, inverted: true })
 * ```
 *
 * @typeParam Names - Union of theme name strings.
 */
export type SetThemeOptions<Names extends string = string> = BaseSetThemeOptions<Names> &
  (FadeVariant | RevealVariant | WipeVariant | SplitVariant | PixelizeVariant | DissolveVariant)

/**
 * Distributive `Omit` — applies `Omit` to each member of a union
 * independently, preserving the discriminated-union structure.
 * @internal
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * Options for {@link UseThemeResult.select}.
 *
 * @remarks
 * Same discriminated union as {@link SetThemeOptions}, minus `animated`
 * and the transition callbacks — `select` always animates (subject to
 * config-level `animated` / `reduceMotion`) and manages its own timing.
 *
 * @example
 * ```ts
 * const { select } = useTheme()
 * select('dark', { transition: 'circularReveal', origin: ref })
 * ```
 *
 * @typeParam Names - Union of theme name strings.
 */
export type SelectOptions<Names extends string = string> = DistributiveOmit<
  SetThemeOptions<Names>,
  'animated' | 'onTransitionStart' | 'onTransitionEnd'
>

/**
 * Return type of the {@link ThemeTransitionAPI.useTheme | useTheme} hook.
 *
 * @remarks
 * A single object with everything a component needs: the current resolved
 * theme colors, transition controls (`setTheme`), and selection tracking
 * (`selected` + `select`) for picker UIs.
 *
 * @typeParam Tokens - Union of token name strings.
 * @typeParam Names - Union of theme name strings.
 */
export interface UseThemeResult<Tokens extends string, Names extends string> {
  /**
   * Current resolved color values for every token.
   *
   * @remarks
   * Re-renders the consumer whenever the theme changes. The object is a
   * fresh snapshot of the active theme — the transition animation itself
   * runs on a captured overlay, not on these values.
   */
  colors: Record<Tokens, string>

  /**
   * The currently active theme name.
   *
   * @remarks
   * Always the *resolved* theme, never the literal string `'system'`. In
   * system mode, this holds whichever theme the OS appearance resolves to
   * (e.g. `'light'` or `'dark'`).
   */
  name: Names

  /**
   * Switch to a new theme or enter system mode.
   *
   * @param name - Target theme name or `'system'`.
   * @param options - Optional transition configuration.
   * @returns `true` when the call is accepted — either state changed
   *          immediately (instant path) or an animated transition was
   *          started. `false` when the call is a no-op: same theme and
   *          same mode, or another transition is already in flight
   *          (rapid-press guard).
   *
   * @remarks
   * `true` means "accepted and started", not "completed successfully".
   * If snapshot capture fails mid-transition, the library falls back
   * to an instant switch and fires `onThemeChange` without a matching
   * `onTransitionEnd`. Design start/end handlers to tolerate that.
   *
   * @example
   * ```ts
   * const started = setTheme('dark', { transition: 'circularReveal', origin: ref })
   * if (!started) {
   *   // rejected — same theme, or a previous transition is still running
   * }
   * ```
   */
  setTheme: (name: Names | 'system', options?: SetThemeOptions<Names>) => boolean

  /**
   * `true` while a transition overlay is visible on screen.
   *
   * @remarks
   * Use this to disable interactive controls (theme picker buttons,
   * toggles) during a transition so users don't trigger a second one that
   * would be rejected. Touch input is also blocked internally via a
   * Reanimated shared value, but this flag lets you show visual feedback
   * (e.g. `disabled={isTransitioning}`).
   */
  isTransitioning: boolean

  /**
   * The currently selected option.
   *
   * @remarks
   * Always defined. Seeded from the active theme name on mount, or from
   * `initialSelection` when the hook is called with that option. May be
   * `'system'` even when `name` holds the resolved OS theme.
   */
  selected: Names | 'system'

  /**
   * Select a theme with transition-safe timing.
   *
   * @remarks
   * Prefer `select` over `setTheme` whenever a visual indicator (highlight,
   * toggle thumb, checkmark) must match the chosen theme. `select` differs
   * from `setTheme` in three ways:
   *
   * 1. Updates `selected` synchronously so the pressed highlight paints
   *    immediately.
   * 2. Defers the underlying `setTheme` by one `requestAnimationFrame`
   *    so that highlight is included in the captured snapshot.
   * 3. Animation follows the provider-level `animated` flag and Reduce
   *    Motion — you can't opt out per call, and `select` doesn't accept
   *    `animated` or transition callbacks.
   *
   * Rapid presses during an ongoing transition are silently ignored.
   *
   * @param option - Theme name or `'system'`.
   * @param options - Transition configuration (no `animated` or callbacks).
   *
   * @example
   * ```tsx
   * function ThemePicker() {
   *   const { selected, select, isTransitioning } = useTheme()
   *   return (
   *     <View style={{ flexDirection: 'row', gap: 8 }}>
   *       {(['light', 'dark'] as const).map((option) => (
   *         <Pressable
   *           key={option}
   *           onPress={() => select(option)}
   *           disabled={isTransitioning}
   *         >
   *           <Text>{option === selected ? '●' : '○'} {option}</Text>
   *         </Pressable>
   *       ))}
   *     </View>
   *   )
   * }
   * ```
   */
  select: (option: Names | 'system', options?: SelectOptions<Names>) => void
}

/**
 * Options for the {@link ThemeTransitionAPI.useTheme | useTheme} hook.
 *
 * @typeParam Names - Union of theme name strings.
 */
export interface UseThemeOptions<Names extends string = string> {
  /**
   * Seed value for `selected` on the first render.
   *
   * @remarks
   * Read once, like the initializer argument to `useState`. Defaults to
   * the active theme name. Pass `'system'` or a specific theme only when
   * you want the initial highlight to differ from the current theme —
   * e.g. hydrating a picker from a persisted store.
   */
  initialSelection?: Names | 'system'
}

/**
 * Subset of {@link UseThemeResult} stored in React Context by the provider.
 *
 * @remarks
 * `selected` and `select` are owned by the `useTheme` hook's own state,
 * not by the provider. The `useTheme` hook pulls this subset from context
 * and augments it with selection state before returning `UseThemeResult`.
 *
 * @internal Boundary type between provider and hook — exported only for
 *           cross-file typing within the library.
 */
export type ThemeContextValue<Tokens extends string, Names extends string> = Pick<
  UseThemeResult<Tokens, Names>,
  'colors' | 'name' | 'setTheme' | 'isTransitioning'
>

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
   * Place this as high as possible in the component tree — ideally wrapping
   * your navigation container — so the snapshot can capture the entire
   * screen during transitions. Anything rendered outside the provider will
   * not appear in the captured overlay and may flash.
   */
  ThemeTransitionProvider: React.FC<{
    /** Your app tree. */
    children: React.ReactNode
    /**
     * Theme to render on the first frame.
     *
     * @remarks
     * Read once on mount (like the initializer of `useState`); later changes
     * to this prop are ignored — switch themes at runtime with
     * {@link UseThemeResult.setTheme | setTheme}. Pass `'system'` to read the
     * OS appearance synchronously (zero-flash) and subscribe to changes. For
     * custom theme names, provide
     * {@link ThemeTransitionConfig.systemThemeMap | systemThemeMap} in the config.
     */
    initialTheme: ThemeNames<T> | 'system'
  }>

  /**
   * Hook returning the full theme state, transition controls, and selection
   * tracking in a single object.
   *
   * @remarks
   * Always returns `colors`, `name`, `setTheme`, `isTransitioning`,
   * `selected`, and `select`. Use `setTheme` for programmatic changes
   * (settings screen, deep links, logic-driven switches) and `select` for
   * user-driven picker UIs where a highlight must match the transition.
   *
   * `selected` is seeded from the active theme on mount. Pass
   * `{ initialSelection }` only when you want the initial highlight to
   * differ from the current theme (e.g. hydrating a picker from a
   * persisted store that remembers `'system'`).
   *
   * @throws If called outside a `ThemeTransitionProvider`.
   *
   * @example
   * ```tsx
   * // Reading colors in any component
   * const { colors, name } = useTheme()
   *
   * // Full selection tracking
   * const { selected, select, isTransitioning } = useTheme()
   *
   * // With an initial selection override (e.g. Zustand hydration)
   * const { selected, select } = useTheme({ initialSelection: colorMode })
   * ```
   */
  useTheme: (
    options?: UseThemeOptions<ThemeNames<T>>,
  ) => UseThemeResult<TokenNames<T>, ThemeNames<T>>
}
