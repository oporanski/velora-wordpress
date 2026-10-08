import { describe, it, expect } from 'vitest'
import { pickFeaturedPoster } from '../pick-featured-poster'
import type { VeloraEvent } from '../api-client'

// Local noon, so the viewer's calendar day is 2026-10-10 in any timezone.
const NOW = new Date(2026, 9, 10, 12, 0, 0)

function event(overrides: Partial<VeloraEvent> & { id: string }): VeloraEvent {
  return {
    title: overrides.id,
    slug: overrides.id,
    startDate: '2026-10-20',
    endDate: null,
    city: null,
    country: null,
    imageUrl: '/uploads/poster',
    ...overrides,
  }
}

describe('pickFeaturedPoster', () => {
  it('returns undefined for an empty list', () => {
    expect(pickFeaturedPoster([], NOW)).toBeUndefined()
  })

  it('picks the earliest start, not the first element', () => {
    const picked = pickFeaturedPoster(
      [event({ id: 'late', startDate: '2026-12-01' }), event({ id: 'soon', startDate: '2026-10-12' })],
      NOW,
    )
    expect(picked?.id).toBe('soon')
  })

  it('counts a running event (started before today, ends after it)', () => {
    const picked = pickFeaturedPoster(
      [event({ id: 'running', startDate: '2026-10-08', endDate: '2026-10-12' }), event({ id: 'next', startDate: '2026-10-15' })],
      NOW,
    )
    expect(picked?.id).toBe('running')
  })

  it('counts an event that ends today (endDate is inclusive)', () => {
    const picked = pickFeaturedPoster([event({ id: 'ends-today', startDate: '2026-10-09', endDate: '2026-10-10' })], NOW)
    expect(picked?.id).toBe('ends-today')
  })

  it('skips an event that ended yesterday', () => {
    expect(pickFeaturedPoster([event({ id: 'over', startDate: '2026-10-08', endDate: '2026-10-09' })], NOW)).toBeUndefined()
  })

  it('uses startDate when there is no endDate', () => {
    expect(pickFeaturedPoster([event({ id: 'yesterday', startDate: '2026-10-09' })], NOW)).toBeUndefined()
    expect(pickFeaturedPoster([event({ id: 'today', startDate: '2026-10-10' })], NOW)?.id).toBe('today')
  })

  it('compares the date part of a full timestamp', () => {
    const picked = pickFeaturedPoster([event({ id: 'ts', startDate: '2026-10-10T00:00:00.000Z' })], NOW)
    expect(picked?.id).toBe('ts')
  })

  it('skips events without a poster in favour of a later one that has it', () => {
    const picked = pickFeaturedPoster(
      [event({ id: 'no-poster', startDate: '2026-10-11', imageUrl: null }), event({ id: 'with-poster', startDate: '2026-11-01' })],
      NOW,
    )
    expect(picked?.id).toBe('with-poster')
  })

  it('keeps input order on a tie', () => {
    const picked = pickFeaturedPoster(
      [event({ id: 'first', startDate: '2026-10-20' }), event({ id: 'second', startDate: '2026-10-20' })],
      NOW,
    )
    expect(picked?.id).toBe('first')
  })

  it('does not mutate the input array', () => {
    const input = [event({ id: 'b', startDate: '2026-11-01' }), event({ id: 'a', startDate: '2026-10-12' })]
    pickFeaturedPoster(input, NOW)
    expect(input.map((e) => e.id)).toEqual(['b', 'a'])
  })
})
