/**
 * Immutable Skia path commands for the heart and star reveal overlays.
 *
 * @remarks
 * Shape modes animate between two keyframes of the same contour with
 * `interpolatePaths`, which requires both keyframes to share the
 * exact same verb topology. `@shopify/react-native-skia` 2.14 removed
 * the mutable `SkPath` API (`moveTo`, `cubicTo`, `close`), so every
 * contour is built as a list of per-verb `PathCommand` arrays and
 * handed to `Skia.Path.MakeFromCmds` in a single call. The command
 * builders are pure functions so the geometry can be regression tested
 * without a native Skia runtime.
 *
 * @module
 * @internal
 */

import type { PathCommand, SkPath } from '@shopify/react-native-skia'
import { PathVerb, Skia } from '@shopify/react-native-skia'

/**
 * @internal Empirically tuned heart bezier reach factors. The bounding
 * math in `useHeartPath` reads these to compute the smallest scale at
 * which the path covers every screen corner. Kept next to the path
 * builder so the bounds and the curve stay in sync when either is
 * tweaked.
 */
export const HEART_REACH = {
  /** Bottom tip y-distance from `cy`, in heart-units. */
  bottomTip: 0.7,
  /** Top notch dip from `cy`, in heart-units (negative y). */
  topNotch: 0.55,
  /** Outer lobe x-reach in heart-units. */
  lobeX: 1.2,
  /** Outer lobe y-reach above `cy`, in heart-units. */
  lobeY: 0.9,
  /** Bezier control x for the inner curve into the bottom tip. */
  innerLobeX: 0.7,
  /** Y-reach factor for the bottom corners (`+y` direction). */
  bottomCornerY: 0.65,
  /** Y-reach factor for the top corners (`-y` direction, lobe rises higher). */
  topCornerY: 0.75,
} as const

/**
 * @internal Star geometry. `innerRatio` is the valley-to-tip ratio
 * (5-point star with deep valleys). `outerPadding` over-extends the
 * tips past the screen corner so the inner valleys still cover them.
 */
export const STAR_GEOMETRY = { points: 5, innerRatio: 0.4, outerPadding: 1.05 } as const

/**
 * @internal Heart contour as immutable Skia commands: one `Move` to
 * the bottom tip, two `Cubic` lobes, one `Close`. Both keyframes must
 * use this exact verb sequence so they stay interpolatable.
 */
export function heartCommands(cx: number, cy: number, w: number, h: number): PathCommand[] {
  return [
    [PathVerb.Move, cx, cy + h * HEART_REACH.bottomTip],
    [
      PathVerb.Cubic,
      cx - w * HEART_REACH.lobeX,
      cy + h * 0.1,
      cx - w * HEART_REACH.innerLobeX,
      cy - h * HEART_REACH.lobeY,
      cx,
      cy - h * HEART_REACH.topNotch,
    ],
    [
      PathVerb.Cubic,
      cx + w * HEART_REACH.innerLobeX,
      cy - h * HEART_REACH.lobeY,
      cx + w * HEART_REACH.lobeX,
      cy + h * 0.1,
      cx,
      cy + h * HEART_REACH.bottomTip,
    ],
    [PathVerb.Close],
  ]
}

/**
 * @internal Star contour as immutable Skia commands: one `Move`, nine
 * `Line`s alternating outer tip and inner valley, one `Close`.
 */
export function starCommands(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
): PathCommand[] {
  const commands: PathCommand[] = []
  const step = Math.PI / STAR_GEOMETRY.points
  const start = -Math.PI / 2
  for (let i = 0; i < STAR_GEOMETRY.points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = start + i * step
    commands.push([
      i === 0 ? PathVerb.Move : PathVerb.Line,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
    ])
  }
  commands.push([PathVerb.Close])
  return commands
}

/**
 * @internal Builds an `SkPath` from immutable commands. `MakeFromCmds`
 * returns `null` instead of throwing when Skia rejects the list; that
 * would leave the overlay with no clip, so fail loudly with the shape
 * name instead.
 */
function makeShapePath(shape: 'heart' | 'star', commands: PathCommand[]): SkPath {
  const path = Skia.Path.MakeFromCmds(commands)
  if (path === null) {
    throw new Error(
      `[react-native-theme-transition] Skia.Path.MakeFromCmds returned null while building the ${shape} reveal path. ` +
        'Check that @shopify/react-native-skia supports this path command list.',
    )
  }
  return path
}

/** @internal Immutable heart path at the given center and size. */
export function makeHeartPath(cx: number, cy: number, w: number, h: number): SkPath {
  return makeShapePath('heart', heartCommands(cx, cy, w, h))
}

/** @internal Immutable star path at the given center and radii. */
export function makeStarPath(cx: number, cy: number, rOuter: number, rInner: number): SkPath {
  return makeShapePath('star', starCommands(cx, cy, rOuter, rInner))
}

/** @internal Order keyframes so `progress` 0 → 1 grows the shape (or shrinks if inverted). */
export function orderKeyframes(inverted: boolean, tiny: SkPath, full: SkPath): SkPath[] {
  return inverted ? [full, tiny] : [tiny, full]
}
