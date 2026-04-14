/**
 * Single source of truth for transition types and their per-type behavior.
 *
 * Adding a new transition here automatically propagates to the
 * `TransitionType` union, the config validator, origin-requirement checks,
 * and default durations.
 *
 * @module
 */

/**
 * High-level grouping of transitions by how they render, used for shared
 * defaults (e.g. all `'shape'` transitions share the 800ms default).
 *
 * - `'fade'` — the overlay's opacity animates to zero.
 * - `'reveal'` — a growing (or shrinking) circular shape clipped out of the overlay.
 * - `'shape'` — a reveal that uses a custom path (`heart`, `star`).
 * - `'shader'` — a runtime Skia shader effect (`pixelize`, `dissolve`).
 * - `'strip'` — rectangular regions sliding or clearing across the screen
 *   (`wipe` edge, `slide` carousel push, `split` parting/shutters).
 */
export type TransitionKind = 'fade' | 'reveal' | 'shape' | 'shader' | 'strip'

/** @internal Shape constraint for entries in {@link TRANSITION_META}. */
interface TransitionMeta {
  kind: TransitionKind
  needsOrigin: boolean
  invertible: boolean
  /**
   * Whether the engine needs a second snapshot captured from the view
   * AFTER the theme swap, so the transition can render both the old and
   * new themes simultaneously (e.g. `slide`, `pixelize`).
   */
  capturesNew: boolean
  defaultDuration: number
}

/**
 * Per-transition metadata table.
 *
 * Every supported transition has an entry declaring:
 * - `kind` — the rendering family (`'fade'`, `'reveal'`, `'shape'`, `'shader'`, `'strip'`).
 * - `needsOrigin` — whether the engine should resolve an `origin` before
 *   running the transition (reveals and shape transitions do).
 * - `invertible` — whether the transition accepts the `inverted` option.
 *   Flips reveal/shape transitions (shape shrinks instead of grows) and
 *   toggles `split` between parting and shutters.
 * - `capturesNew` — whether the engine needs a second snapshot of the new
 *   theme captured after the color swap, so the transition can render both
 *   old and new simultaneously (`slide`, `pixelize`).
 * - `defaultDuration` — milliseconds used when no per-call or config-level
 *   `duration` is set.
 *
 * Use this table to drive UIs that adapt to the selected transition, for
 * example showing an "Inverted" toggle only when `invertible` is `true`.
 *
 * @example
 * ```tsx
 * import { TRANSITION_META, TRANSITION_TYPES } from 'react-native-theme-transition'
 *
 * // Build an options panel that adapts to the selected transition:
 * const meta = TRANSITION_META[transition]
 * return (
 *   <>
 *     {TRANSITION_TYPES.map((t) => <Chip key={t} label={t} />)}
 *     {meta.invertible && <Toggle label="Inverted" />}
 *     {meta.needsOrigin && <OriginPicker />}
 *   </>
 * )
 * ```
 */
export const TRANSITION_META = {
  fade: {
    kind: 'fade',
    needsOrigin: false,
    invertible: false,
    capturesNew: false,
    defaultDuration: 350,
  },
  circularReveal: {
    kind: 'reveal',
    needsOrigin: true,
    invertible: true,
    capturesNew: false,
    defaultDuration: 350,
  },
  wipe: {
    kind: 'strip',
    needsOrigin: false,
    invertible: false,
    capturesNew: false,
    defaultDuration: 350,
  },
  slide: {
    kind: 'strip',
    needsOrigin: false,
    invertible: false,
    capturesNew: true,
    defaultDuration: 350,
  },
  split: {
    kind: 'strip',
    needsOrigin: false,
    invertible: true,
    capturesNew: false,
    defaultDuration: 350,
  },
  heart: {
    kind: 'shape',
    needsOrigin: true,
    invertible: true,
    capturesNew: false,
    defaultDuration: 800,
  },
  star: {
    kind: 'shape',
    needsOrigin: true,
    invertible: true,
    capturesNew: false,
    defaultDuration: 800,
  },
  pixelize: {
    kind: 'shader',
    needsOrigin: false,
    invertible: false,
    capturesNew: true,
    defaultDuration: 750,
  },
  dissolve: {
    kind: 'shader',
    needsOrigin: false,
    invertible: false,
    capturesNew: false,
    defaultDuration: 750,
  },
} as const satisfies Record<string, TransitionMeta>

/**
 * Union of every supported transition name. Derived automatically from the
 * {@link TRANSITION_META} table — adding an entry there also adds it here.
 */
export type TransitionType = keyof typeof TRANSITION_META

/**
 * Runtime list of every supported transition name. Use this to build
 * pickers or validate user input without hardcoding the set.
 *
 * @example
 * ```ts
 * import { TRANSITION_TYPES } from 'react-native-theme-transition'
 *
 * TRANSITION_TYPES.map((type) => (
 *   <Button key={type} onPress={() => setTheme('dark', { transition: type })}>
 *     {type}
 *   </Button>
 * ))
 * ```
 */
export const TRANSITION_TYPES = Object.keys(TRANSITION_META) as TransitionType[]

/** @internal Direction for `wipe` and `slide` transitions. */
export type WipeDirection = 'left' | 'right' | 'up' | 'down'

/** @internal Axis for `split` transitions. */
export type SplitAxis = 'horizontal' | 'vertical'
