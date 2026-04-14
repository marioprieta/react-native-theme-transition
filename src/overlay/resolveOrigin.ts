/**
 * Origin resolution for transitions that emanate from a point
 * (`circularReveal`, `heart`, `star`).
 * @module
 * @internal
 */

import type { View } from 'react-native'
import type { OriginSpec, TransitionOrigin } from '../types'

/** Measures the center point of a View ref. Returns `null` if measurement fails. @internal */
export function measureCenter(ref: React.RefObject<View | null>): TransitionOrigin | null {
  if (!ref.current) return null
  try {
    let result: TransitionOrigin | null = null
    ref.current.measure(
      (_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
        result = { x: pageX + w / 2, y: pageY + h / 2 }
      },
    )
    return result
  } catch {
    return null
  }
}

/** Type guard: is this `OriginSpec` a ref rather than a `{x,y}` point? @internal */
export function isOriginRef(value: OriginSpec): value is React.RefObject<View | null> {
  return 'current' in value
}

/**
 * Resolves an {@link OriginSpec} (point or ref) to concrete coordinates.
 * Falls back to the screen center if `origin` is missing or the ref
 * measurement fails.
 * @internal
 */
export function resolveOrigin(
  origin: OriginSpec | undefined,
  screenWidth: number,
  screenHeight: number,
): TransitionOrigin {
  if (origin) {
    if (isOriginRef(origin)) {
      const measured = measureCenter(origin)
      if (measured) return measured
    } else {
      return origin
    }
  }
  return { x: screenWidth / 2, y: screenHeight / 2 }
}

/**
 * Radius from `origin` to the farthest screen corner.
 *
 * @remarks
 * A circular reveal with this radius is guaranteed to fully cover the
 * screen at the end frame.
 * @internal
 */
export function calculateMaxRadius(
  ox: number,
  oy: number,
  screenWidth: number,
  screenHeight: number,
): number {
  return Math.hypot(Math.max(ox, screenWidth - ox), Math.max(oy, screenHeight - oy))
}
