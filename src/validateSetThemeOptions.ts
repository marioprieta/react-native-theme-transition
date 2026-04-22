/**
 * Pure runtime validator for the per-call options passed to `setTheme`.
 * Throws a descriptive `Error` if any numeric option falls outside its
 * supported range, so user-visible failure modes (silent NaN propagation
 * into shaders, negative-duration timers, etc.) surface immediately at
 * the call site instead of producing broken animations.
 *
 * Extracted as a pure helper so the bounds can be unit-tested without
 * mounting the provider.
 *
 * @module
 * @internal
 */

import { TAG } from './constants'
import { isOriginRef } from './overlay/resolveOrigin'
import type { OriginSpec } from './types'

/** @internal The subset of {@link SetThemeOptions} this helper checks. */
interface ValidatableOptions {
  duration?: number
  blockSize?: number
  noiseSize?: number
  origin?: OriginSpec
}

/** @internal */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Throws if any numeric option in `options` is out of range. Returns
 * silently otherwise. Safe to call with `undefined`.
 *
 * @throws Error if any numeric option is `NaN`, `Infinity`, or outside its supported range.
 * @internal
 */
export function validateSetThemeOptions(options: ValidatableOptions | undefined): void {
  if (!options) return

  if (options.duration !== undefined) {
    if (!isValidNumber(options.duration) || options.duration < 0) {
      throw new Error(
        `${TAG} \`duration\` must be a non-negative finite number. Got ${String(options.duration)}.`,
      )
    }
  }

  if (options.blockSize !== undefined) {
    if (!isValidNumber(options.blockSize) || options.blockSize < 2) {
      throw new Error(
        `${TAG} \`blockSize\` must be a finite number >= 2. Got ${String(options.blockSize)}.`,
      )
    }
  }

  if (options.noiseSize !== undefined) {
    if (!isValidNumber(options.noiseSize) || options.noiseSize < 1) {
      throw new Error(
        `${TAG} \`noiseSize\` must be a finite number >= 1. Got ${String(options.noiseSize)}.`,
      )
    }
  }

  // Refs are validated at measurement time inside `resolveOrigin`,
  // which falls back to the screen center if measurement fails. Only
  // explicit coordinate pairs are checked here.
  if (options.origin && !isOriginRef(options.origin)) {
    if (!isValidNumber(options.origin.x) || !isValidNumber(options.origin.y)) {
      throw new Error(
        `${TAG} \`origin\` coordinates must be finite numbers. Got {x: ${String(options.origin.x)}, y: ${String(options.origin.y)}}.`,
      )
    }
  }
}
