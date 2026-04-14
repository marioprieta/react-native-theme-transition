/**
 * Provider and context for the theme transition engine.
 *
 * @remarks
 * Snapshot capture and overlay rendering both use
 * `@shopify/react-native-skia`. A single 0 → 1 progress shared value drives
 * every transition type. Honors the OS "Reduce Motion" setting and supports
 * custom easing.
 *
 * @module
 * @internal
 */

import type { SkImage } from '@shopify/react-native-skia'
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Appearance,
  AppState,
  Dimensions,
  type LayoutChangeEvent,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { ABSOLUTE_FILL, TAG } from './constants'
import { captureView } from './overlay/captureView'
import { calculateMaxRadius, resolveOrigin } from './overlay/resolveOrigin'
import { SkiaOverlay } from './overlay/SkiaOverlay'
import type { SplitAxis, WipeDirection } from './transitionMeta'
import { TRANSITION_META } from './transitionMeta'
import type {
  SetThemeOptions,
  SystemThemeMap,
  ThemeContextValue,
  ThemeDefinition,
  ThemeNames,
  ThemeTransitionConfig,
  TokenNames,
  TransitionType,
} from './types'

/** @internal Distributes `&` over a union to collapse it into a flat intersection. */
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never

/** @internal Distributive `Omit` — Omit applied to each member of a union. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * Flat internal view of the public {@link SetThemeOptions} union. Derived so
 * any field added to a variant automatically appears here — no second source
 * of truth to maintain. `transition` is omitted before the union is collapsed
 * (otherwise `'fade' & 'circularReveal' = never`) and re-added as the broader
 * `TransitionType`.
 *
 * The engine dispatches on `transition` first, then reads the other fields
 * generically, so widening the discriminated union to a flat record at the
 * entry point is safe.
 * @internal
 */
type ResolvedOptions<Names extends string> = Partial<
  UnionToIntersection<DistributiveOmit<SetThemeOptions<Names>, 'transition'>>
> & { transition?: TransitionType }

/**
 * Overlay state snapshotted atomically at the start of each transition.
 * Includes the window dimensions captured at that moment so rotation
 * mid-transition can't create a mismatch between maxRadius/origin (frozen
 * here) and the screen size used for rendering.
 * @internal
 */
interface OverlayParams {
  mode: TransitionType
  origin: { x: number; y: number }
  maxRadius: number
  screenWidth: number
  screenHeight: number
  inverted: boolean
  direction: WipeDirection
  axis: SplitAxis
  blockSize: number
  grainSize: number
}

/** @internal Pixelize shader fallback block size when none is supplied. */
const DEFAULT_PIXELIZE_BLOCK_SIZE = 52
/** @internal Dissolve shader fallback grain size when none is supplied. */
const DEFAULT_DISSOLVE_GRAIN_SIZE = 5
/** @internal Wipe/slide fallback direction when none is supplied. */
const DEFAULT_DIRECTION: WipeDirection = 'left'
/** @internal Split fallback axis when none is supplied. */
const DEFAULT_AXIS: SplitAxis = 'horizontal'

/**
 * Initial overlay params used while no transition is active. The Canvas
 * stays mounted with these defaults so that starting a transition doesn't
 * need a native-view layout pass (which would cause a "new theme flash"
 * on Android).
 * @internal
 */
const DEFAULT_OVERLAY_PARAMS: OverlayParams = {
  mode: 'fade',
  origin: { x: 0, y: 0 },
  maxRadius: 0,
  screenWidth: 0,
  screenHeight: 0,
  inverted: false,
  direction: DEFAULT_DIRECTION,
  axis: DEFAULT_AXIS,
  blockSize: DEFAULT_PIXELIZE_BLOCK_SIZE,
  grainSize: DEFAULT_DISSOLVE_GRAIN_SIZE,
}

/**
 * Invokes a user-supplied callback and logs — but swallows — any thrown
 * error so a buggy callback can't break the transition pipeline.
 * @internal
 */
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

/**
 * Waits for `n` animation frames. Used as a "settle point" between React
 * commits and native paint so the next step operates on a fully-painted
 * tree. Two frames is the sweet spot on both iOS and Android — enough for
 * Skia reconcile + native paint, small enough to not delay the animation.
 * @internal
 */
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
 * Settle point before capturing the inner view. Combined with the rAF
 * that `useTheme.select()` schedules before calling `setTheme`, this
 * gives React + Shadow Tree + Native UI enough time to paint any state
 * that was just committed (e.g. the picker's selection highlight) so
 * the captured image matches what the user sees on screen.
 * @internal
 */
const settleBeforeCapture = () => waitFrames(1)

/**
 * Settle point for Skia to paint a resolved SkImage into the pre-mounted
 * Canvas. One frame is enough on iOS, but Android occasionally needs a
 * second — without it, the color swap in the inner tree can win the race
 * against the overlay's first paint and the new theme flashes through
 * for a single frame before the animation starts.
 * @internal
 */
const settleSkiaPaint = () => waitFrames(2)

/**
 * One-frame settle: enough for a color swap to propagate through the
 * inner tree's repaint on Android, including deep ScrollView children.
 * Used only before starting the reveal animation, which exposes the
 * underlying view through a growing shape and therefore requires it to
 * be fully painted first.
 * @internal
 */
const settleTreeRepaint = () => waitFrames(1)

/** @internal Coerces an `Appearance.getColorScheme()` return value to a known scheme. */
function normalizeScheme(
  colorScheme?: string | null,
  fallback: 'light' | 'dark' = 'light',
): 'light' | 'dark' {
  if (colorScheme === 'dark') return 'dark'
  if (colorScheme === 'light') return 'light'
  return fallback
}

/** @internal Resolves an OS color scheme to a theme name via `systemThemeMap`. */
function mapSchemeToTheme<Names extends string>(
  scheme: 'light' | 'dark',
  mapping?: SystemThemeMap<Names>,
): Names {
  return mapping?.[scheme] ?? (scheme as Names)
}

/** @internal Reads the current OS appearance and maps it to a theme name. */
function resolveSystemTheme<Names extends string>(
  mapping?: SystemThemeMap<Names>,
  fallbackScheme?: 'light' | 'dark',
): Names {
  return mapSchemeToTheme<Names>(
    normalizeScheme(Appearance.getColorScheme(), fallbackScheme),
    mapping,
  )
}

/**
 * Builds the React context and provider component for a theme configuration.
 * Called by {@link createThemeTransition}; not part of the public API.
 * @internal
 */
export function createProviderAndContext<T extends Record<string, ThemeDefinition>>(
  config: ThemeTransitionConfig<T>,
) {
  const {
    themes,
    animated: configAnimated = true,
    // No default — when undefined, each transition falls back to its own
    // per-kind default from TRANSITION_META. When set, it overrides every
    // transition's default globally (unless a per-call duration wins).
    duration: configDuration,
    transition: configTransition = 'fade',
    reduceMotion: configReduceMotion = true,
    systemThemeMap,
    darkThemes: darkThemesConfig,
    backgroundColor: backgroundColorGetter,
    onTransitionStart: configOnTransitionStart,
    onTransitionEnd: configOnTransitionEnd,
    onThemeChange,
  } = config

  const darkThemeSet = new Set<string>(
    darkThemesConfig ?? (systemThemeMap ? [systemThemeMap.dark] : ['dark']),
  )
  const schemeOf = (name: string): 'light' | 'dark' => (darkThemeSet.has(name) ? 'dark' : 'light')

  type Names = ThemeNames<T>
  type Tokens = TokenNames<T>
  const Context = createContext<ThemeContextValue<Tokens, Names> | null>(null)

  function getColors(name: Names): Record<Tokens, string> {
    return { ...themes[name] } as Record<Tokens, string>
  }

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

    // Holds the *intended* theme — the one we are transitioning to, or the
    // one currently active when idle. Written synchronously by `setTheme`
    // (before `runTransition` kicks off) so same-theme guards and select()
    // rejection checks see the latest intent without waiting for React to
    // commit `activeTheme`.
    const targetThemeRef = useRef(activeTheme.name)
    // Inner wrapper around children ONLY — the overlay and pointer-event
    // blocker are siblings, not descendants. Capturing `innerRef` yields a
    // snapshot of the app tree without the overlay, which is what we need
    // to grab a fresh snapshot of the NEW theme after the colors swap
    // (while the old-theme overlay is still covering the screen).
    const innerRef = useRef<View>(null)
    // Measured layout of the inner view. We use this instead of
    // `Dimensions.get('window')` because the window dims don't always
    // match the view's actual rendered size (edge-to-edge mode on
    // Android, navigation bar area, etc.). If they drift, the overlay
    // renders the snapshot at the wrong size and the bottom/top strips
    // leak the underlying (already-swapped) theme.
    const innerSizeRef = useRef({ width: 0, height: 0 })
    const transitioningRef = useRef(false)
    const mountedRef = useRef(true)
    const [isTransitioning, setIsTransitioning] = useState(false)

    const systemModeRef = useRef(initialTheme === 'system')
    // State mirror of `systemModeRef` — drives the Appearance.setColorScheme
    // effect below so mode changes are applied outside the React commit
    // phase (pre-overlay `Appearance.setColorScheme('unspecified')` causes
    // an Android status bar flash).
    const [isSystemMode, setIsSystemMode] = useState(initialTheme === 'system')
    const appStateRef = useRef(AppState.currentState)
    const pendingSchemeRef = useRef<'light' | 'dark' | null>(null)
    const lastKnownOsSchemeRef = useRef<'light' | 'dark'>(
      normalizeScheme(Appearance.getColorScheme()),
    )
    const deferredSystemRestoreRef = useRef<'light' | 'dark' | null>(null)

    const isBlocking = useSharedValue(false)
    const blockerProps = useAnimatedProps(() => ({
      pointerEvents: isBlocking.value ? ('auto' as const) : ('none' as const),
    }))

    const [skImage, setSkImage] = useState<SkImage | null>(null)
    // Second snapshot: captured AFTER the theme swap for transitions that
    // need to render both old and new simultaneously (slide, pixelize).
    const [skImageNew, setSkImageNew] = useState<SkImage | null>(null)
    const [overlayParams, setOverlayParams] = useState<OverlayParams | null>(null)
    const progress = useSharedValue(0)

    // Cached synchronously via AccessibilityInfo listener so setTheme can
    // return an accurate boolean without an async bridge round-trip.
    const reduceMotionRef = useRef(false)
    useEffect(() => {
      let mounted = true
      AccessibilityInfo.isReduceMotionEnabled().then((v) => {
        if (mounted) reduceMotionRef.current = v
      })
      const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
        reduceMotionRef.current = v
      })
      return () => {
        mounted = false
        sub.remove()
      }
    }, [])

    useEffect(() => {
      mountedRef.current = true
      return () => {
        mountedRef.current = false
      }
    }, [])

    // Keeps native `Appearance` (alerts, keyboards, status bar) in sync
    // with the committed theme. Deferred through React state (instead of
    // an imperative call from `setTheme`) so the effect runs AFTER the
    // overlay is covering the screen — `setColorScheme('unspecified')`
    // pre-overlay flashes Android's status bar.
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
      isBlocking.value = false
      setIsTransitioning(false)
      // Defer native texture release to avoid blocking the cleanup frame.
      setSkImage((prev) => {
        if (prev) requestAnimationFrame(() => prev.dispose())
        return null
      })
      setSkImageNew((prev) => {
        if (prev) requestAnimationFrame(() => prev.dispose())
        return null
      })
    }, [isBlocking])

    const runTransition = useCallback(
      async (
        initialName: Names,
        options: ResolvedOptions<Names>,
        transitionType: TransitionType = 'fade',
      ) => {
        let name: Names = initialName
        const meta = TRANSITION_META[transitionType]
        // Duration precedence: per-call > config-level (if explicitly set) >
        // per-kind default from TRANSITION_META (350ms for fade/reveal/strip,
        // 800ms for shapes, 750ms for shaders).
        const effectiveDuration = options?.duration ?? configDuration ?? meta.defaultDuration
        const effectiveEasing = options?.easing ?? Easing.out(Easing.cubic)

        const deferredRestore = async () => {
          if (deferredSystemRestoreRef.current === null) return
          const manualScheme = deferredSystemRestoreRef.current
          let resolved = false
          const realScheme = await new Promise<'light' | 'dark'>((resolve) => {
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
          lastKnownOsSchemeRef.current = realScheme
          const corrected = mapSchemeToTheme<Names>(realScheme, systemThemeMap)
          if (corrected in themes && corrected !== name) {
            name = corrected as Names
            targetThemeRef.current = corrected
            setActiveTheme({ colors: getColors(corrected), name: corrected })
          }
        }

        const createFinish = (themeName: Names, opts?: SetThemeOptions<Names>) => () => {
          if (!mountedRef.current) return
          resetTransition()
          safeCall('config onTransitionEnd', configOnTransitionEnd, themeName)
          safeCall('per-call onTransitionEnd', opts?.onTransitionEnd, themeName)
          safeCall('config onThemeChange', onThemeChange, themeName)
          if (systemModeRef.current && pendingSchemeRef.current !== null) {
            const resolved = mapSchemeToTheme<Names>(pendingSchemeRef.current, systemThemeMap)
            pendingSchemeRef.current = null
            if (resolved in themes && resolved !== themeName) {
              targetThemeRef.current = resolved
              setActiveTheme({ colors: getColors(resolved), name: resolved })
              safeCall('config onThemeChange', onThemeChange, resolved)
            }
          }
        }

        const instantFallback = () => {
          setActiveTheme({ colors: getColors(name), name })
          resetTransition()
          safeCall('config onThemeChange', onThemeChange, name)
        }

        let capturedOld: Awaited<ReturnType<typeof captureView>> = null
        let capturedNew: Awaited<ReturnType<typeof captureView>> = null
        try {
          await settleBeforeCapture()
          if (!mountedRef.current) return

          capturedOld = await captureView(innerRef)
          if (!mountedRef.current) return

          if (!capturedOld) {
            console.warn(`${TAG} Failed to capture snapshot. Falling back to instant theme switch.`)
            instantFallback()
            return
          }

          // Measured innerRef layout beats `Dimensions.get('window')`: on
          // Android edge-to-edge + scroll content the window dims don't
          // match the view's painted area and the overlay snapshot would
          // render at the wrong height, leaking the already-swapped theme.
          const measured = innerSizeRef.current
          const fallback = Dimensions.get('window')
          const screenW = measured.width > 0 ? measured.width : fallback.width
          const screenH = measured.height > 0 ? measured.height : fallback.height
          const origin = meta.needsOrigin
            ? resolveOrigin(options.origin, screenW, screenH)
            : { x: screenW / 2, y: screenH / 2 }

          // Commit 1: mount the overlay snapshot. `settleSkiaPaint` below
          // lets Skia finish its reconcile→paint before the color swap,
          // so the new theme can't paint through on Android.
          progress.set(0)
          setOverlayParams({
            mode: transitionType,
            origin,
            maxRadius: calculateMaxRadius(origin.x, origin.y, screenW, screenH),
            screenWidth: screenW,
            screenHeight: screenH,
            inverted: options.inverted ?? false,
            direction: options.direction ?? DEFAULT_DIRECTION,
            axis: options.axis ?? DEFAULT_AXIS,
            blockSize: options.blockSize ?? DEFAULT_PIXELIZE_BLOCK_SIZE,
            grainSize: options.grainSize ?? DEFAULT_DISSOLVE_GRAIN_SIZE,
          })
          setSkImage(capturedOld)
          capturedOld = null

          await settleSkiaPaint()
          if (!mountedRef.current) return

          // Commit 2: overlay is covering the screen — safe to swap.
          setIsTransitioning(true)
          setActiveTheme({ colors: getColors(name), name })
          await deferredRestore()

          // Reveal-style transitions expose the inner tree through a
          // growing hole, so it must be fully repainted before the hole
          // opens. Hidden behind the overlay during the wait.
          await settleTreeRepaint()
          if (!mountedRef.current) return

          // Slide / pixelize render both themes simultaneously — capture
          // a second snapshot of the now-painted new theme (the overlay
          // is a sibling of innerRef so it's excluded from the capture).
          if (meta.capturesNew) {
            capturedNew = await captureView(innerRef)
            if (!mountedRef.current) return
            if (capturedNew) {
              setSkImageNew(capturedNew)
              capturedNew = null
              await settleSkiaPaint()
              if (!mountedRef.current) return
            }
          }

          const finish = createFinish(name, options)
          progress.set(withTiming(1, { duration: effectiveDuration, easing: effectiveEasing }))
          setTimeout(finish, effectiveDuration + 50)
        } catch (error) {
          console.warn(
            `${TAG} Failed to capture snapshot. Falling back to instant theme switch.`,
            error,
          )
          capturedOld?.dispose()
          capturedNew?.dispose()
          if (!mountedRef.current) return
          instantFallback()
        }
      },
      [progress, resetTransition],
    )

    const setTheme = useCallback(
      (name: Names | 'system', publicOptions?: SetThemeOptions<Names>): boolean => {
        const options = publicOptions as ResolvedOptions<Names> | undefined
        // Entering system mode. We do NOT call `Appearance.setColorScheme`
        // here — pre-overlay that flashes Android's status bar. The sync
        // either happens inside `runTransition`'s `deferredRestore` (if a
        // transition kicks off), or from the `useEffect` below when there
        // is no theme change and the effect notices `isSystemMode` flipped.
        if (name === 'system' && !systemModeRef.current) {
          if (transitioningRef.current) return false
          setIsSystemMode(true)
          systemModeRef.current = true
          deferredSystemRestoreRef.current = schemeOf(targetThemeRef.current)
          // Entering system mode is always a valid change for select() —
          // the recursive call may early-return false if the resolved OS
          // theme matches the current one, but that's not a rejection.
          setTheme('system', options)
          return true
        }

        const resolvedTheme =
          name === 'system'
            ? mapSchemeToTheme<Names>(lastKnownOsSchemeRef.current, systemThemeMap)
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

        if (transitioningRef.current) return false

        const wasSystemMode = systemModeRef.current
        systemModeRef.current = name === 'system'

        if (systemModeRef.current !== wasSystemMode) {
          setIsSystemMode(systemModeRef.current)
          // Stale deferred ref would override the user's explicit choice.
          if (!systemModeRef.current) {
            deferredSystemRestoreRef.current = null
          }
        }

        if (resolvedTheme === targetThemeRef.current) {
          // Manual↔system switch is valid even when the resolved theme
          // matches — returning true prevents select() from reverting.
          return wasSystemMode !== systemModeRef.current
        }

        targetThemeRef.current = resolvedTheme

        const animatedOpt = options?.animated ?? configAnimated
        const skipAnimation =
          animatedOpt === false || (configReduceMotion && reduceMotionRef.current)
        if (skipAnimation) {
          setActiveTheme({ colors: getColors(resolvedTheme), name: resolvedTheme })
          safeCall('config onThemeChange', onThemeChange, resolvedTheme)
          return true
        }

        transitioningRef.current = true
        isBlocking.value = true

        try {
          configOnTransitionStart?.(resolvedTheme)
          options?.onTransitionStart?.(resolvedTheme)
        } catch (e) {
          resetTransition()
          throw e
        }

        const effectiveTransition = options?.transition ?? configTransition
        runTransition(resolvedTheme, options ?? {}, effectiveTransition).catch(() => {})
        return true
      },
      [isBlocking, resetTransition, runTransition],
    )

    useEffect(() => {
      const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
        if (!systemModeRef.current) return
        lastKnownOsSchemeRef.current = normalizeScheme(colorScheme)
        if (deferredSystemRestoreRef.current !== null) return
        if (transitioningRef.current) {
          pendingSchemeRef.current = normalizeScheme(colorScheme)
          return
        }
        if (appStateRef.current === 'active') {
          setTheme('system')
        } else {
          const resolved = mapSchemeToTheme<Names>(normalizeScheme(colorScheme), systemThemeMap)
          if (!(resolved in themes) || resolved === targetThemeRef.current) return
          targetThemeRef.current = resolved
          setActiveTheme({ colors: getColors(resolved), name: resolved })
          safeCall('config onThemeChange', onThemeChange, resolved)
        }
      })

      const appSub = AppState.addEventListener('change', (next) => {
        if (appStateRef.current !== 'active' && next === 'active' && systemModeRef.current) {
          const osScheme = normalizeScheme(Appearance.getColorScheme())
          lastKnownOsSchemeRef.current = osScheme
          const resolved = resolveSystemTheme<Names>(systemThemeMap, osScheme)
          if (resolved in themes) {
            const changed = resolved !== targetThemeRef.current
            targetThemeRef.current = resolved
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
    }, [setTheme])

    const contextValue = useMemo(
      () => ({
        colors: activeTheme.colors,
        name: activeTheme.name,
        setTheme,
        isTransitioning,
      }),
      [activeTheme, setTheme, isTransitioning],
    )

    // The SkiaOverlay is mounted permanently so the Canvas's native view
    // stays ready. Between transitions `skImage` is null and the Canvas
    // renders nothing; during a transition `overlayParams` holds the
    // captured dimensions/mode/etc. Default params are used only during
    // the "idle" window so the first render doesn't trip on null props.
    const overlayParamsForRender = overlayParams ?? DEFAULT_OVERLAY_PARAMS

    // Root background color painted BEHIND the children tree. Any
    // transparent regions the snapshot path leaves (Android's
    // `view.draw` can produce gaps below a scrolled ScrollView, for
    // example) fall back to this color in the captured bitmap, not to
    // the activity's window background. Defaults to the first token of
    // the current theme when no explicit getter is provided.
    // Apply the root background color to BOTH the outer wrapper and the
    // inner wrapper. The outer wrapper covers any gaps the inner tree
    // (typically a ScrollView) might leave when its native background
    // hasn't fully repainted after the theme swap — e.g. areas that were
    // below the fold before scrolling, where Android's lazy rendering can
    // briefly expose the window's default bg instead of the new theme bg.
    const rootWrapperStyle = useMemo(() => {
      const bg = backgroundColorGetter
        ? backgroundColorGetter(activeTheme.colors)
        : (Object.values(activeTheme.colors)[0] as string)
      return { flex: 1, backgroundColor: bg }
    }, [activeTheme.colors])

    const handleInnerLayout = useCallback((e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout
      innerSizeRef.current = { width, height }
    }, [])

    return (
      <Context.Provider value={contextValue}>
        <View style={rootWrapperStyle} collapsable={false}>
          <View
            ref={innerRef}
            style={rootWrapperStyle}
            collapsable={false}
            onLayout={handleInnerLayout}
          >
            {children}
          </View>
          <Animated.View style={ABSOLUTE_FILL} animatedProps={blockerProps} />
          <SkiaOverlay
            image={skImage}
            imageNew={skImageNew}
            progress={progress}
            params={overlayParamsForRender}
          />
        </View>
      </Context.Provider>
    )
  }

  return { Context, ThemeTransitionProvider }
}
