/**
 * Compile-time guards for the v2 public API shape. None of this code
 * runs meaningful assertions — if the file compiles, the v2 contract
 * is intact. Jest runs it to fail the build on any type-level
 * regression (e.g. a reintroduced field, a renamed option, a dropped
 * variant). See `docs/superpowers/notes/v2-design-decisions.md` for
 * the full rationale.
 */

import type { SetThemeOptions, ThemeTransitionConfig, UseThemeResult } from '../src/types'

type Names = 'light' | 'dark'
type Tokens = 'background' | 'text'

describe('v2 api shape', () => {
  it('UseThemeResult splits theme (painted) from preference (user pick)', () => {
    const sample: UseThemeResult<Tokens, Names> = {
      theme: {
        name: 'dark',
        colors: { background: '#000', text: '#fff' },
        scheme: 'dark',
      },
      preference: 'dark',
      setTheme: () => 'accepted',
      isTransitioning: false,
    }
    expect(sample.theme.name).toBe('dark')
    expect(sample.theme.colors.background).toBe('#000')
    expect(sample.theme.scheme).toBe('dark')
    expect(sample.preference).toBe('dark')
    expect(sample.isTransitioning).toBe(false)
    expect(sample.setTheme('light')).toBe('accepted')
  })

  it("preference is the only field that accepts 'system'", () => {
    const sample: UseThemeResult<Tokens, Names> = {
      theme: {
        name: 'dark', // resolved from OS while user follows system
        colors: { background: '#000', text: '#fff' },
        scheme: 'dark',
      },
      preference: 'system', // user's explicit pick
      setTheme: () => 'accepted',
      isTransitioning: false,
    }
    expect(sample.preference).toBe('system')
    expect(sample.theme.name).toBe('dark')
  })

  it("theme.name rejects 'system' at the type level", () => {
    const _bad: UseThemeResult<Tokens, Names>['theme'] = {
      // @ts-expect-error — theme.name is always resolved (Names), never 'system'
      name: 'system',
      colors: { background: '#fff', text: '#000' },
      scheme: 'light',
    }
    void _bad
  })

  it("setTheme returns 'accepted' | 'ignored'", () => {
    const api: UseThemeResult<Tokens, Names> = {
      theme: { name: 'light', colors: { background: '#fff', text: '#000' }, scheme: 'light' },
      preference: 'light',
      setTheme: (name) => (name === 'light' ? 'ignored' : 'accepted'),
      isTransitioning: false,
    }
    const r1: 'accepted' | 'ignored' = api.setTheme('dark')
    const r2: 'accepted' | 'ignored' = api.setTheme('light')
    expect([r1, r2]).toEqual(['accepted', 'ignored'])
  })

  it('SetThemeOptions covers every v2 variant', () => {
    const fade: SetThemeOptions<Names> = { transition: 'fade' }
    const circle: SetThemeOptions<Names> = {
      transition: 'circularReveal',
      origin: { x: 0, y: 0 },
      inverted: true,
    }
    const heart: SetThemeOptions<Names> = {
      transition: 'heart',
      origin: { x: 100, y: 200 },
      inverted: false,
    }
    const star: SetThemeOptions<Names> = { transition: 'star' }
    const wipe: SetThemeOptions<Names> = { transition: 'wipe', direction: 'right' }
    const slide: SetThemeOptions<Names> = { transition: 'slide', direction: 'up' }
    const split: SetThemeOptions<Names> = {
      transition: 'split',
      mode: 'top-bottom',
      inverted: true,
    }
    const pixelize: SetThemeOptions<Names> = { transition: 'pixelize', blockSize: 40 }
    const dissolve: SetThemeOptions<Names> = { transition: 'dissolve', noiseSize: 8 }

    // Every variant must coexist with the base fields.
    const full: SetThemeOptions<Names> = {
      transition: 'circularReveal',
      origin: { x: 0, y: 0 },
      duration: 400,
      animated: true,
      onTransitionStart: () => {},
      onTransitionEnd: () => {},
    }

    expect([fade, circle, heart, star, wipe, slide, split, pixelize, dissolve, full]).toHaveLength(
      10,
    )
  })

  it('ThemeTransitionConfig rejects removed v2 options', () => {
    type Cfg = ThemeTransitionConfig<{ light: Record<Tokens, string> }>
    const base: Cfg = {
      themes: { light: { background: '#fff', text: '#000' } },
    }
    // `@ts-expect-error` lives on the line immediately before the offending
    // property so the suppression lands on that exact error.
    const _rm: Cfg = {
      ...base,
      // @ts-expect-error — `reduceMotion` was removed in v2
      reduceMotion: true,
    }
    const _dur: Cfg = {
      ...base,
      // @ts-expect-error — `duration` at config level was removed in v2
      duration: 300,
    }
    const _bg: Cfg = {
      ...base,
      // @ts-expect-error — `backgroundColor` config option was removed in v2
      backgroundColor: () => '#fff',
    }
    void _rm
    void _dur
    void _bg
  })

  it('SetThemeOptions rejects removed field names', () => {
    const _grain: SetThemeOptions<Names> = {
      transition: 'dissolve',
      // @ts-expect-error — renamed to `noiseSize` in v2
      grainSize: 5,
    }
    const _axis: SetThemeOptions<Names> = {
      transition: 'split',
      // @ts-expect-error — renamed to `mode` in v2
      axis: 'horizontal',
    }
    const _dia: SetThemeOptions<Names> = {
      // @ts-expect-error — `'diamond'` transition was removed in v2
      transition: 'diamond',
    }
    void _grain
    void _axis
    void _dia
  })
})
