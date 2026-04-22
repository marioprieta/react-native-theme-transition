import { createThemeTransition } from '../src/createThemeTransition'

const light = { bg: '#fff', text: '#000' }
const dark = { bg: '#000', text: '#fff' }

describe('createThemeTransition — config edge cases', () => {
  it('accepts darkThemes array', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        darkThemes: ['dark'],
      }),
    ).not.toThrow()
  })

  it('throws on empty darkThemes array', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        darkThemes: [],
      }),
    ).toThrow(/`darkThemes` cannot be an empty array/)
  })

  it('accepts all callback options', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        onTransitionStart: () => {},
        onTransitionEnd: () => {},
        onThemeChange: () => {},
      }),
    ).not.toThrow()
  })

  it('accepts systemThemeMap and darkThemes together', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        systemThemeMap: { light: 'light', dark: 'dark' },
        darkThemes: ['dark'],
        onTransitionStart: () => {},
        onTransitionEnd: () => {},
        onThemeChange: () => {},
      }),
    ).not.toThrow()
  })

  it('multiple themes with custom systemThemeMap', () => {
    const sunrise = { bg: '#ffecd2', text: '#333' }
    const midnight = { bg: '#1a1a2e', text: '#eee' }
    const ocean = { bg: '#036', text: '#eef' }

    const api = createThemeTransition({
      themes: { sunrise, midnight, ocean },
      systemThemeMap: { light: 'sunrise', dark: 'midnight' },
      darkThemes: ['midnight'],
    })

    expect(api.ThemeTransitionProvider).toBeDefined()
    expect(api.useTheme).toBeDefined()
  })
})
