/**
 * Skia-powered overlay for theme transitions.
 *
 * @remarks
 * Top-level `SkiaOverlay` keeps a `<Canvas>` permanently mounted (so
 * starting a transition never pays for a native-view layout pass on
 * Android) and dispatches to a per-mode component that owns the
 * `useDerivedValue` hooks for that mode only. The active mode's hooks
 * mount when the transition starts and unmount when it ends. `fade`
 * never pays for `slide`'s slot machine, `pixelize` never pays for
 * `heart`'s path interpolation, etc.
 *
 * @module
 * @internal
 */

import type { SkImage, SkPath } from '@shopify/react-native-skia'
import {
  Canvas,
  Circle,
  Fill,
  Group,
  ImageShader,
  Rect,
  Shader,
  Skia,
  Image as SkiaImage,
  usePathInterpolation,
} from '@shopify/react-native-skia'
import { useMemo } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import { useDerivedValue } from 'react-native-reanimated'
import { ABSOLUTE_FILL } from '../constants'
import type { WipeDirection } from '../transitionMeta'
import type { OverlayParams } from './types'

/** @internal Frozen style for the Canvas. Hoisted so JSX never reallocates. */
const CANVAS_STYLE = [ABSOLUTE_FILL, { pointerEvents: 'none' as const }]
/** @internal Static input domain for `usePathInterpolation`. */
const KEYFRAME_INPUT = [0, 1]

// ───────────────────────────── Path builders ──────────────────────────────

/**
 * @internal Empirically tuned heart bezier reach factors. The bounding
 * math in `useHeartSize` reads these to compute the smallest scale at
 * which the path covers every screen corner. Kept next to the path
 * builder so the bounds and the curve stay in sync when either is
 * tweaked.
 */
const HEART_REACH = {
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

function makeHeartPath(cx: number, cy: number, w: number, h: number): SkPath {
  const p = Skia.Path.Make()
  p.moveTo(cx, cy + h * HEART_REACH.bottomTip)
  p.cubicTo(
    cx - w * HEART_REACH.lobeX,
    cy + h * 0.1,
    cx - w * HEART_REACH.innerLobeX,
    cy - h * HEART_REACH.lobeY,
    cx,
    cy - h * HEART_REACH.topNotch,
  )
  p.cubicTo(
    cx + w * HEART_REACH.innerLobeX,
    cy - h * HEART_REACH.lobeY,
    cx + w * HEART_REACH.lobeX,
    cy + h * 0.1,
    cx,
    cy + h * HEART_REACH.bottomTip,
  )
  p.close()
  return p
}

/**
 * @internal Star geometry. `INNER_RATIO` is the valley-to-tip ratio
 * (5-point star with deep valleys). `OUTER_PADDING` over-extends the
 * tips past the screen corner so the inner valleys still cover them.
 */
const STAR_GEOMETRY = { points: 5, innerRatio: 0.4, outerPadding: 1.05 } as const

function makeStarPath(cx: number, cy: number, rOuter: number, rInner: number): SkPath {
  const p = Skia.Path.Make()
  const step = Math.PI / STAR_GEOMETRY.points
  const start = -Math.PI / 2
  for (let i = 0; i < STAR_GEOMETRY.points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = start + i * step
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  p.close()
  return p
}

/** @internal Order keyframes so `progress` 0 → 1 grows the shape (or shrinks if inverted). */
function orderKeyframes(inverted: boolean, tiny: SkPath, full: SkPath): SkPath[] {
  return inverted ? [full, tiny] : [tiny, full]
}

// ──────────────────────────── Runtime shaders ─────────────────────────────

/**
 * @internal Pixelize shader. Samples both the old and new snapshots at
 * a shared block-cell center and crossfades them. `blockSize` follows a
 * triangle curve so both images are chunkiest at the midpoint and clear
 * at the endpoints; `blend` slides linearly from 0 (all old) to 1 (all
 * new).
 */
const pixelizeShader = Skia.RuntimeEffect.Make(`
uniform shader imgOld;
uniform shader imgNew;
uniform float blockSize;
uniform float blend;
uniform float2 size;

half4 main(float2 xy) {
  float2 cell = (floor(xy / blockSize) + 0.5) * blockSize;
  cell = clamp(cell, float2(0.5), size - 0.5);
  half4 a = imgOld.eval(cell);
  half4 b = imgNew.eval(cell);
  return a * (1.0 - blend) + b * blend;
}
`)

/**
 * @internal Dissolve shader. Discards fragments whose deterministic
 * noise value is below the current threshold, so the image disintegrates
 * as `progress` rises.
 */
const dissolveShader = Skia.RuntimeEffect.Make(`
uniform shader img;
uniform float threshold;
uniform float grain;

half4 main(float2 xy) {
  float2 cell = floor(xy / grain);
  float n = fract(sin(dot(cell, float2(12.9898, 78.233))) * 43758.5453);
  if (n < threshold) return half4(0.0);
  return img.eval(xy);
}
`)

// ─────────────────────────────── Top level ────────────────────────────────

/** @internal */
interface OverlayProps {
  /**
   * Snapshot of the OLD theme. `null` between transitions; the Canvas
   * stays mounted but renders nothing so the next transition doesn't
   * pay for a native-view layout pass.
   */
  image: SkImage | null
  /**
   * Optional snapshot of the NEW theme captured after the color swap.
   * Only provided for transitions that render both themes at once
   * (`slide`, `pixelize`).
   */
  imageNew: SkImage | null
  progress: SharedValue<number>
  params: OverlayParams
}

/** @internal Renders the active-mode subtree. Hooks are scoped per mode. */
export function SkiaOverlay({ image, imageNew, progress, params }: OverlayProps) {
  return (
    <Canvas style={CANVAS_STYLE}>
      {image && (
        <ActiveMode image={image} imageNew={imageNew} progress={progress} params={params} />
      )}
    </Canvas>
  )
}

interface ActiveModeProps {
  image: SkImage
  imageNew: SkImage | null
  progress: SharedValue<number>
  params: OverlayParams
}

function ActiveMode({ image, imageNew, progress, params }: ActiveModeProps) {
  switch (params.mode) {
    case 'fade':
      return <FadeMode image={image} progress={progress} params={params} />
    case 'circularReveal':
      return <CircularRevealMode image={image} progress={progress} params={params} />
    case 'wipe':
      return <WipeMode image={image} progress={progress} params={params} />
    case 'slide':
      return <SlideMode image={image} imageNew={imageNew} progress={progress} params={params} />
    case 'split':
      return <SplitMode image={image} progress={progress} params={params} />
    case 'heart':
      return <HeartMode image={image} progress={progress} params={params} />
    case 'star':
      return <StarMode image={image} progress={progress} params={params} />
    case 'pixelize':
      return <PixelizeMode image={image} imageNew={imageNew} progress={progress} params={params} />
    case 'dissolve':
      return <DissolveMode image={image} progress={progress} params={params} />
  }
}

// ─────────────────────────── Per-mode components ──────────────────────────

interface ModeProps {
  image: SkImage
  progress: SharedValue<number>
  params: OverlayParams
}

interface DualModeProps extends ModeProps {
  imageNew: SkImage | null
}

function FadeMode({ image, progress, params }: ModeProps) {
  const { screenWidth, screenHeight } = params
  const opacity = useDerivedValue(() => 1 - progress.value)
  return (
    <Group opacity={opacity}>
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
    </Group>
  )
}

function CircularRevealMode({ image, progress, params }: ModeProps) {
  const { origin, maxRadius, screenWidth, screenHeight, inverted } = params
  const radius = useDerivedValue(() =>
    inverted ? (1 - progress.value) * maxRadius : progress.value * maxRadius,
  )
  if (inverted) {
    return (
      <Circle cx={origin.x} cy={origin.y} r={radius}>
        <ImageShader image={image} fit="cover" width={screenWidth} height={screenHeight} />
      </Circle>
    )
  }
  return (
    <>
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
      <Circle cx={origin.x} cy={origin.y} r={radius} blendMode="clear" color="black" />
    </>
  )
}

function WipeMode({ image, progress, params }: ModeProps) {
  const { screenWidth, screenHeight, direction } = params
  const horizontal = direction === 'left' || direction === 'right'
  const vertical = direction === 'up' || direction === 'down'

  const x = useDerivedValue(() => (direction === 'left' ? screenWidth * (1 - progress.value) : 0))
  const y = useDerivedValue(() => (direction === 'up' ? screenHeight * (1 - progress.value) : 0))
  const width = useDerivedValue(() => (horizontal ? screenWidth * progress.value : screenWidth))
  const height = useDerivedValue(() => (vertical ? screenHeight * progress.value : screenHeight))

  return (
    <>
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
      <Rect x={x} y={y} width={width} height={height} blendMode="clear" color="black" />
    </>
  )
}

function SlideMode({ image, imageNew, progress, params }: DualModeProps) {
  const { screenWidth, screenHeight, direction } = params
  const oldOffset = useSlideOffset(progress, direction, screenWidth, screenHeight, 'old')
  const newOffset = useSlideOffset(progress, direction, screenWidth, screenHeight, 'new')

  // Before the second snapshot lands we render only the old image so
  // the inner tree (already swapped) stays hidden.
  if (!imageNew) {
    return (
      <SkiaImage
        image={image}
        x={oldOffset.x}
        y={oldOffset.y}
        width={screenWidth}
        height={screenHeight}
        fit="cover"
      />
    )
  }
  return (
    <>
      <SkiaImage
        image={image}
        x={oldOffset.x}
        y={oldOffset.y}
        width={screenWidth}
        height={screenHeight}
        fit="cover"
      />
      <SkiaImage
        image={imageNew}
        x={newOffset.x}
        y={newOffset.y}
        width={screenWidth}
        height={screenHeight}
        fit="cover"
      />
    </>
  )
}

function useSlideOffset(
  progress: SharedValue<number>,
  direction: WipeDirection,
  screenWidth: number,
  screenHeight: number,
  which: 'old' | 'new',
) {
  const x = useDerivedValue(() => {
    if (direction !== 'left' && direction !== 'right') return 0
    const sign = direction === 'right' ? 1 : -1
    return which === 'old'
      ? sign * progress.value * screenWidth
      : sign * -(1 - progress.value) * screenWidth
  })
  const y = useDerivedValue(() => {
    if (direction !== 'up' && direction !== 'down') return 0
    const sign = direction === 'down' ? 1 : -1
    return which === 'old'
      ? sign * progress.value * screenHeight
      : sign * -(1 - progress.value) * screenHeight
  })
  return { x, y }
}

function SplitMode({ image, progress, params }: ModeProps) {
  const { screenWidth, screenHeight, splitMode, inverted } = params
  if (splitMode === 'top-bottom') {
    return (
      <SplitTopBottom
        image={image}
        progress={progress}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        inverted={inverted}
      />
    )
  }
  return (
    <SplitLeftRight
      image={image}
      progress={progress}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      inverted={inverted}
    />
  )
}

interface SplitAxisProps {
  image: SkImage
  progress: SharedValue<number>
  screenWidth: number
  screenHeight: number
  inverted: boolean
}

function SplitTopBottom({ image, progress, screenWidth, screenHeight, inverted }: SplitAxisProps) {
  const halfH = screenHeight / 2
  const stripH = useDerivedValue(() => halfH * progress.value)
  const topY = useDerivedValue(() => (inverted ? 0 : halfH - halfH * progress.value))
  const bottomY = useDerivedValue(() => (inverted ? screenHeight - halfH * progress.value : halfH))
  return (
    <>
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
      <Rect x={0} y={topY} width={screenWidth} height={stripH} blendMode="clear" color="black" />
      <Rect x={0} y={bottomY} width={screenWidth} height={stripH} blendMode="clear" color="black" />
    </>
  )
}

function SplitLeftRight({ image, progress, screenWidth, screenHeight, inverted }: SplitAxisProps) {
  const halfW = screenWidth / 2
  const stripW = useDerivedValue(() => halfW * progress.value)
  const leftX = useDerivedValue(() => (inverted ? 0 : halfW - halfW * progress.value))
  const rightX = useDerivedValue(() => (inverted ? screenWidth - halfW * progress.value : halfW))
  return (
    <>
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
      <Rect x={leftX} y={0} width={stripW} height={screenHeight} blendMode="clear" color="black" />
      <Rect x={rightX} y={0} width={stripW} height={screenHeight} blendMode="clear" color="black" />
    </>
  )
}

function HeartMode({ image, progress, params }: ModeProps) {
  const { origin, screenWidth, screenHeight, inverted } = params
  const path = useHeartPath(origin.x, origin.y, screenWidth, screenHeight, inverted, progress)
  return (
    <ShapeClip
      image={image}
      path={path}
      inverted={inverted}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    />
  )
}

function StarMode({ image, progress, params }: ModeProps) {
  const { origin, maxRadius, screenWidth, screenHeight, inverted } = params
  const path = useStarPath(origin.x, origin.y, maxRadius, inverted, progress)
  return (
    <ShapeClip
      image={image}
      path={path}
      inverted={inverted}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    />
  )
}

interface ShapeClipProps {
  image: SkImage
  path: SharedValue<SkPath>
  inverted: boolean
  screenWidth: number
  screenHeight: number
}

function ShapeClip({ image, path, inverted, screenWidth, screenHeight }: ShapeClipProps) {
  if (inverted) {
    return (
      <Group clip={path}>
        <SkiaImage
          image={image}
          x={0}
          y={0}
          width={screenWidth}
          height={screenHeight}
          fit="cover"
        />
      </Group>
    )
  }
  return (
    <>
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
      <Group clip={path}>
        <Rect
          x={0}
          y={0}
          width={screenWidth}
          height={screenHeight}
          blendMode="clear"
          color="black"
        />
      </Group>
    </>
  )
}

function useHeartPath(
  originX: number,
  originY: number,
  screenWidth: number,
  screenHeight: number,
  inverted: boolean,
  progress: SharedValue<number>,
) {
  // Smallest heart scale that covers all four corners AND the top
  // notch from a low origin. Reach factors live next to the path
  // builder so the math stays in sync with the curve.
  const heartSize = useMemo(() => {
    const cornerSize = (dx: number, dy: number) => {
      const fy = dy < 0 ? HEART_REACH.topCornerY : HEART_REACH.bottomCornerY
      return Math.abs(dx) + Math.abs(dy) / fy
    }
    const notch = originY / HEART_REACH.topNotch
    return (
      Math.max(
        cornerSize(-originX, -originY),
        cornerSize(screenWidth - originX, -originY),
        cornerSize(-originX, screenHeight - originY),
        cornerSize(screenWidth - originX, screenHeight - originY),
        notch,
      ) * 1.05
    )
  }, [originX, originY, screenWidth, screenHeight])

  const keyframes = useMemo(
    () =>
      orderKeyframes(
        inverted,
        makeHeartPath(originX, originY, 1, 1),
        makeHeartPath(originX, originY, heartSize, heartSize),
      ),
    [originX, originY, heartSize, inverted],
  )
  return usePathInterpolation(progress, KEYFRAME_INPUT, keyframes)
}

function useStarPath(
  originX: number,
  originY: number,
  maxRadius: number,
  inverted: boolean,
  progress: SharedValue<number>,
) {
  const { outer, inner } = useMemo(() => {
    const outerR = (maxRadius / STAR_GEOMETRY.innerRatio) * STAR_GEOMETRY.outerPadding
    return { outer: outerR, inner: outerR * STAR_GEOMETRY.innerRatio }
  }, [maxRadius])
  const keyframes = useMemo(
    () =>
      orderKeyframes(
        inverted,
        makeStarPath(originX, originY, 1, STAR_GEOMETRY.innerRatio),
        makeStarPath(originX, originY, outer, inner),
      ),
    [originX, originY, outer, inner, inverted],
  )
  return usePathInterpolation(progress, KEYFRAME_INPUT, keyframes)
}

function PixelizeMode({ image, imageNew, progress, params }: DualModeProps) {
  const { screenWidth, screenHeight, blockSize } = params
  const screenSize = useMemo(() => [screenWidth, screenHeight], [screenWidth, screenHeight])

  // Triangle curve on `blockSize`: linear ramp up to the midpoint, cubic
  // ease-out on the way back so the back half spends more time near
  // "clear" than near "chunky" - masks the disappearance pop.
  const uniforms = useDerivedValue(() => {
    const p = progress.value
    let tri: number
    if (p < 0.5) {
      tri = p / 0.5
    } else {
      const t = (p - 0.5) / 0.5
      const inv = 1 - t
      tri = inv * inv * inv
    }
    return {
      blockSize: 2 + tri * (blockSize - 2),
      blend: p,
      size: screenSize,
    }
  })

  // Linear opacity fade over the last 15% so the unmount at p=1 doesn't
  // pop a frame between the shader output and the real underlying view.
  const opacity = useDerivedValue(() => {
    if (progress.value <= 0.85) return 1
    return 1 - (progress.value - 0.85) / 0.15
  })

  // Until the second snapshot lands we hold the old image at full
  // opacity - the inner tree has already been swapped, so it must stay
  // hidden under the overlay.
  if (!imageNew || !pixelizeShader) {
    return (
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
    )
  }
  return (
    <Group opacity={opacity}>
      <Fill>
        <Shader source={pixelizeShader} uniforms={uniforms}>
          <ImageShader
            image={image}
            fit="cover"
            width={screenWidth}
            height={screenHeight}
            tx="clamp"
            ty="clamp"
          />
          <ImageShader
            image={imageNew}
            fit="cover"
            width={screenWidth}
            height={screenHeight}
            tx="clamp"
            ty="clamp"
          />
        </Shader>
      </Fill>
    </Group>
  )
}

function DissolveMode({ image, progress, params }: ModeProps) {
  const { screenWidth, screenHeight, noiseSize } = params
  const uniforms = useDerivedValue(() => ({
    threshold: progress.value,
    grain: noiseSize,
  }))
  if (!dissolveShader) {
    return (
      <SkiaImage image={image} x={0} y={0} width={screenWidth} height={screenHeight} fit="cover" />
    )
  }
  return (
    <Fill>
      <Shader source={dissolveShader} uniforms={uniforms}>
        <ImageShader
          image={image}
          fit="cover"
          width={screenWidth}
          height={screenHeight}
          tx="clamp"
          ty="clamp"
        />
      </Shader>
    </Fill>
  )
}
