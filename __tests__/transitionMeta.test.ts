import { TRANSITION_META, TRANSITION_TYPES } from '../src/transitionMeta'

describe('transition metadata', () => {
  it('keeps TRANSITION_TYPES aligned with TRANSITION_META keys', () => {
    const metaKeys = Object.keys(TRANSITION_META).sort()
    const typeKeys = [...TRANSITION_TYPES].sort()
    expect(typeKeys).toEqual(metaKeys)
  })

  it('exposes exactly the 9 v2 transition types', () => {
    expect(TRANSITION_TYPES).toHaveLength(9)
    expect(TRANSITION_TYPES).toEqual(
      expect.arrayContaining([
        'fade',
        'circularReveal',
        'wipe',
        'slide',
        'split',
        'heart',
        'star',
        'pixelize',
        'dissolve',
      ]),
    )
  })

  it('does not expose the removed `diamond` transition', () => {
    expect(TRANSITION_TYPES).not.toContain('diamond' as never)
    expect(TRANSITION_META).not.toHaveProperty('diamond')
  })

  it('marks reveal and shape transitions as origin-dependent', () => {
    expect(TRANSITION_META.circularReveal.needsOrigin).toBe(true)
    expect(TRANSITION_META.heart.needsOrigin).toBe(true)
    expect(TRANSITION_META.star.needsOrigin).toBe(true)

    expect(TRANSITION_META.fade.needsOrigin).toBe(false)
    expect(TRANSITION_META.wipe.needsOrigin).toBe(false)
    expect(TRANSITION_META.slide.needsOrigin).toBe(false)
    expect(TRANSITION_META.split.needsOrigin).toBe(false)
    expect(TRANSITION_META.pixelize.needsOrigin).toBe(false)
    expect(TRANSITION_META.dissolve.needsOrigin).toBe(false)
  })

  it('keeps default durations stable by transition family', () => {
    expect(TRANSITION_META.fade.defaultDuration).toBe(350)
    expect(TRANSITION_META.circularReveal.defaultDuration).toBe(350)
    expect(TRANSITION_META.wipe.defaultDuration).toBe(350)
    expect(TRANSITION_META.slide.defaultDuration).toBe(350)
    expect(TRANSITION_META.split.defaultDuration).toBe(350)

    expect(TRANSITION_META.heart.defaultDuration).toBe(800)
    expect(TRANSITION_META.star.defaultDuration).toBe(800)

    expect(TRANSITION_META.pixelize.defaultDuration).toBe(750)
    expect(TRANSITION_META.dissolve.defaultDuration).toBe(750)
  })

  it('keeps invertibility flags aligned with behavior', () => {
    expect(TRANSITION_META.circularReveal.invertible).toBe(true)
    expect(TRANSITION_META.heart.invertible).toBe(true)
    expect(TRANSITION_META.star.invertible).toBe(true)
    expect(TRANSITION_META.split.invertible).toBe(true)

    expect(TRANSITION_META.fade.invertible).toBe(false)
    expect(TRANSITION_META.wipe.invertible).toBe(false)
    expect(TRANSITION_META.slide.invertible).toBe(false)
    expect(TRANSITION_META.pixelize.invertible).toBe(false)
    expect(TRANSITION_META.dissolve.invertible).toBe(false)
  })

  it('only requires new snapshot capture for transitions that render both themes', () => {
    expect(TRANSITION_META.slide.capturesNew).toBe(true)
    expect(TRANSITION_META.pixelize.capturesNew).toBe(true)

    expect(TRANSITION_META.fade.capturesNew).toBe(false)
    expect(TRANSITION_META.circularReveal.capturesNew).toBe(false)
    expect(TRANSITION_META.wipe.capturesNew).toBe(false)
    expect(TRANSITION_META.split.capturesNew).toBe(false)
    expect(TRANSITION_META.heart.capturesNew).toBe(false)
    expect(TRANSITION_META.star.capturesNew).toBe(false)
    expect(TRANSITION_META.dissolve.capturesNew).toBe(false)
  })
})
