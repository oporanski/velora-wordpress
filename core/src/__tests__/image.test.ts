import { describe, it, expect } from 'vitest'
import { imgSrc } from '../image'
import type { ImageVariant } from '../image'

describe('imgSrc', () => {
  // -----------------------------------------------------------------------
  // Null / empty guards
  // -----------------------------------------------------------------------

  it('returns empty string for null', () => {
    expect(imgSrc(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(imgSrc(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(imgSrc('')).toBe('')
  })

  // -----------------------------------------------------------------------
  // blob: / data: pass-through
  // -----------------------------------------------------------------------

  it('returns blob URL unchanged', () => {
    const url = 'blob:https://example.com/abc-123'
    expect(imgSrc(url)).toBe(url)
  })

  it('returns data: URL unchanged', () => {
    const url = 'data:image/png;base64,abc123'
    expect(imgSrc(url)).toBe(url)
  })

  // -----------------------------------------------------------------------
  // Static assets — already have extension
  // -----------------------------------------------------------------------

  it('returns relative URL with extension unchanged', () => {
    expect(imgSrc('/img/cat1.webp')).toBe('/img/cat1.webp')
  })

  it('returns relative URL with .jpg extension unchanged', () => {
    expect(imgSrc('/uploads/photo.jpg')).toBe('/uploads/photo.jpg')
  })

  it('returns absolute URL with extension unchanged', () => {
    const url = 'https://cdn.example.com/cat.jpg'
    expect(imgSrc(url)).toBe(url)
  })

  // -----------------------------------------------------------------------
  // Velora upload references — append variant suffix
  // -----------------------------------------------------------------------

  it('appends -lg.webp as default variant for extension-less URL', () => {
    expect(imgSrc('/uploads/abc123')).toBe('/uploads/abc123-lg.webp')
  })

  it('appends -thumb.webp for thumb variant', () => {
    expect(imgSrc('/uploads/abc123', 'thumb')).toBe('/uploads/abc123-thumb.webp')
  })

  it('appends -md.webp for md variant', () => {
    expect(imgSrc('/uploads/abc123', 'md')).toBe('/uploads/abc123-md.webp')
  })

  it('appends -original.webp for original variant', () => {
    expect(imgSrc('/uploads/abc123', 'original')).toBe('/uploads/abc123-original.webp')
  })

  // -----------------------------------------------------------------------
  // Velora CDN bypass — absolute *.velora.pet/uploads/ URLs
  // Backend proxy redirects with CORP: same-origin; go directly to CDN.
  // -----------------------------------------------------------------------

  it('rewrites velora.pet upload URL to CDN with thumb variant', () => {
    expect(imgSrc('https://velora.pet/uploads/abc123', 'thumb')).toBe(
      'https://images.velora.pet/abc123-thumb.webp',
    )
  })

  it('rewrites velora.pet upload URL to CDN with default lg variant', () => {
    expect(imgSrc('https://velora.pet/uploads/abc123')).toBe(
      'https://images.velora.pet/abc123-lg.webp',
    )
  })

  it('rewrites dev.velora.pet upload URL to CDN', () => {
    expect(imgSrc('https://dev.velora.pet/uploads/abc123', 'md')).toBe(
      'https://images.velora.pet/abc123-md.webp',
    )
  })

  it('preserves extension when velora.pet upload path already has one', () => {
    expect(imgSrc('https://velora.pet/uploads/abc123.webp', 'thumb')).toBe(
      'https://images.velora.pet/abc123.webp',
    )
  })

  it('does NOT rewrite third-party URL containing /uploads/', () => {
    const url = 'https://example.com/uploads/abc123'
    expect(imgSrc(url, 'thumb')).toBe('https://example.com/uploads/abc123-thumb.webp')
  })

  // -----------------------------------------------------------------------
  // All variant values are valid
  // -----------------------------------------------------------------------

  it.each<ImageVariant>(['original', 'lg', 'md', 'thumb'])(
    'produces correct suffix for variant "%s"',
    (variant) => {
      const result = imgSrc('/uploads/hash', variant)
      expect(result).toBe(`/uploads/hash-${variant}.webp`)
    },
  )
})
