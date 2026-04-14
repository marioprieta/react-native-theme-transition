/**
 * Skia-powered overlay for theme transitions.
 *
 * All modes driven by a single 0→1 progress SharedValue.
 * Shape transitions use usePathInterpolation for zero-allocation
 * native C++ path interpolation between pre-computed keyframes.
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
import type { TransitionType } from '../types'

/**
 * Builds a heart path with a deeper notch (0.55) so the concave top-center
 * reaches the screen top at scale 1.0 (no scale factor needed).
 * @internal
 */
function makeHeartPath(cx: number, cy: number, w: number, h: number) {
  const p = Skia.Path.Make()
  p.moveTo(cx, cy + h * 0.7)
  p.cubicTo(cx - w * 1.2, cy + h * 0.1, cx - w * 0.7, cy - h * 0.9, cx, cy - h * 0.55)
  p.cubicTo(cx + w * 0.7, cy - h * 0.9, cx + w * 1.2, cy + h * 0.1, cx, cy + h * 0.7)
  p.close()
  return p
}

/**
 * Builds a 5-point star path. `rOuter` controls the tip radius and
 * `rInner` the valley radius. The star is oriented point-up.
 * @internal
 */
function makeStarPath(cx: number, cy: number, rOuter: number, rInner: number) {
  const p = Skia.Path.Make()
  const points = 5
  const step = Math.PI / points
  const start = -Math.PI / 2
  for (let i = 0; i < points * 2; i++) {
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

/**
 * Order keyframes so the same 0 → 1 progress drives the shape the right way:
 * normal = grow (tiny → full), inverted = shrink (full → tiny).
 * @internal
 */
function orderKeyframes(inverted: boolean, tiny: SkPath, full: SkPath): SkPath[] {
  return inverted ? [full, tiny] : [tiny, full]
}

/**
 * Skia runtime shader: samples both the old and new snapshots at the same
 * block-cell center and crossfades between them. `blockSize` follows a
 * triangle curve (small → large → small) so both images pixelate at the
 * peak and resolve to clarity at the endpoints; `mix` slides linearly from
 * 0 (all old) to 1 (all new).
 * @internal
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
 * Skia runtime shader: discards fragments whose deterministic noise value
 * falls below the current threshold, producing the dissolve effect.
 * @internal
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

/** @internal Frozen snapshot of the transition parameters, owned by the engine. */
export interface OverlayParamsLike {
  mode: TransitionType
  origin: { x: number; y: number }
  maxRadius: number
  screenWidth: number
  screenHeight: number
  inverted: boolean
  direction: 'left' | 'right' | 'up' | 'down'
  axis: 'horizontal' | 'vertical'
  blockSize: number
  grainSize: number
}

/** @internal */
interface OverlayProps {
  /**
   * Snapshot of the OLD theme. `null` when no transition is active —
   * the Canvas stays mounted but renders nothing so that starting the
   * next transition doesn't pay for a native-view layout pass.
   */
  image: SkImage | null
  /**
   * Optional snapshot of the NEW theme, captured after the color swap.
   * Only provided for transitions that render both themes at once
   * (`slide`, `pixelize`).
   */
  imageNew: SkImage | null
  progress: SharedValue<number>
  params: OverlayParamsLike
}

/**
 * Renders the captured snapshot as a Skia overlay and animates it away
 * according to `params.mode`. Every mode is driven by the same 0 → 1
 * progress shared value so the engine can time them identically.
 * @internal
 */
export function SkiaOverlay({ image, imageNew, progress, params }: OverlayProps) {
  const {
    mode,
    origin: { x: originX, y: originY },
    maxRadius,
    screenWidth,
    screenHeight,
    inverted,
    direction,
    axis,
    blockSize,
    grainSize,
  } = params
  const opacity = useDerivedValue(() => 1 - progress.value)
  const revealR = useDerivedValue(() => progress.value * maxRadius)
  const invertedR = useDerivedValue(() => (1 - progress.value) * maxRadius)

  // Heart size: concave bezier, asymmetric. Bounds the shape so that all
  // 4 corners AND the top-center notch are covered at scale 1.0. See the
  // block below for the reach factors.
  const heartSize = useMemo(() => {
    const cornerSize = (dx: number, dy: number) => {
      const fy = dy < 0 ? 0.75 : 0.65
      return Math.abs(dx) / 1.0 + Math.abs(dy) / fy
    }
    // Top-center notch sits at y = cy - 0.55h. If origin is low on
    // screen, corner bounds alone can leave a spike at y=0 near center.
    const notch = originY / 0.55
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

  const heartKeyframes = useMemo(
    () =>
      orderKeyframes(
        inverted,
        makeHeartPath(originX, originY, 1, 1),
        makeHeartPath(originX, originY, heartSize, heartSize),
      ),
    [originX, originY, heartSize, inverted],
  )
  const heartPath = usePathInterpolation(progress, [0, 1], heartKeyframes)

  // Star: 5-point, inner radius ≈ 0.4 × outer. The valleys at the inner
  // radius are the limiting factor for corner coverage, so the outer tips
  // need to reach well past the farthest corner.
  const starInnerRatio = 0.4
  const { starOuter, starInner } = useMemo(() => {
    const outer = (maxRadius / starInnerRatio) * 1.05
    return { starOuter: outer, starInner: outer * starInnerRatio }
  }, [maxRadius])
  const starKeyframes = useMemo(
    () =>
      orderKeyframes(
        inverted,
        makeStarPath(originX, originY, 1, 1 * starInnerRatio),
        makeStarPath(originX, originY, starOuter, starInner),
      ),
    [originX, originY, starOuter, starInner, inverted],
  )
  const starPath = usePathInterpolation(progress, [0, 1], starKeyframes)

  // Pixelize: block-size curve that ramps up linearly and decays with a
  // cubic ease-out so the back half spends more time in the "nearly clear"
  // range. Combined with the opacity fade below, the unmount at progress=1
  // never shows a perceptual pop between the shader output and the real
  // underlying view.
  const screenSize = useMemo(() => [screenWidth, screenHeight], [screenWidth, screenHeight])
  const pixelizeUniforms = useDerivedValue(() => {
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
  // Fade the overlay out during the last 15% of the animation so the
  // disappearance is gradual, not a hard frame-boundary pop.
  const pixelizeOpacity = useDerivedValue(() => {
    if (progress.value <= 0.85) return 1
    return 1 - (progress.value - 0.85) / 0.15
  })

  const dissolveUniforms = useDerivedValue(() => ({
    threshold: progress.value,
    grain: grainSize,
  }))

  // Slide: the old snapshot slides out in the opposite direction while the
  // new snapshot slides in from `direction`. With `direction: 'right'`, the
  // old slides from x=0 to x=-screenWidth and the new from x=+screenWidth
  // back to x=0, producing a carousel push effect.
  const slideOldX = useDerivedValue(() => {
    if (direction === 'right') return -progress.value * screenWidth
    if (direction === 'left') return progress.value * screenWidth
    return 0
  })
  const slideOldY = useDerivedValue(() => {
    if (direction === 'down') return -progress.value * screenHeight
    if (direction === 'up') return progress.value * screenHeight
    return 0
  })
  const slideNewX = useDerivedValue(() => {
    if (direction === 'right') return (1 - progress.value) * screenWidth
    if (direction === 'left') return -(1 - progress.value) * screenWidth
    return 0
  })
  const slideNewY = useDerivedValue(() => {
    if (direction === 'down') return (1 - progress.value) * screenHeight
    if (direction === 'up') return -(1 - progress.value) * screenHeight
    return 0
  })

  // Wipe: the erase rect grows from one edge in the direction of `direction`.
  // `direction: 'right'` means the wipe edge sweeps rightward (reveal starts
  // at the left edge), matching the visual arrow.
  const wipeX = useDerivedValue(() =>
    direction === 'left' ? screenWidth * (1 - progress.value) : 0,
  )
  const wipeY = useDerivedValue(() =>
    direction === 'up' ? screenHeight * (1 - progress.value) : 0,
  )
  const wipeW = useDerivedValue(() =>
    direction === 'left' || direction === 'right' ? screenWidth * progress.value : screenWidth,
  )
  const wipeH = useDerivedValue(() =>
    direction === 'up' || direction === 'down' ? screenHeight * progress.value : screenHeight,
  )

  // Split: two cleared rects on either side of the split line. Their strip
  // size (height for horizontal axis, width for vertical) grows 0 → half
  // with progress — same formula for both modes. What changes with
  // `inverted` is WHERE each strip starts, which we handle in the per-rect
  // position derived values below.
  const halfH = screenHeight / 2
  const halfW = screenWidth / 2
  const splitHStripH = useDerivedValue(() =>
    axis === 'horizontal' ? halfH * progress.value : screenHeight,
  )
  const splitVStripW = useDerivedValue(() =>
    axis === 'vertical' ? halfW * progress.value : screenWidth,
  )

  // Parting (default): strips grow outward from the center line.
  //   Top rect: y = halfH - p*halfH, so its bottom edge stays at halfH.
  //   Bottom rect: y = halfH, so its top edge stays at halfH.
  // Shutters (inverted): strips grow inward from the edges.
  //   Top rect: y = 0 (anchored at top edge).
  //   Bottom rect: y = screenH - p*halfH (anchored at bottom edge).
  const splitHTopY = useDerivedValue(() => {
    if (axis !== 'horizontal') return 0
    return inverted ? 0 : halfH - halfH * progress.value
  })
  const splitHBottomY = useDerivedValue(() => {
    if (axis !== 'horizontal') return 0
    return inverted ? screenHeight - halfH * progress.value : halfH
  })
  const splitVLeftX = useDerivedValue(() => {
    if (axis !== 'vertical') return 0
    return inverted ? 0 : halfW - halfW * progress.value
  })
  const splitVRightX = useDerivedValue(() => {
    if (axis !== 'vertical') return 0
    return inverted ? screenWidth - halfW * progress.value : halfW
  })

  const shapeClipPath = mode === 'heart' ? heartPath : starPath
  const isShape = mode === 'heart' || mode === 'star'

  // Gate EVERYTHING inside the Canvas on `image` so the Canvas native view
  // stays permanently mounted (no layout pass when a transition starts) but
  // renders nothing between transitions. This is what prevents the Android
  // "new theme flash": if the Canvas mounts at the same commit as the theme
  // swap, its first paint has no content while the inner tree (already
  // mounted) paints the new colors — for one frame the user sees the new
  // theme even though the overlay is supposedly on top.
  return (
    <Canvas style={ABSOLUTE_FILL} pointerEvents="none">
      {image && (
        <>
          {mode === 'fade' && (
            <Group opacity={opacity}>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
            </Group>
          )}

          {mode === 'circularReveal' && !inverted && (
            <>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
              <Circle cx={originX} cy={originY} r={revealR} blendMode="clear" color="black" />
            </>
          )}

          {mode === 'circularReveal' && inverted && (
            <Circle cx={originX} cy={originY} r={invertedR}>
              <ImageShader image={image} fit="cover" width={screenWidth} height={screenHeight} />
            </Circle>
          )}

          {mode === 'wipe' && (
            <>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
              <Rect
                x={wipeX}
                y={wipeY}
                width={wipeW}
                height={wipeH}
                blendMode="clear"
                color="black"
              />
            </>
          )}

          {isShape && !inverted && (
            <>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
              <Group clip={shapeClipPath}>
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
          )}

          {isShape && inverted && (
            <Group clip={shapeClipPath}>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
            </Group>
          )}

          {mode === 'pixelize' && pixelizeShader && imageNew && (
            <Group opacity={pixelizeOpacity}>
              <Fill>
                <Shader source={pixelizeShader} uniforms={pixelizeUniforms}>
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
          )}

          {/* Fallback: while the second (new-theme) snapshot is being
          captured, pixelize has no shader inputs yet. Show the old
          snapshot at full opacity so the inner tree — which has already
          been swapped to the new theme — stays hidden under the overlay. */}
          {mode === 'pixelize' && !imageNew && (
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={screenWidth}
              height={screenHeight}
              fit="cover"
            />
          )}

          {mode === 'dissolve' && dissolveShader && (
            <Fill>
              <Shader source={dissolveShader} uniforms={dissolveUniforms}>
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
          )}

          {mode === 'slide' && imageNew && (
            <>
              <SkiaImage
                image={image}
                x={slideOldX}
                y={slideOldY}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
              <SkiaImage
                image={imageNew}
                x={slideNewX}
                y={slideNewY}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
            </>
          )}

          {mode === 'slide' && !imageNew && (
            <SkiaImage
              image={image}
              x={slideOldX}
              y={slideOldY}
              width={screenWidth}
              height={screenHeight}
              fit="cover"
            />
          )}

          {mode === 'split' && (
            <>
              <SkiaImage
                image={image}
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fit="cover"
              />
              {axis === 'horizontal' ? (
                <>
                  <Rect
                    x={0}
                    y={splitHTopY}
                    width={screenWidth}
                    height={splitHStripH}
                    blendMode="clear"
                    color="black"
                  />
                  <Rect
                    x={0}
                    y={splitHBottomY}
                    width={screenWidth}
                    height={splitHStripH}
                    blendMode="clear"
                    color="black"
                  />
                </>
              ) : (
                <>
                  <Rect
                    x={splitVLeftX}
                    y={0}
                    width={splitVStripW}
                    height={screenHeight}
                    blendMode="clear"
                    color="black"
                  />
                  <Rect
                    x={splitVRightX}
                    y={0}
                    width={splitVStripW}
                    height={screenHeight}
                    blendMode="clear"
                    color="black"
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </Canvas>
  )
}
