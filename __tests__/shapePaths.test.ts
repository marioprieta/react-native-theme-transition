import { PathVerb, Skia } from '@shopify/react-native-skia'
import {
  heartCommands,
  makeHeartPath,
  makeStarPath,
  orderKeyframes,
  starCommands,
} from '../src/overlay/shapePaths'

const mockedMakeFromCmds = jest.mocked(Skia.Path.MakeFromCmds)

/** Returns the verb of every command the contour is built from. */
function verbSequence(commands: number[][]): number[] {
  return commands.map((command) => command[0])
}

beforeEach(() => {
  mockedMakeFromCmds.mockClear()
})

describe('Skia path verb contract', () => {
  it('uses the verb codes published by @shopify/react-native-skia', () => {
    expect(PathVerb.Move).toBe(0)
    expect(PathVerb.Line).toBe(1)
    expect(PathVerb.Cubic).toBe(4)
    expect(PathVerb.Close).toBe(5)
  })
})

describe('heartCommands', () => {
  it('emits Move, two Cubics and Close with the documented coordinates', () => {
    const commands = heartCommands(100, 200, 50, 50)

    expect(commands).toEqual([
      [0, 100, 235], // Move to the bottom tip
      [4, 40, 205, 65, 155, 100, 172.5], // left lobe + top notch
      [4, 135, 155, 160, 205, 100, 235], // right lobe back to the bottom tip
      [5], // Close
    ])
  })

  it('keeps the tiny and full keyframes on the same verb topology', () => {
    const tiny = heartCommands(10, 20, 1, 1)
    const full = heartCommands(10, 20, 500, 500)

    expect(verbSequence(tiny)).toEqual([0, 4, 4, 5])
    expect(verbSequence(full)).toEqual([0, 4, 4, 5])
    expect(full).toHaveLength(tiny.length)
  })
})

describe('starCommands', () => {
  it('emits Move, nine Lines and Close', () => {
    const commands = starCommands(0, 0, 10, 4)

    expect(commands).toHaveLength(11)
    expect(commands[0][0]).toBe(PathVerb.Move)
    for (let i = 1; i <= 9; i++) {
      expect(commands[i][0]).toBe(PathVerb.Line)
    }
    expect(commands[10][0]).toBe(PathVerb.Close)
  })

  it('places alternating outer tips and inner valleys around the center', () => {
    const cx = 10
    const cy = 20
    const rOuter = 100
    const rInner = 40
    const commands = starCommands(cx, cy, rOuter, rInner)

    // First tip sits straight above the center at the outer radius.
    expect(commands[0][1]).toBeCloseTo(10, 10)
    expect(commands[0][2]).toBeCloseTo(-80, 10)
    // First valley sits at +36° with the inner radius.
    expect(commands[1][1]).toBeCloseTo(33.51141009169893, 10)
    expect(commands[1][2]).toBeCloseTo(-12.360679774997898, 10)

    for (let i = 0; i < 10; i++) {
      const x = commands[i][1]
      const y = commands[i][2]
      const radius = i % 2 === 0 ? rOuter : rInner
      const angle = -Math.PI / 2 + (i * Math.PI) / 5

      expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(radius, 10)
      expect(x).toBeCloseTo(cx + Math.cos(angle) * radius, 10)
      expect(y).toBeCloseTo(cy + Math.sin(angle) * radius, 10)
    }
  })

  it('keeps the tiny and full keyframes on the same verb topology', () => {
    const tiny = starCommands(10, 20, 1, 0.4)
    const full = starCommands(10, 20, 500, 200)

    expect(verbSequence(tiny)).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5])
    expect(verbSequence(full)).toEqual(verbSequence(tiny))
    expect(full).toHaveLength(tiny.length)
  })
})

describe('immutable path construction', () => {
  it('builds the heart path from the full command list in one call', () => {
    const commands = heartCommands(10, 20, 30, 40)
    const path = makeHeartPath(10, 20, 30, 40)

    expect(mockedMakeFromCmds).toHaveBeenCalledTimes(1)
    expect(mockedMakeFromCmds.mock.calls[0][0]).toEqual(commands)
    expect(path).toBe(mockedMakeFromCmds.mock.results[0].value)
  })

  it('builds the star path from the full command list in one call', () => {
    const commands = starCommands(10, 20, 30, 12)
    const path = makeStarPath(10, 20, 30, 12)

    expect(mockedMakeFromCmds).toHaveBeenCalledTimes(1)
    expect(mockedMakeFromCmds.mock.calls[0][0]).toEqual(commands)
    expect(path).toBe(mockedMakeFromCmds.mock.results[0].value)
  })

  it('throws a descriptive error when the heart factory returns null', () => {
    mockedMakeFromCmds.mockReturnValueOnce(null)

    expect(() => makeHeartPath(0, 0, 10, 10)).toThrow(
      /Skia\.Path\.MakeFromCmds returned null while building the heart/,
    )
  })

  it('throws a descriptive error when the star factory returns null', () => {
    mockedMakeFromCmds.mockReturnValueOnce(null)

    expect(() => makeStarPath(0, 0, 10, 4)).toThrow(
      /Skia\.Path\.MakeFromCmds returned null while building the star/,
    )
  })
})

describe('orderKeyframes', () => {
  it('grows the shape from tiny to full when not inverted', () => {
    const tiny = makeHeartPath(0, 0, 1, 1)
    const full = makeHeartPath(0, 0, 10, 10)

    expect(orderKeyframes(false, tiny, full)).toEqual([tiny, full])
  })

  it('shrinks the shape from full to tiny when inverted', () => {
    const tiny = makeHeartPath(0, 0, 1, 1)
    const full = makeHeartPath(0, 0, 10, 10)
    const ordered = orderKeyframes(true, tiny, full)

    expect(ordered[0]).toBe(full)
    expect(ordered[1]).toBe(tiny)
  })

  it('guarantees keyframes[0] on inverted mode is the full-screen path to prevent frame-0 transparent flash', () => {
    const tiny = makeHeartPath(100, 200, 1, 1)
    const full = makeHeartPath(100, 200, 500, 500)
    const invertedKeyframes = orderKeyframes(true, tiny, full)

    expect(invertedKeyframes[0]).toBe(full)
    expect(invertedKeyframes[0]).not.toBe(tiny)
  })
})
