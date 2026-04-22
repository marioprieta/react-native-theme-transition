/**
 * Internal types and defaults for the Skia overlay pipeline.
 *
 * `OverlayParams` is the frozen snapshot of a single transition's
 * parameters, constructed by the engine in `runTransition` and
 * consumed by `SkiaOverlay`. Everything the overlay needs to render a
 * single animation lives here, so rotation / orientation changes
 * mid-transition can't drift between the engine's measurements and the
 * overlay's render.
 *
 * @module
 * @internal
 */

import type { SplitMode, TransitionType, WipeDirection } from '../transitionMeta'

/** @internal Render mode for the overlay. Distinct from `TransitionType`
 * because the overlay speaks in "how to render", not "which user-facing
 * transition was picked". Currently 1:1 with `TransitionType`. */
export interface OverlayParams {
  mode: TransitionType
  origin: { x: number; y: number }
  maxRadius: number
  screenWidth: number
  screenHeight: number
  inverted: boolean
  direction: WipeDirection
  splitMode: SplitMode
  blockSize: number
  noiseSize: number
}

/**
 * @internal Pixelize shader fallback block size in points. 52 tuned
 * empirically on a 390pt-wide viewport: large enough to fully dissolve
 * face-level detail at the peak of the animation, small enough to avoid
 * obvious banding on smaller devices.
 */
export const DEFAULT_PIXELIZE_BLOCK_SIZE = 52

/**
 * @internal Dissolve shader fallback noise cell size in points. 5 reads
 * as visible grain without collapsing into chunky tiles on hi-DPI
 * screens. Smaller values approach per-pixel noise.
 */
export const DEFAULT_DISSOLVE_NOISE_SIZE = 5

/**
 * @internal Wipe/slide fallback direction. `'right'` matches the LTR
 * reading order where new content flows in from the left and progresses
 * rightward. The mental model: `setTheme(x, { direction: 'right' })`
 * means the new theme enters from the left edge. RTL-aware flipping
 * is left to the consumer.
 */
export const DEFAULT_DIRECTION: WipeDirection = 'right'

/**
 * @internal Split fallback mode. `'left-right'` splits the screen into
 * left and right halves (split line runs vertically). Consistent with
 * the wipe/slide rightward default: both strip transitions progress
 * along the horizontal axis unless the consumer asks otherwise.
 */
export const DEFAULT_SPLIT_MODE: SplitMode = 'left-right'

/**
 * Initial overlay params used while no transition is active. The Canvas
 * stays mounted with these defaults so that starting a transition doesn't
 * need a native-view layout pass (which would cause a "new theme flash"
 * on Android).
 * @internal
 */
export const DEFAULT_OVERLAY_PARAMS: OverlayParams = {
  mode: 'fade',
  origin: { x: 0, y: 0 },
  maxRadius: 0,
  screenWidth: 0,
  screenHeight: 0,
  inverted: false,
  direction: DEFAULT_DIRECTION,
  splitMode: DEFAULT_SPLIT_MODE,
  blockSize: DEFAULT_PIXELIZE_BLOCK_SIZE,
  noiseSize: DEFAULT_DISSOLVE_NOISE_SIZE,
}
