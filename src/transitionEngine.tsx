/**
 * Provider and context for the theme transition engine.
 *
 * @remarks
 * Capture and overlay both use `@shopify/react-native-skia`; a single
 * 0 → 1 `progress` shared value drives every transition kind. The
 * library has no explicit Reduce Motion check; `withTiming` inherits
 * Reanimated's system setting. `animated: false` also skips capture.
 *
 * **State machine.** Each animated transition runs the following steps
 * in order:
 *
 * 1. `setTheme`: sync writes (`transitioningRef`, `isBlocking`,
 *    `intendedThemeRef`). The config and per-call `onTransitionStart`
 *    callbacks run before capture. The user's pick is stashed in a ref
 *    until commit 2, avoiding an early context update for manual swaps.
 *    System-mode changes can still enqueue React state, and consumer
 *    callbacks may enqueue their own updates.
 * 2. **Capture old**: `captureView` grabs a CPU-backed `SkImage` of the
 *    inner tree. If capture fails, the engine falls back to an instant
 *    swap (no overlay, only `onThemeChange` fires).
 * 3. **Commit 1**: `setOverlayParams` + `setSkImage` mount the snapshot
 *    on the pre-mounted Canvas.
 * 4. **`SETTLE.overlayCommit` + `SETTLE.skiaPaintSynced`**: one frame
 *    lets the mounted snapshot reach the native Canvas,
 *    `syncOverlayPaint` then spends a Skia paint round trip on it, and
 *    one more frame allows compositing before swapping the inner tree.
 *    This is an empirical guard, not a display-presentation callback.
 *    Falls back to `SETTLE.skiaPaint` when the probe is unavailable.
 * 5. **Commit 2**: `setIsTransitioning(true)` + `setActiveTheme(new)`
 *    swap the inner tree underneath the now-covering overlay, and the
 *    stashed pick lands in `preference` in the same commit.
 * 6. **`SETTLE.treeRepaint` (conditional)**: for reveal, shape, and
 *    dual-image transitions, wait an extra frame so the inner tree
 *    has repainted in the new theme before the second capture.
 * 7. **Capture new (conditional)**: for `slide` and `pixelize`
 *    (`TRANSITION_META[kind].capturesNew === true`), capture a second
 *    snapshot of the inner tree in the new theme and mount it as
 *    `imageNew` on the overlay.
 * 8. **Animate**: Reanimated animates `progress` 0 → 1 and a
 *    `setTimeout(duration)` fires the `finish` cleanup, which resets
 *    the overlay and fires `onTransitionEnd` (config and per-call) and
 *    `onThemeChange`. If the OS appearance changed while in `'system'`
 *    mode during the transition, the pending correction fires a
 *    second `onThemeChange`.
 *
 * **Why the SkiaOverlay stays permanently mounted:** Android paints a
 * fresh native view at the same commit it gains content; if the Canvas
 * mounted at commit 1, its first paint would be empty and the
 * already-swapped inner tree would flash the new theme through for one
 * frame. Keeping the Canvas mounted with `image={null}` between
 * transitions avoids the layout pass entirely.
 *
 * @module
 * @internal
 */

import type { CanvasRef, SkImage } from '@shopify/react-native-skia'
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Appearance,
  AppState,
  Dimensions,
  type LayoutChangeEvent,
  Platform,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { ABSOLUTE_FILL, FLEX_FILL, TAG } from './constants'
import { captureView } from './overlay/captureView'
import { calculateMaxRadius, resolveOrigin } from './overlay/resolveOrigin'
import { SkiaOverlay } from './overlay/SkiaOverlay'
import {
  DEFAULT_DIRECTION,
  DEFAULT_DISSOLVE_NOISE_SIZE,
  DEFAULT_OVERLAY_PARAMS,
  DEFAULT_PIXELIZE_BLOCK_SIZE,
  DEFAULT_SPLIT_MODE,
  type OverlayParams,
} from './overlay/types'
import { decideSetTheme, preferenceWriteTiming } from './setThemeDecision'
import type { SplitMode, WipeDirection } from './transitionMeta'
import { TRANSITION_META } from './transitionMeta'
import type {
  ColorScheme,
  OriginSpec,
  SetThemeOptions,
  SystemThemeMap,
  ThemeDefinition,
  ThemeNames,
  ThemeTransitionConfig,
  TokenNames,
  TransitionType,
  UseThemeResult,
  ViewRef,
} from './types'
import { validateSetThemeOptions } from './validateSetThemeOptions'

/**
 * @internal Flat view of the public {@link SetThemeOptions} union. The
 * engine dispatches on `transition` first and reads the rest generically.
 */
interface ResolvedOptions<Names extends string> {
  animated?: boolean
  duration?: number
  easing?: (t: number) => number
  transition?: TransitionType
  origin?: OriginSpec
  inverted?: boolean
  direction?: WipeDirection
  mode?: SplitMode
  blockSize?: number
  noiseSize?: number
  onTransitionStart?: (themeName: Names) => void
  onTransitionEnd?: (themeName: Names) => void
}

/** @internal Invokes a user callback; swallows + logs throws so they can't break the pipeline. */
function safeCall<A extends unknown[]>(
  label: string,
  fn: ((...args: A) => void) | undefined,
  ...args: A
): void {
  try {
    fn?.(...args)
  } catch (e) {
    console.warn(`${TAG} ${label} threw:`, e)
  }
}

/** @internal Awaits `n` rAF ticks. The engine's settle primitive between React commits and native paint. */
function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = n
    const tick = () => {
      if (--remaining <= 0) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/**
 * @internal Frame budgets for the engine's settle points. Tuned empirically.
 *
 * - `overlayCommit` (1): lets the mounted snapshot reach the native
 *   Canvas before {@link syncOverlayPaint} probes its paint.
 * - `skiaPaintSynced` (1): after the offscreen probe completes,
 *   allow a frame for compositing; presentation is not acknowledged.
 * - `skiaPaint` (2/3): fallback when that probe is unavailable. Without
 *   it Android occasionally loses the race between the color swap and the
 *   Canvas's first paint and flashes the new theme through for a frame.
 * - `treeRepaint` (1): gives Android a frame to repaint deep
 *   ScrollView children before a reveal/shape animation exposes them
 *   through a growing hole.
 */
const SETTLE = {
  overlayCommit: 1,
  skiaPaintSynced: 1,
  skiaPaint: Platform.select({ android: 3, default: 2 }) ?? 2,
  treeRepaint: 1,
} as const

/**
 * @internal Spends a Skia paint round trip on the mounted snapshot.
 *
 * RN Skia 2.x exposes no paint callback, so the colour swap used to be gated
 * only by a frame budget; when the render thread was still uploading the
 * snapshot, the swap could show the new theme for a frame. After an
 * overlay-commit frame, `makeImageSnapshotAsync` re-renders the Canvas's
 * current picture offscreen on the main thread and reads it back. This
 * adds a measured rendering round trip while the swap stays blocked,
 * but does not acknowledge a particular React commit or on-screen paint.
 * Returns `false` when the handle or call is unavailable; callers then
 * fall back to the frame budget.
 */
async function syncOverlayPaint(ref: { current: CanvasRef | null }): Promise<boolean> {
  try {
    const canvas = ref.current
    if (!canvas) return false
    const probe = await canvas.makeImageSnapshotAsync()
    probe.dispose()
    return true
  } catch {
    return false
  }
}

/** @internal Coerces an `Appearance.getColorScheme()` return value to a {@link ColorScheme}. */
function normalizeScheme(
  colorScheme?: string | null,
  fallback: ColorScheme = 'light',
): ColorScheme {
  if (colorScheme === 'dark') return 'dark'
  if (colorScheme === 'light') return 'light'
  return fallback
}

/** @internal Maps an OS scheme to a theme name via `systemThemeMap`. */
function mapSchemeToTheme<Names extends string>(
  scheme: ColorScheme,
  mapping?: SystemThemeMap<Names>,
): Names {
  return mapping?.[scheme] ?? (scheme as Names)
}

/** @internal Reads the current OS appearance and maps it to a theme name. */
function resolveSystemTheme<Names extends string>(
  mapping?: SystemThemeMap<Names>,
  fallbackScheme?: ColorScheme,
): Names {
  return mapSchemeToTheme<Names>(
    normalizeScheme(Appearance.getColorScheme(), fallbackScheme),
    mapping,
  )
}

/** @internal Factory for a per-config Provider. Called by {@link createThemeTransition}. */
export function createProviderAndContext<T extends Record<string, ThemeDefinition>>(
  config: ThemeTransitionConfig<T>,
) {
  const {
    themes,
    animated: configAnimated = true,
    transition: configTransition = 'fade',
    systemThemeMap,
    darkThemes: darkThemesConfig,
    onTransitionStart: configOnTransitionStart,
    onTransitionEnd: configOnTransitionEnd,
    onThemeChange,
  } = config

  const darkThemeSet = new Set<string>(
    darkThemesConfig ?? (systemThemeMap ? [systemThemeMap.dark] : ['dark']),
  )
  const schemeOf = (name: string): ColorScheme => (darkThemeSet.has(name) ? 'dark' : 'light')

  type Names = ThemeNames<T>
  type Tokens = TokenNames<T>
  const Context = createContext<UseThemeResult<Tokens, Names> | null>(null)

  // Themes are frozen by the consumer's config - hand back the same
  // reference every time instead of cloning per transition.
  const colorsByName = themes as Record<Names, Record<Tokens, string>>
  const getColors = (name: Names): Record<Tokens, string> => colorsByName[name]

  function ThemeTransitionProvider({
    children,
    initialTheme,
  }: {
    children: React.ReactNode
    initialTheme: Names | 'system'
  }) {
    const [activeTheme, setActiveTheme] = useState<{ colors: Record<Tokens, string>; name: Names }>(
      () => {
        const isInitialSystem = initialTheme === 'system'
        const startTheme = isInitialSystem
          ? resolveSystemTheme<Names>(systemThemeMap)
          : initialTheme
        if (!(startTheme in themes)) {
          throw new Error(
            `${TAG} initialTheme resolved to "${startTheme}" which does not exist in themes.${
              isInitialSystem
                ? ' Provide `systemThemeMap` in the config to map OS appearance to your theme names.'
                : ''
            }`,
          )
        }
        return { colors: getColors(startTheme), name: startTheme }
      },
    )

    // Sync source of truth for the in-flight theme. Written by
    // `setTheme` before `runTransition` is awaited, so the same-theme
    // guard sees the latest intent without waiting for React to commit
    // `activeTheme` (which only lands at commit 2).
    const intendedThemeRef = useRef(activeTheme.name)
    // The blocker and SkiaOverlay are SIBLINGS of `innerRef`, not
    // descendants - capturing `innerRef` yields the app tree without
    // them, so the second-snapshot capture (slide/pixelize) doesn't
    // re-photograph the in-flight overlay.
    const innerRef = useRef<ViewRef>(null)
    const overlayCanvasRef = useRef<CanvasRef | null>(null)
    // Measured layout, not `Dimensions.get('window')`: on Android
    // edge-to-edge the window dims don't match the painted area and
    // the overlay snapshot would render at the wrong height.
    const innerSizeRef = useRef({ width: 0, height: 0 })
    // Sync guard for concurrent `setTheme` calls. Mirrors the React
    // `isTransitioning` state but flips before capture and paint waits.
    const transitioningRef = useRef(false)
    const mountedRef = useRef(true)
    const [isTransitioning, setIsTransitioning] = useState(false)

    const systemModeRef = useRef(initialTheme === 'system')
    // React mirror of `systemModeRef` - drives the Appearance effect
    // below so `setColorScheme('unspecified')` lands AFTER the overlay
    // is covering the screen (otherwise it flashes Android's status bar).
    const [isSystemMode, setIsSystemMode] = useState(initialTheme === 'system')
    // The user's explicit pick. Animated transitions stash it in
    // `deferredPreferenceRef` and the commit that swaps the colour tokens
    // flushes it here, so pickers that highlight against it move with the
    // theme without an early preference-driven context update.
    const [preference, setPreference] = useState<Names | 'system'>(() =>
      initialTheme === 'system' ? 'system' : (initialTheme as Names),
    )
    const appStateRef = useRef(AppState.currentState)
    const pendingSchemeRef = useRef<ColorScheme | null>(null)
    const deferredSystemRestoreRef = useRef<ColorScheme | null>(null)
    // The pick an animated transition stashes instead of writing it up front,
    // applied by the commit that swaps the colour tokens (or by the fallback
    // paths when the transition never reaches that commit).
    const deferredPreferenceRef = useRef<Names | 'system' | null>(null)

    const flushDeferredPreference = useCallback(() => {
      if (deferredPreferenceRef.current === null) return
      setPreference(deferredPreferenceRef.current)
      deferredPreferenceRef.current = null
    }, [])

    // Touch blocker. The Canvas has `pointerEvents="none"` so taps
    // pass through it; this sibling view catches them while the
    // animation runs. On Fabric `pointerEvents` must live in `style`,
    // so it's driven by `useAnimatedStyle` - JSI updates beat any
    // React commit timing.
    const isBlocking = useSharedValue(false)
    const blockerStyle = useAnimatedStyle(() => ({
      pointerEvents: isBlocking.value ? 'auto' : 'none',
    }))

    const [skImage, setSkImage] = useState<SkImage | null>(null)
    // Second snapshot, captured AFTER the swap, for transitions that
    // need both themes on screen at once (slide, pixelize).
    const [skImageNew, setSkImageNew] = useState<SkImage | null>(null)
    const [overlayParams, setOverlayParams] = useState<OverlayParams | null>(null)
    const progress = useSharedValue(0)
    // Cleanup currently uses a JS timer instead of worklet completion.
    // It shares the configured duration, but its scheduling is independent
    // of UI animation frames and can be delayed when JS is busy.
    // The handle lives in a ref so unmount can cancel an in-flight timer.
    const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
      return () => {
        if (finishTimerRef.current !== null) {
          clearTimeout(finishTimerRef.current)
          finishTimerRef.current = null
        }
      }
    }, [])

    // Lifecycle flag for the async transition pipeline. Setup writes
    // `true` explicitly (not just initial value) so `<StrictMode>`'s
    // simulated unmount/remount cycle in development re-arms the
    // ref - otherwise the cleanup pass leaves `current = false` and
    // subsequent transitions bail at every `if (!mountedRef.current)`
    // check.
    useEffect(() => {
      mountedRef.current = true
      return () => {
        mountedRef.current = false
      }
    }, [])

    // Syncs native `Appearance` (alerts, keyboards, status bar) with
    // the committed theme. Routed through React state so the call lands
    // AFTER the overlay covers the screen - see comments at the
    // `isSystemMode` declaration for the Android flash details.
    useEffect(() => {
      if (isSystemMode) {
        if (!transitioningRef.current) {
          deferredSystemRestoreRef.current = null
          Appearance.setColorScheme('unspecified')
        }
        return
      }
      if (isTransitioning) return
      Appearance.setColorScheme(schemeOf(activeTheme.name))
    }, [isSystemMode, activeTheme.name, isTransitioning])

    const resetTransition = useCallback(() => {
      transitioningRef.current = false
      isBlocking.set(false)
      setIsTransitioning(false)
      // Texture release is deferred one frame so it can't block cleanup.
      const disposeAndClear = (prev: SkImage | null) => {
        if (prev) requestAnimationFrame(() => prev.dispose())
        return null
      }
      setSkImage(disposeAndClear)
      setSkImageNew(disposeAndClear)
    }, [isBlocking])

    const runTransition = useCallback(
      async (
        initialName: Names,
        options: ResolvedOptions<Names>,
        transitionType: TransitionType,
      ) => {
        let name: Names = initialName
        const meta = TRANSITION_META[transitionType]
        const effectiveDuration = options?.duration ?? meta.defaultDuration
        const effectiveEasing = options?.easing ?? Easing.out(Easing.cubic)

        const deferredRestore = async () => {
          if (deferredSystemRestoreRef.current === null) return
          const manualScheme = deferredSystemRestoreRef.current
          let resolved = false
          const realScheme = await new Promise<ColorScheme>((resolve) => {
            const sub = Appearance.addChangeListener(({ colorScheme }) => {
              if (resolved) return
              resolved = true
              sub.remove()
              resolve(normalizeScheme(colorScheme))
            })
            Appearance.setColorScheme('unspecified')
            requestAnimationFrame(() => {
              if (resolved) return
              resolved = true
              sub.remove()
              resolve(manualScheme)
            })
          })
          if (!mountedRef.current) return
          deferredSystemRestoreRef.current = null
          const corrected = mapSchemeToTheme<Names>(realScheme, systemThemeMap)
          if (corrected in themes && corrected !== name) {
            name = corrected as Names
            intendedThemeRef.current = corrected
            setActiveTheme({ colors: getColors(corrected), name: corrected })
          }
        }

        const instantFallback = () => {
          flushDeferredPreference()
          setActiveTheme({ colors: getColors(name), name })
          resetTransition()
          safeCall('config onThemeChange', onThemeChange, name)
        }

        // Images registered here are disposed in `finally` until ownership
        // transfers to state. State-owned images and captures that resolve
        // after unmount are outside this list's cleanup coverage.
        const pending: SkImage[] = []
        try {
          if (!mountedRef.current) return

          const capturedOld = await captureView(innerRef)
          if (!mountedRef.current) return

          if (!capturedOld) {
            console.warn(`${TAG} Failed to capture snapshot. Falling back to instant theme switch.`)
            instantFallback()
            return
          }
          pending.push(capturedOld)

          const measured = innerSizeRef.current
          const fallback = Dimensions.get('window')
          const screenW = measured.width > 0 ? measured.width : fallback.width
          const screenH = measured.height > 0 ? measured.height : fallback.height
          const origin = meta.needsOrigin
            ? resolveOrigin(options.origin, screenW, screenH)
            : { x: screenW / 2, y: screenH / 2 }

          // Commit 1 - mount the snapshot on the overlay.
          progress.set(0)
          setOverlayParams({
            mode: transitionType,
            origin,
            maxRadius: calculateMaxRadius(origin.x, origin.y, screenW, screenH),
            screenWidth: screenW,
            screenHeight: screenH,
            inverted: options.inverted ?? false,
            direction: options.direction ?? DEFAULT_DIRECTION,
            splitMode: options.mode ?? DEFAULT_SPLIT_MODE,
            blockSize: options.blockSize ?? DEFAULT_PIXELIZE_BLOCK_SIZE,
            noiseSize: options.noiseSize ?? DEFAULT_DISSOLVE_NOISE_SIZE,
          })
          setSkImage(capturedOld)
          pending.pop() // ownership transferred to state

          await waitFrames(SETTLE.overlayCommit)
          if (!mountedRef.current) return

          const paintSynced = await syncOverlayPaint(overlayCanvasRef)
          await waitFrames(paintSynced ? SETTLE.skiaPaintSynced : SETTLE.skiaPaint)
          if (!mountedRef.current) return

          // Commit 2 - swap after the offscreen probe and composite margin.
          setIsTransitioning(true)
          setActiveTheme({ colors: getColors(name), name })
          flushDeferredPreference()
          await deferredRestore()

          // Reveal/shape transitions and any transition that captures
          // the new tree need it fully repainted first - fade/wipe/
          // split/dissolve hide the tree completely so they can skip.
          if (meta.kind === 'reveal' || meta.kind === 'shape' || meta.capturesNew) {
            await waitFrames(SETTLE.treeRepaint)
            if (!mountedRef.current) return
          }

          if (meta.capturesNew) {
            const capturedNew = await captureView(innerRef)
            if (!mountedRef.current) return
            if (capturedNew) {
              pending.push(capturedNew)
              setSkImageNew(capturedNew)
              pending.pop()
              await waitFrames(SETTLE.overlayCommit)
              if (!mountedRef.current) return
              const newPaintSynced = await syncOverlayPaint(overlayCanvasRef)
              await waitFrames(newPaintSynced ? SETTLE.skiaPaintSynced : SETTLE.skiaPaint)
              if (!mountedRef.current) return
            }
          }

          progress.set(withTiming(1, { duration: effectiveDuration, easing: effectiveEasing }))
          finishTimerRef.current = setTimeout(() => {
            finishTimerRef.current = null
            if (!mountedRef.current) return
            resetTransition()
            safeCall('config onTransitionEnd', configOnTransitionEnd, name)
            safeCall('per-call onTransitionEnd', options.onTransitionEnd, name)
            safeCall('config onThemeChange', onThemeChange, name)
            if (systemModeRef.current && pendingSchemeRef.current !== null) {
              const resolved = mapSchemeToTheme<Names>(pendingSchemeRef.current, systemThemeMap)
              pendingSchemeRef.current = null
              if (resolved in themes && resolved !== name) {
                intendedThemeRef.current = resolved
                setActiveTheme({ colors: getColors(resolved), name: resolved })
                safeCall('config onThemeChange', onThemeChange, resolved)
              }
            }
          }, effectiveDuration)
        } catch (error) {
          console.warn(
            `${TAG} Failed to capture snapshot. Falling back to instant theme switch.`,
            error,
          )
          if (!mountedRef.current) return
          instantFallback()
        } finally {
          for (const img of pending) img.dispose()
        }
      },
      [progress, resetTransition, flushDeferredPreference],
    )

    const setTheme = useCallback(
      (name: Names | 'system', publicOptions?: SetThemeOptions<Names>): 'accepted' | 'ignored' => {
        const options = publicOptions as ResolvedOptions<Names> | undefined
        // Validate numeric option bounds before anything else so misuse
        // surfaces at the caller, not as broken animations downstream.
        validateSetThemeOptions(options)
        // Fast path for rapid taps: skip theme resolution and the native
        // `Appearance.getColorScheme()` call while a transition is in flight.
        if (transitioningRef.current) return 'ignored'

        const resolvedTheme =
          name === 'system'
            ? mapSchemeToTheme<Names>(normalizeScheme(Appearance.getColorScheme()), systemThemeMap)
            : name
        if (!(resolvedTheme in themes)) {
          const resolutionHint =
            name === 'system'
              ? ' Provide `systemThemeMap` in the config to map OS appearance to your theme names.'
              : ''
          throw new Error(
            `${TAG} setTheme("${name}") resolved to "${resolvedTheme}" which does not exist in themes.${resolutionHint}`,
          )
        }

        const wasSystemMode = systemModeRef.current
        const nowSystemMode = name === 'system'
        const modeFlipped = nowSystemMode !== wasSystemMode
        if (modeFlipped) {
          systemModeRef.current = nowSystemMode
          setIsSystemMode(nowSystemMode)
          // Entering system mode: snapshot the current scheme so
          // `deferredRestore` inside the overlay window can restore it
          // without flashing Android's status bar.
          deferredSystemRestoreRef.current = nowSystemMode
            ? schemeOf(intendedThemeRef.current)
            : null
        }

        const decision = decideSetTheme({
          transitioning: false,
          currentIntended: intendedThemeRef.current,
          resolvedTarget: resolvedTheme,
          modeFlipped,
        })
        if (decision.status === 'ignored') return 'ignored'

        const animatedOpt = options?.animated ?? configAnimated
        if (preferenceWriteTiming(decision.path, animatedOpt) === 'eager') setPreference(name)
        else deferredPreferenceRef.current = name
        // `mode-flip-noop`: same painted theme but the user's system
        // pick changed. `preference` is already synced above; nothing
        // left to animate.
        if (decision.path === 'mode-flip-noop') return 'accepted'

        intendedThemeRef.current = resolvedTheme

        if (animatedOpt === false) {
          setActiveTheme({ colors: getColors(resolvedTheme), name: resolvedTheme })
          safeCall('config onThemeChange', onThemeChange, resolvedTheme)
          return 'accepted'
        }

        transitioningRef.current = true
        isBlocking.set(true)

        try {
          configOnTransitionStart?.(resolvedTheme)
          options?.onTransitionStart?.(resolvedTheme)
        } catch (e) {
          flushDeferredPreference()
          resetTransition()
          throw e
        }

        const effectiveTransition = options?.transition ?? configTransition
        runTransition(resolvedTheme, options ?? {}, effectiveTransition).catch(() => {})
        return 'accepted'
      },
      [isBlocking, resetTransition, runTransition, flushDeferredPreference],
    )

    // Mirror `setTheme` in a ref so the OS-listener effect runs with
    // `[]` deps and never re-subscribes on render.
    const setThemeRef = useRef(setTheme)
    setThemeRef.current = setTheme

    useEffect(() => {
      const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
        if (!systemModeRef.current) return
        if (deferredSystemRestoreRef.current !== null) return
        if (transitioningRef.current) {
          pendingSchemeRef.current = normalizeScheme(colorScheme)
          return
        }
        if (appStateRef.current === 'active') {
          setThemeRef.current('system')
        } else {
          const resolved = mapSchemeToTheme<Names>(normalizeScheme(colorScheme), systemThemeMap)
          if (!(resolved in themes) || resolved === intendedThemeRef.current) return
          intendedThemeRef.current = resolved
          setActiveTheme({ colors: getColors(resolved), name: resolved })
          safeCall('config onThemeChange', onThemeChange, resolved)
        }
      })

      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active' && systemModeRef.current) {
          const osScheme = normalizeScheme(Appearance.getColorScheme())
          const resolved = resolveSystemTheme<Names>(systemThemeMap, osScheme)
          if (resolved in themes) {
            const changed = resolved !== intendedThemeRef.current
            intendedThemeRef.current = resolved
            setActiveTheme({ colors: getColors(resolved), name: resolved })
            if (changed) safeCall('config onThemeChange', onThemeChange, resolved)
          }
        }
        appStateRef.current = next
      })

      return () => {
        appearanceSub.remove()
        appSub.remove()
      }
    }, [])

    const contextValue = useMemo(
      () => ({
        theme: {
          name: activeTheme.name,
          colors: activeTheme.colors,
          scheme: schemeOf(activeTheme.name),
        },
        preference,
        setTheme,
        isTransitioning,
      }),
      [activeTheme, preference, setTheme, isTransitioning],
    )

    const overlayParamsForRender = overlayParams ?? DEFAULT_OVERLAY_PARAMS

    const handleInnerLayout = useCallback((e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout
      innerSizeRef.current = { width, height }
    }, [])

    return (
      <Context value={contextValue}>
        <View style={FLEX_FILL} collapsable={false}>
          <View ref={innerRef} style={FLEX_FILL} collapsable={false} onLayout={handleInnerLayout}>
            {children}
          </View>
          <Animated.View style={[ABSOLUTE_FILL, blockerStyle]} />
          <SkiaOverlay
            image={skImage}
            imageNew={skImageNew}
            progress={progress}
            params={overlayParamsForRender}
            canvasRef={overlayCanvasRef}
          />
        </View>
      </Context>
    )
  }

  return { Context, ThemeTransitionProvider }
}
