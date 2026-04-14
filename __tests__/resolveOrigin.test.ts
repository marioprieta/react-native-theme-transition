import type { View } from 'react-native'
import { calculateMaxRadius, resolveOrigin } from '../src/overlay/resolveOrigin'

type ViewRef = React.RefObject<View | null>

describe('resolveOrigin', () => {
  const screenW = 390
  const screenH = 844

  it('returns explicit origin when provided', () => {
    expect(resolveOrigin({ x: 100, y: 200 }, screenW, screenH)).toEqual({ x: 100, y: 200 })
  })

  it('measures ref when a ref is passed', () => {
    const measure = jest.fn(
      (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => {
        cb(0, 0, 40, 40, 100, 200)
      },
    )
    const ref = { current: { measure } } as unknown as ViewRef
    expect(resolveOrigin(ref, screenW, screenH)).toEqual({ x: 120, y: 220 })
  })

  it('returns screen center when origin is undefined', () => {
    expect(resolveOrigin(undefined, screenW, screenH)).toEqual({ x: 195, y: 422 })
  })

  it('returns screen center when ref.current is null', () => {
    const nullRef = { current: null } as ViewRef
    expect(resolveOrigin(nullRef, screenW, screenH)).toEqual({ x: 195, y: 422 })
  })
})

describe('calculateMaxRadius', () => {
  it('from top-left corner', () => {
    expect(calculateMaxRadius(0, 0, 390, 844)).toBeCloseTo(Math.hypot(390, 844))
  })

  it('from center', () => {
    expect(calculateMaxRadius(195, 422, 390, 844)).toBeCloseTo(Math.hypot(195, 422))
  })

  it('from bottom-right', () => {
    expect(calculateMaxRadius(390, 844, 390, 844)).toBeCloseTo(Math.hypot(390, 844))
  })

  it('from off-screen', () => {
    expect(calculateMaxRadius(-100, -100, 390, 844)).toBeCloseTo(Math.hypot(490, 944))
  })
})
