import { describe, it, expect, vi } from 'vitest'
import { buildPager, clampPage, pageCount, pageSlice, pageWindow } from '../widgets/pager'
import type { PagerLabels } from '../widgets/pager'

const LABELS: PagerLabels = {
  nav: 'Pagination',
  prev: 'Previous',
  next: 'Next',
  page: (n) => `Page ${n}`,
}

describe('pageCount', () => {
  it('rounds up partial pages', () => {
    expect(pageCount(80, 50)).toBe(2)
    expect(pageCount(100, 50)).toBe(2)
    expect(pageCount(101, 50)).toBe(3)
  })
  it('is 1 for no paging or no items', () => {
    expect(pageCount(80, 0)).toBe(1)
    expect(pageCount(0, 50)).toBe(1)
  })
})

describe('clampPage', () => {
  it('keeps the page within 1..pages', () => {
    expect(clampPage(0, 3)).toBe(1)
    expect(clampPage(2, 3)).toBe(2)
    expect(clampPage(9, 3)).toBe(3)
  })
})

describe('pageSlice', () => {
  const items = Array.from({ length: 7 }, (_, i) => i + 1)
  it('returns the requested window', () => {
    expect(pageSlice(items, 1, 3)).toEqual([1, 2, 3])
    expect(pageSlice(items, 3, 3)).toEqual([7])
  })
  it('returns everything when perPage is 0', () => {
    expect(pageSlice(items, 1, 0)).toEqual(items)
  })
})

describe('pageWindow', () => {
  it('lists every page without gaps when they fit', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('always has first and last, no duplicates and no adjacent gaps', () => {
    for (const pages of [8, 9, 12, 20, 57]) {
      for (let current = 1; current <= pages; current++) {
        const w = pageWindow(current, pages)
        expect(w[0]).toBe(1)
        expect(w[w.length - 1]).toBe(pages)
        expect(w).toContain(current)
        const nums = w.filter((x): x is number => x !== 'gap')
        expect(new Set(nums).size).toBe(nums.length)
        expect([...nums].sort((a, b) => a - b)).toEqual(nums)
        for (let i = 1; i < w.length; i++) expect(w[i] === 'gap' && w[i - 1] === 'gap').toBe(false)
      }
    }
  })

  it('puts gaps where pages are skipped', () => {
    expect(pageWindow(1, 20)).toContain('gap')
    expect(pageWindow(10, 20).filter((x) => x === 'gap')).toHaveLength(2)
  })
})

describe('buildPager', () => {
  it('renders nothing for a single page', () => {
    const nav = buildPager({ current: 1, pages: 1, labels: LABELS, onGo: vi.fn() })
    expect(nav.className).toContain('velora-pager-empty')
    expect(nav.children).toHaveLength(0)
  })

  it('disables previous on the first page and marks the current page', () => {
    const nav = buildPager({ current: 1, pages: 3, labels: LABELS, onGo: vi.fn() })
    expect(nav.getAttribute('aria-label')).toBe('Pagination')
    expect((nav.querySelector('.velora-pager-prev') as HTMLButtonElement).disabled).toBe(true)
    expect((nav.querySelector('.velora-pager-next') as HTMLButtonElement).disabled).toBe(false)
    const current = nav.querySelector('[aria-current="page"]') as HTMLButtonElement
    expect(current.textContent).toBe('1')
    expect(current.getAttribute('aria-label')).toBe('Page 1')
    expect(current.disabled).toBe(true)
  })

  it('disables next on the last page', () => {
    const nav = buildPager({ current: 3, pages: 3, labels: LABELS, onGo: vi.fn() })
    expect((nav.querySelector('.velora-pager-next') as HTMLButtonElement).disabled).toBe(true)
    expect((nav.querySelector('.velora-pager-prev') as HTMLButtonElement).disabled).toBe(false)
  })

  it('reports the target page on click', () => {
    const onGo = vi.fn()
    const nav = buildPager({ current: 2, pages: 4, labels: LABELS, onGo })
    ;(nav.querySelector('.velora-pager-prev') as HTMLButtonElement).click()
    ;(nav.querySelector('.velora-pager-next') as HTMLButtonElement).click()
    ;(nav.querySelector('[aria-label="Page 4"]') as HTMLButtonElement).click()
    expect(onGo.mock.calls.map((c) => c[0])).toEqual([1, 3, 4])
  })

  it('renders gaps as hidden ellipses', () => {
    const nav = buildPager({ current: 1, pages: 20, labels: LABELS, onGo: vi.fn() })
    const gap = nav.querySelector('.velora-pager-gap') as HTMLElement
    expect(gap.getAttribute('aria-hidden')).toBe('true')
  })
})
