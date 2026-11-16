import { decideSetTheme, preferenceWriteTiming } from '../src/setThemeDecision'

describe('decideSetTheme', () => {
  const base = {
    transitioning: false,
    currentIntended: 'light',
    resolvedTarget: 'dark',
    modeFlipped: false,
  }

  it("returns 'ignored' (transitioning) when a transition is already running", () => {
    expect(decideSetTheme({ ...base, transitioning: true })).toEqual({
      status: 'ignored',
      reason: 'transitioning',
    })
  })

  it("returns 'ignored' (transitioning) even if the target matches the current intent", () => {
    expect(
      decideSetTheme({
        ...base,
        transitioning: true,
        resolvedTarget: 'light',
      }),
    ).toEqual({ status: 'ignored', reason: 'transitioning' })
  })

  it("returns 'ignored' (same-theme) when the target matches and the mode did not flip", () => {
    expect(
      decideSetTheme({
        ...base,
        resolvedTarget: 'light',
        modeFlipped: false,
      }),
    ).toEqual({ status: 'ignored', reason: 'same-theme' })
  })

  it("returns 'accepted' (mode-flip-noop) when the target matches but system mode flipped", () => {
    expect(
      decideSetTheme({
        ...base,
        resolvedTarget: 'light',
        modeFlipped: true,
      }),
    ).toEqual({ status: 'accepted', path: 'mode-flip-noop' })
  })

  it("returns 'accepted' (proceed) when the target differs from the current intent", () => {
    expect(
      decideSetTheme({
        ...base,
        resolvedTarget: 'dark',
      }),
    ).toEqual({ status: 'accepted', path: 'proceed' })
  })

  it("returns 'accepted' (proceed) when the target differs and the mode also flipped", () => {
    expect(
      decideSetTheme({
        ...base,
        resolvedTarget: 'dark',
        modeFlipped: true,
      }),
    ).toEqual({ status: 'accepted', path: 'proceed' })
  })

  it('prioritizes the transitioning guard over same-theme and mode-flip branches', () => {
    expect(
      decideSetTheme({
        transitioning: true,
        currentIntended: 'light',
        resolvedTarget: 'light',
        modeFlipped: true,
      }),
    ).toEqual({ status: 'ignored', reason: 'transitioning' })
  })
})

describe('preferenceWriteTiming', () => {
  it('defers an animated theme swap to the colour swap commit', () => {
    expect(preferenceWriteTiming('proceed', true)).toBe('deferred')
  })

  it('writes eagerly when the transition is instant', () => {
    expect(preferenceWriteTiming('proceed', false)).toBe('eager')
  })

  it('writes eagerly for a system-mode flip that keeps the painted theme', () => {
    expect(preferenceWriteTiming('mode-flip-noop', true)).toBe('eager')
    expect(preferenceWriteTiming('mode-flip-noop', false)).toBe('eager')
  })
})
