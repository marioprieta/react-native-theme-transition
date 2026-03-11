import { createThemeTransition } from '../src/createThemeTransition'

const light = { bg: '#fff', text: '#000' }
const dark = { bg: '#000', text: '#fff' }

describe('createThemeTransition — config validation', () => {
  it('returns ThemeTransitionProvider and useTheme on valid config', () => {
    const api = createThemeTransition({ themes: { light, dark } })
    expect(api.ThemeTransitionProvider).toBeDefined()
    expect(api.useTheme).toBeDefined()
  })

  it('throws on empty themes', () => {
    expect(() => createThemeTransition({ themes: {} })).toThrow(
      '`themes` must contain at least one theme',
    )
  })

  it('throws when "system" is used as a theme name', () => {
    expect(() => createThemeTransition({ themes: { system: light } })).toThrow('is a reserved name')
  })

  it('throws on mismatched token keys', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark: { bg: '#000', accent: '#f00' } },
      }),
    ).toThrow('different token keys')
  })

  it('throws on negative duration', () => {
    expect(() => createThemeTransition({ themes: { light, dark }, duration: -1 })).toThrow(
      '`duration` must be a finite non-negative number',
    )
  })

  it('throws on NaN duration', () => {
    expect(() => createThemeTransition({ themes: { light, dark }, duration: NaN })).toThrow(
      '`duration` must be a finite non-negative number',
    )
  })

  it('throws on Infinity duration', () => {
    expect(() => createThemeTransition({ themes: { light, dark }, duration: Infinity })).toThrow(
      '`duration` must be a finite non-negative number',
    )
  })

  it('accepts zero duration', () => {
    expect(() => createThemeTransition({ themes: { light, dark }, duration: 0 })).not.toThrow()
  })

  it('accepts positive duration', () => {
    expect(() => createThemeTransition({ themes: { light, dark }, duration: 500 })).not.toThrow()
  })

  it('throws on incomplete systemThemeMap (missing dark)', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        // @ts-expect-error testing runtime validation
        systemThemeMap: { light: 'light' },
      }),
    ).toThrow('`systemThemeMap` must provide both `light` and `dark` keys')
  })

  it('throws on incomplete systemThemeMap (missing light)', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        // @ts-expect-error testing runtime validation
        systemThemeMap: { dark: 'dark' },
      }),
    ).toThrow('`systemThemeMap` must provide both `light` and `dark` keys')
  })

  it('throws when systemThemeMap.dark references nonexistent theme', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        // @ts-expect-error testing runtime validation
        systemThemeMap: { light: 'light', dark: 'ocean' },
      }),
    ).toThrow('does not exist in themes')
  })

  it('throws when systemThemeMap.light references nonexistent theme', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        // @ts-expect-error testing runtime validation
        systemThemeMap: { light: 'sunshine', dark: 'dark' },
      }),
    ).toThrow('does not exist in themes')
  })

  it('accepts valid systemThemeMap', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        systemThemeMap: { light: 'light', dark: 'dark' },
      }),
    ).not.toThrow()
  })

  it('accepts custom-named themes with systemThemeMap', () => {
    const day = { bg: '#fff', text: '#000' }
    const night = { bg: '#000', text: '#fff' }
    expect(() =>
      createThemeTransition({
        themes: { day, night },
        systemThemeMap: { light: 'day', dark: 'night' },
      }),
    ).not.toThrow()
  })

  it('works with a single theme', () => {
    const api = createThemeTransition({ themes: { light } })
    expect(api.ThemeTransitionProvider).toBeDefined()
  })

  it('works with 3+ themes sharing identical keys', () => {
    const ocean = { bg: '#036', text: '#eef' }
    const api = createThemeTransition({ themes: { light, dark, ocean } })
    expect(api.ThemeTransitionProvider).toBeDefined()
    expect(api.useTheme).toBeDefined()
  })

  it('detects key count mismatch (extra key)', () => {
    expect(() =>
      createThemeTransition({
        themes: {
          light: { bg: '#fff', text: '#000' },
          dark: { bg: '#000', text: '#fff', accent: '#f00' },
        },
      }),
    ).toThrow('different token keys')
  })

  it('detects key name mismatch (same count)', () => {
    expect(() =>
      createThemeTransition({
        themes: {
          light: { bg: '#fff', text: '#000' },
          dark: { bg: '#000', label: '#fff' },
        },
      }),
    ).toThrow('different token keys')
  })

  it('validates all themes against the first, not just adjacent pairs', () => {
    const ocean = { bg: '#036', accent: '#f00' } // different keys from light
    expect(() => createThemeTransition({ themes: { light, dark, ocean } })).toThrow(
      'different token keys',
    )
  })
})
