import { createThemeTransition } from '../src/createThemeTransition'

const light = { bg: '#fff', text: '#000' }
const dark = { bg: '#000', text: '#fff' }

describe('createThemeTransition — transition config', () => {
  it('accepts transition: "fade"', () => {
    expect(() =>
      createThemeTransition({ themes: { light, dark }, transition: 'fade' }),
    ).not.toThrow()
  })

  it('accepts transition: "circularReveal"', () => {
    expect(() =>
      createThemeTransition({ themes: { light, dark }, transition: 'circularReveal' }),
    ).not.toThrow()
  })

  it('accepts shape transitions (heart, star)', () => {
    expect(() =>
      createThemeTransition({ themes: { light, dark }, transition: 'heart' }),
    ).not.toThrow()
    expect(() =>
      createThemeTransition({ themes: { light, dark }, transition: 'star' }),
    ).not.toThrow()
  })

  it('rejects removed transition: "invertedCircularReveal" (use { inverted: true })', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        // @ts-expect-error removed in 2.0 — use { transition: 'circularReveal', inverted: true }
        transition: 'invertedCircularReveal',
      }),
    ).toThrow('must be one of')
  })

  it('accepts omitted transition (defaults to fade)', () => {
    expect(() => createThemeTransition({ themes: { light, dark } })).not.toThrow()
  })

  it('throws on invalid transition value', () => {
    expect(() =>
      createThemeTransition({
        themes: { light, dark },
        // @ts-expect-error testing runtime validation
        transition: 'nonexistent',
      }),
    ).toThrow('must be one of')
  })
})
