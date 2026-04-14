import { createThemeTransition } from '../src/index'

describe('Public API exports', () => {
  it('exports createThemeTransition as a function', () => {
    expect(typeof createThemeTransition).toBe('function')
  })

  it('createThemeTransition returns ThemeTransitionProvider and useTheme', () => {
    const api = createThemeTransition({
      themes: {
        light: { bg: '#fff' },
        dark: { bg: '#000' },
      },
    })
    expect(typeof api.ThemeTransitionProvider).toBe('function')
    expect(typeof api.useTheme).toBe('function')
  })

  it('accepts transition config field (2.0)', () => {
    const api = createThemeTransition({
      themes: {
        light: { bg: '#fff' },
        dark: { bg: '#000' },
      },
      transition: 'circularReveal',
    })
    expect(typeof api.ThemeTransitionProvider).toBe('function')
    expect(typeof api.useTheme).toBe('function')
  })
})
