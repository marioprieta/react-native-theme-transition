/**
 * Subscribe to the OS "Reduce Motion" accessibility setting.
 *
 * @module
 */

import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Returns `true` when the OS "Reduce Motion" accessibility setting is on.
 *
 * @remarks
 * The provider already skips theme transition animations automatically
 * when Reduce Motion is on (it's `reduceMotion: true` by default in
 * {@link ThemeTransitionConfig}). Use this hook when your OWN components
 * need to react to the setting — disabling unrelated animations, showing
 * a hint, or picking a static visual.
 *
 * Subscribes to `reduceMotionChanged` events and stays in sync for the
 * lifetime of the component.
 *
 * @example
 * ```tsx
 * const reduced = useReducedMotion()
 * return <Pressable style={{ transform: [{ scale: reduced ? 1 : pressScale }] }} />
 * ```
 */
export function useReducedMotion(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setEnabled(v)
    })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled)
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  return enabled
}
