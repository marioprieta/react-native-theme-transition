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

  it('accepts empty darkThemes array', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        darkThemes: [],
      }),
    ).not.toThrow()
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

  it('accepts duration with systemThemeMap and darkThemes together', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        duration: 200,
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
