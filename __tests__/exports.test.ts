import * as publicApi from '../src/index'
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

  it('does not export removed v2 symbols', () => {
    // Guard against silent regressions re-adding deleted exports.
    // These were removed in v2 and must stay out of the public API.
    const removed = ['useReducedMotion', 'SelectOptions', 'UseThemeOptions']
    for (const name of removed) {
      expect((publicApi as Record<string, unknown>)[name]).toBeUndefined()
    }
  })
})
