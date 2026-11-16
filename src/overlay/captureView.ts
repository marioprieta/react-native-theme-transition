/**
 * View-snapshot capture via Skia's `makeImageFromView`.
 * @module
 * @internal
 */

import type { SkImage } from '@shopify/react-native-skia'
import { makeImageFromView } from '@shopify/react-native-skia'
import type { RefObject } from 'react'
import type { ViewRef } from '../types'

// Skia 2.14 still types `makeImageFromView` for class-component refs
// (React Native <= 0.87). React Native 0.88 types view refs as host
// instances. Both are valid at runtime because the implementation only
// reads `ref.current` and resolves its native node handle, so the
// published parameter type is narrowed to the shape we actually pass.
const captureFromViewRef = makeImageFromView as unknown as (
  viewRef: RefObject<ViewRef | null>,
  callback?: null | ((viewRef: RefObject<ViewRef | null>) => Promise<SkImage | null>),
) => Promise<SkImage | null>

/**
 * Captures a CPU-backed snapshot of the given view. Returns `null` if the
 * capture fails (e.g. the view has unmounted or Skia is unavailable).
 * @internal
 */
export async function captureView(ref: RefObject<ViewRef | null>): Promise<SkImage | null> {
  try {
    const gpuImage = await captureFromViewRef(ref)
    if (!gpuImage) return null
    // Normalize to raster for cross-canvas use (Android view captures are
    // already raster). Release the source handle even if conversion throws.
    try {
      return gpuImage.makeNonTextureImage()
    } finally {
      gpuImage.dispose()
    }
  } catch {
    return null
  }
}
