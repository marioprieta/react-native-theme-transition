import { createRef } from 'react'
import type { View } from 'react-native'
import { validateSetThemeOptions } from '../src/validateSetThemeOptions'

describe('validateSetThemeOptions', () => {
  it('returns silently for undefined options', () => {
    expect(() => validateSetThemeOptions(undefined)).not.toThrow()
  })

  it('returns silently for an empty object', () => {
    expect(() => validateSetThemeOptions({})).not.toThrow()
  })

  describe('duration', () => {
    it.each([0, 1, 100, 1000])('accepts non-negative finite number: %p', (value) => {
      expect(() => validateSetThemeOptions({ duration: value })).not.toThrow()
    })

    it.each([
      [-1, '-1'],
      [Number.NaN, 'NaN'],
      [Number.POSITIVE_INFINITY, 'Infinity'],
      [Number.NEGATIVE_INFINITY, '-Infinity'],
    ])('throws on invalid duration: %p', (value, label) => {
      expect(() => validateSetThemeOptions({ duration: value })).toThrow(
        new RegExp(`\`duration\` must be a non-negative finite number\\. Got ${label}`),
      )
    })

    it('throws when duration is not a number at all', () => {
      // @ts-expect-error - testing runtime guard against bad input
      expect(() => validateSetThemeOptions({ duration: '500' })).toThrow(/duration/)
    })
  })

  describe('blockSize', () => {
    it.each([2, 32, 100])('accepts finite number >= 2: %p', (value) => {
      expect(() => validateSetThemeOptions({ blockSize: value })).not.toThrow()
    })

    it.each([
      1,
      0,
      -10,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])('throws on invalid blockSize: %p', (value) => {
      expect(() => validateSetThemeOptions({ blockSize: value })).toThrow(
        /`blockSize` must be a finite number >= 2/,
      )
    })
  })

  describe('noiseSize', () => {
    it.each([1, 5, 50])('accepts finite number >= 1: %p', (value) => {
      expect(() => validateSetThemeOptions({ noiseSize: value })).not.toThrow()
    })

    it.each([
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])('throws on invalid noiseSize: %p', (value) => {
      expect(() => validateSetThemeOptions({ noiseSize: value })).toThrow(
        /`noiseSize` must be a finite number >= 1/,
      )
    })
  })

  describe('origin', () => {
    it('accepts a valid coordinate pair', () => {
      expect(() => validateSetThemeOptions({ origin: { x: 100, y: 200 } })).not.toThrow()
    })

    it('accepts an origin at (0, 0)', () => {
      expect(() => validateSetThemeOptions({ origin: { x: 0, y: 0 } })).not.toThrow()
    })

    it('throws on NaN x', () => {
      expect(() => validateSetThemeOptions({ origin: { x: Number.NaN, y: 0 } })).toThrow(
        /`origin` coordinates must be finite numbers/,
      )
    })

    it('throws on NaN y', () => {
      expect(() => validateSetThemeOptions({ origin: { x: 0, y: Number.NaN } })).toThrow(
        /`origin` coordinates must be finite numbers/,
      )
    })

    it('throws on Infinity coordinates', () => {
      expect(() =>
        validateSetThemeOptions({ origin: { x: Number.POSITIVE_INFINITY, y: 0 } }),
      ).toThrow(/`origin` coordinates must be finite numbers/)
    })

    it('skips validation when origin is a ref (handled at measurement time)', () => {
      const ref = createRef<View>()
      expect(() => validateSetThemeOptions({ origin: ref })).not.toThrow()
    })
  })

  it('validates multiple options independently and throws on the first invalid one', () => {
    expect(() => validateSetThemeOptions({ duration: 100, blockSize: 1 })).toThrow(/blockSize/)
  })

  it('does not throw when every option is valid', () => {
    const ref = createRef<View>()
    expect(() =>
      validateSetThemeOptions({
        duration: 350,
        blockSize: 52,
        noiseSize: 5,
        origin: ref,
      }),
    ).not.toThrow()
  })
})
