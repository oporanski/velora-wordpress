import { describe, it, expect, vi } from 'vitest'
import { normalizeBreeds, breedName, colorName } from '../breeds'

describe('normalizeBreeds', () => {
  it('returns strings unchanged', () => {
    expect(normalizeBreeds(['Maine Coon', 'Ragdoll'])).toEqual(['Maine Coon', 'Ragdoll'])
  })

  it('extracts name from breed objects', () => {
    expect(normalizeBreeds([{ name: 'Maine Coon' }, { name: 'Ragdoll' }])).toEqual(['Maine Coon', 'Ragdoll'])
  })

  it('handles mixed string and object shapes', () => {
    expect(normalizeBreeds(['Maine Coon', { name: 'Ragdoll' }])).toEqual(['Maine Coon', 'Ragdoll'])
  })

  it('filters out objects with empty name', () => {
    expect(normalizeBreeds([{ name: '' }])).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(normalizeBreeds([])).toEqual([])
  })

  it('preserves order across mixed shapes', () => {
    expect(normalizeBreeds(['Abyssinian', { name: 'Birman' }, 'Devon Rex'])).toEqual([
      'Abyssinian',
      'Birman',
      'Devon Rex',
    ])
  })

  it('warns when skipping an empty-name breed object', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    normalizeBreeds([{ name: '' }])
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })
})

describe('breedName', () => {
  it('prefers a flat breed string when present', () => {
    expect(breedName({ breed: 'Maine Coon' })).toBe('Maine Coon')
  })

  it('falls back to breedRef.name when no flat string', () => {
    expect(breedName({ breedRef: { name: 'Ragdoll' } })).toBe('Ragdoll')
  })

  it('prefers flat breed over breedRef when both present', () => {
    expect(breedName({ breed: 'Sphynx', breedRef: { name: 'Ragdoll' } })).toBe('Sphynx')
  })

  it('returns empty string when neither is present', () => {
    expect(breedName({})).toBe('')
  })

  it('returns empty string when both are null', () => {
    expect(breedName({ breed: null, breedRef: null })).toBe('')
  })
})

describe('colorName', () => {
  it('prefers a flat color string when present', () => {
    expect(colorName({ color: 'Black' })).toBe('Black')
  })

  it('falls back to colorRef.nameEn when no flat string', () => {
    // English only — colour names are not translated (see the portal's `colorLabel`).
    expect(colorName({ colorRef: { nameEn: 'Black', emsCode: 'n' } })).toBe('Black')
  })

  it('falls back to colorRef.emsCode when nameEn is empty', () => {
    expect(colorName({ colorRef: { nameEn: '', emsCode: 'n 22' } })).toBe('n 22')
  })

  it('returns empty string when nothing is present', () => {
    expect(colorName({})).toBe('')
  })
})
