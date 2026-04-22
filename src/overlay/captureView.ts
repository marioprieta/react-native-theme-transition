/**
 * View-snapshot capture via Skia's `makeImageFromView`.
 * @module
 * @internal
 */

import type { SkImage } from '@shopify/react-native-skia'
import { makeImageFromView } from '@shopify/react-native-skia'
import type { RefObject } from 'react'
import type { View } from 'react-native'

/**
 * Captures a CPU-backed snapshot of the given view. Returns `null` if the
 * capture fails (e.g. the view has unmounted or Skia is unavailable).
 * @internal
 */
export async function captureView(ref: RefObject<View | null>): Promise<SkImage | null> {
  try {
    const gpuImage = await makeImageFromView(ref)
    if (!gpuImage) return null
    // Convert to CPU-backed so the snapshot renders in a separate GL
    // context (Skia Canvas). `finally` guarantees the GPU image is
    // released even if the conversion throws.
    try {
      return gpuImage.makeNonTextureImage()
    } finally {
      gpuImage.dispose()
    }
  } catch {
    return null
  }
}
