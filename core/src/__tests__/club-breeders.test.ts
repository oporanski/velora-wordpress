import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ClubBreedersWidget } from '../widgets/club-breeders'
import type { VeloraConfig } from '../config'
import type { RawClubBreeder } from '../api-client'

/**
 * Only global fetch is mocked — everything from the mocked payload to the
 * assertions is the real widget: breed normalization, filtering, sorting,
 * layout choice and link building. These are the paths the 2026-07-01 session
 * fixed (breeds arriving as relation objects, localeCompare on a null name)
 * and which nothing covered afterwards.
 */

const CONFIG: VeloraConfig = {
  apiBase: 'https://api.test',
  profileBase: 'https://test.pet',
  apiKey: null,
  locale: 'en',
  theme: 'light',
  contactProxyUrl: null,
  showCredit: false,
}

const fetchMock = vi.fn()

function mockBreeders(breeders: RawClubBreeder[]): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: breeders }),
  })
}

function buildBreeder(overrides: Partial<RawClubBreeder> = {}): RawClubBreeder {
  return {
    id: 'b-1',
    slug: 'royal-cattery',
    name: 'Royal Cattery',
    logo: null,
    species: 'CAT',
    breeds: ['Maine Coon'],
    city: 'Warsaw',
    region: 'Mazowieckie',
    country: 'Poland',
    verified: false,
    ...overrides,
  }
}

async function mountWidget(
  opts: { club?: string | null; layout?: string; limit?: string } = {},
): Promise<HTMLElement> {
  const { club = 'baltic-feline', layout, limit } = opts
  const root = document.createElement('div')
  if (club !== null) root.setAttribute('data-club', club)
  if (layout !== undefined) root.setAttribute('data-layout', layout)
  if (limit !== undefined) root.setAttribute('data-limit', limit)
  document.body.appendChild(root)
  await new ClubBreedersWidget(root, CONFIG).mount()
  return root
}

function cardTitles(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('.velora-card-title')).map((el) => el.textContent ?? '')
}

describe('ClubBreedersWidget', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockBreeders([])
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an error and skips the request when data-club is missing', async () => {
    const root = await mountWidget({ club: null })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(root.querySelector('.velora-state-error')?.textContent).toContain('data-club')
  })

  it('requests the club endpoint with the configured limit', async () => {
    mockBreeders([buildBreeder()])
    await mountWidget({ limit: '25' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('/v1/clubs/baltic-feline/breeders')
    expect(url).toContain('limit=25')
  })

  it('renders the empty state when the club has no breeders', async () => {
    mockBreeders([])
    const root = await mountWidget()
    expect(root.querySelector('.velora-state-empty')).not.toBeNull()
  })

  // The backend serves breeds as AnimalBreed relation objects. Before
  // normalization these rendered as "[object Object]" on every card.
  it('renders breeds that arrive as relation objects as plain names', async () => {
    mockBreeders([
      buildBreeder({ breeds: [{ name: 'Maine Coon' }, { name: 'Ragdoll' }] }),
    ])
    const root = await mountWidget()
    expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon, Ragdoll')
    expect(root.textContent).not.toContain('[object Object]')
  })

  it('offers normalized breed names in the breed filter and filters by them', async () => {
    mockBreeders([
      buildBreeder({ id: 'a', slug: 'a', name: 'Alpha', breeds: [{ name: 'Ragdoll' }] }),
      buildBreeder({ id: 'b', slug: 'b', name: 'Beta', breeds: [{ name: 'Maine Coon' }] }),
    ])
    const root = await mountWidget()
    const select = root.querySelector<HTMLSelectElement>('.velora-toolbar-select')
    expect(Array.from(select!.options).map((o) => o.value)).toEqual(['', 'Maine Coon', 'Ragdoll'])

    select!.value = 'Ragdoll'
    select!.dispatchEvent(new Event('change'))
    expect(cardTitles(root)).toEqual(['Alpha'])
  })

  // A breeder row with a null city used to throw inside the comparator
  // (Cannot read properties of null), taking the whole widget down.
  it('sorts by city without throwing when a breeder has no city', async () => {
    mockBreeders([
      buildBreeder({ id: 'a', slug: 'a', name: 'Alpha', city: null }),
      buildBreeder({ id: 'b', slug: 'b', name: 'Beta', city: 'Gdansk' }),
    ])
    const root = await mountWidget()
    const sortSelect = Array.from(root.querySelectorAll<HTMLSelectElement>('.velora-toolbar-select'))
      .find((s) => Array.from(s.options).some((o) => o.value === 'city:asc'))
    sortSelect!.value = 'city:asc'
    sortSelect!.dispatchEvent(new Event('change'))
    expect(cardTitles(root)).toEqual(['Alpha', 'Beta'])
  })

  it('leaves a breeder without a region out of the region filter options', async () => {
    mockBreeders([
      buildBreeder({ id: 'a', slug: 'a', name: 'Alpha', region: null }),
      buildBreeder({ id: 'b', slug: 'b', name: 'Beta', region: 'Pomorskie' }),
      buildBreeder({ id: 'c', slug: 'c', name: 'Gamma', region: 'Mazowieckie' }),
    ])
    const root = await mountWidget()
    const regionSelect = Array.from(root.querySelectorAll<HTMLSelectElement>('.velora-toolbar-select'))
      .find((s) => Array.from(s.options).some((o) => o.value === 'Pomorskie'))
    expect(Array.from(regionSelect!.options).map((o) => o.value))
      .toEqual(['', 'Mazowieckie', 'Pomorskie'])
  })

  // Profile links must leave the embedding site — a relative href would
  // resolve to the WordPress host (balticfeline.pl/breeders/...).
  it('builds absolute profile links from profileBase', async () => {
    mockBreeders([buildBreeder({ slug: 'kot y' })])
    const root = await mountWidget()
    const link = root.querySelector<HTMLAnchorElement>('a.velora-card')
    expect(link!.getAttribute('href')).toBe('https://test.pet/breeders/kot%20y')
    expect(link!.rel).toBe('noopener noreferrer')
  })

  it('uses the table layout when asked, with the same absolute links', async () => {
    mockBreeders([buildBreeder({ breeds: [{ name: 'Ragdoll' }] })])
    const root = await mountWidget({ layout: 'table' })
    expect(root.querySelector('table.velora-table')).not.toBeNull()
    const link = root.querySelector<HTMLAnchorElement>('a.velora-table-link')
    expect(link!.getAttribute('href')).toBe('https://test.pet/breeders/royal-cattery')
    expect(root.querySelector('tbody td:nth-child(2)')?.textContent).toBe('Ragdoll')
  })

  it('renders a dash for the table cells a breeder left empty', async () => {
    mockBreeders([
      buildBreeder({ breeds: [], city: null, region: null, country: null }),
    ])
    const root = await mountWidget({ layout: 'table' })
    const cells = Array.from(root.querySelectorAll('tbody td')).map((td) => td.textContent)
    expect(cells.slice(1)).toEqual(['—', '—', '—'])
  })

  // auto = table above 20 entries, cards below.
  it('auto layout switches to a table once the club passes 20 breeders', async () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      buildBreeder({ id: `b-${i}`, slug: `s-${i}`, name: `Breeder ${i}` }))
    mockBreeders(many)
    const root = await mountWidget({ layout: 'auto' })
    expect(root.querySelector('table.velora-table')).not.toBeNull()

    mockBreeders(many.slice(0, 20))
    const small = await mountWidget({ layout: 'auto' })
    expect(small.querySelector('table.velora-table')).toBeNull()
    expect(small.querySelectorAll('.velora-card-breeder').length).toBe(20)
  })

  it('shows an error with a retry that re-runs the request', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const root = await mountWidget()
    expect(root.querySelector('.velora-state-detail')?.textContent).toBe('Network error: boom')

    mockBreeders([buildBreeder()])
    root.querySelector<HTMLButtonElement>('.velora-btn-retry')!.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cardTitles(root)).toEqual(['Royal Cattery'])
  })

  it('renders logo, verified mark and location tags on a card', async () => {
    mockBreeders([buildBreeder({ logo: 'logo.jpg', verified: true })])
    const root = await mountWidget()
    expect(root.querySelector('img.velora-card-avatar')).not.toBeNull()
    const tags = Array.from(root.querySelectorAll('.velora-tag')).map((el) => el.textContent)
    expect(tags).toEqual(['Warsaw, Mazowieckie', 'Poland', expect.stringContaining('\u2713')])
  })

  it('falls back to an initial when a breeder has no logo', async () => {
    mockBreeders([buildBreeder({ logo: null })])
    const root = await mountWidget()
    expect(root.querySelector('.velora-card-avatar-placeholder')?.textContent).toBe('R')
  })

  it('renders logo thumbnail and verified mark inside the table link', async () => {
    mockBreeders([buildBreeder({ logo: 'logo.jpg', verified: true })])
    const root = await mountWidget({ layout: 'table' })
    const link = root.querySelector('a.velora-table-link')!
    expect(link.querySelector('img.velora-table-thumb')).not.toBeNull()
    expect(link.querySelector('.velora-table-verified')?.textContent).toBe('\u2713')
    expect(link.textContent).toContain('Royal Cattery')
  })

  it('clicking a sortable header sorts, and clicking it again reverses', async () => {
    mockBreeders([
      buildBreeder({ id: 'a', slug: 'a', name: 'Beta' }),
      buildBreeder({ id: 'b', slug: 'b', name: 'Alpha' }),
    ])
    const root = await mountWidget({ layout: 'table' })
    const names = (): string[] =>
      Array.from(root.querySelectorAll('a.velora-table-link')).map((el) => el.textContent ?? '')
    expect(names()).toEqual(['Alpha', 'Beta'])

    const nameTh = root.querySelectorAll('thead th')[0] as HTMLElement
    expect(nameTh.getAttribute('aria-sort')).toBe('ascending')
    nameTh.click()
    expect(names()).toEqual(['Beta', 'Alpha'])
    expect((root.querySelectorAll('thead th')[0] as HTMLElement).getAttribute('aria-sort'))
      .toBe('descending')
  })

  it('clicking another sortable header switches the key back to ascending', async () => {
    mockBreeders([
      buildBreeder({ id: 'a', slug: 'a', name: 'Alpha', city: 'Zakopane' }),
      buildBreeder({ id: 'b', slug: 'b', name: 'Beta', city: 'Aleksandrow' }),
    ])
    const root = await mountWidget({ layout: 'table' })
    const cityTh = root.querySelectorAll('thead th')[2] as HTMLElement
    cityTh.click()
    const names = Array.from(root.querySelectorAll('a.velora-table-link')).map((el) => el.textContent)
    expect(names).toEqual(['Beta', 'Alpha'])
  })

  it('switches between cards and table from the layout buttons', async () => {
    mockBreeders([buildBreeder()])
    const root = await mountWidget()
    const tableBtn = root.querySelectorAll('.velora-toolbar-layout button')[1] as HTMLButtonElement
    tableBtn.click()
    expect(root.querySelector('table.velora-table')).not.toBeNull()
    const cardsBtn = root.querySelectorAll('.velora-toolbar-layout button')[0] as HTMLButtonElement
    cardsBtn.click()
    expect(root.querySelector('.velora-grid-breeders')).not.toBeNull()
  })

  it('shows the empty state when a filter matches nothing', async () => {
    mockBreeders([
      buildBreeder({ id: 'a', slug: 'a', name: 'Alpha', breeds: ['Ragdoll'], region: 'Pomorskie' }),
      buildBreeder({ id: 'b', slug: 'b', name: 'Beta', breeds: ['Maine Coon'], region: 'Slaskie' }),
    ])
    const root = await mountWidget()
    const selects = Array.from(root.querySelectorAll<HTMLSelectElement>('.velora-toolbar-select'))
    selects[0].value = 'Ragdoll'
    selects[0].dispatchEvent(new Event('change'))
    const regionSelect = Array.from(root.querySelectorAll<HTMLSelectElement>('.velora-toolbar-select'))
      .find((s) => Array.from(s.options).some((o) => o.value === 'Slaskie'))!
    regionSelect.value = 'Slaskie'
    regionSelect.dispatchEvent(new Event('change'))
    expect(root.querySelector('.velora-state-empty')).not.toBeNull()
  })
})

describe('ClubBreedersWidget paging', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function manyBreeders(n: number): RawClubBreeder[] {
    return Array.from({ length: n }, (_, i) =>
      buildBreeder({ id: `b-${i}`, slug: `c-${i}`, name: `Cattery ${String(i).padStart(3, '0')}` }),
    )
  }

  async function mountPaged(perPage?: string): Promise<HTMLElement> {
    mockBreeders(manyBreeders(80))
    const root = document.createElement('div')
    root.setAttribute('data-club', 'baltic-feline')
    if (perPage !== undefined) root.setAttribute('data-per-page', perPage)
    document.body.appendChild(root)
    await new ClubBreedersWidget(root, CONFIG).mount()
    return root
  }

  const rowCount = (root: HTMLElement): number => root.querySelectorAll('.velora-table tbody tr').length
  const count = (root: HTMLElement): string => root.querySelector('.velora-toolbar-count')?.textContent ?? ''
  const click = (root: HTMLElement, selector: string): void =>
    (root.querySelector(selector) as HTMLElement).click()

  it('shows 50 rows and a two-page pager for 80 breeders', async () => {
    const root = await mountPaged('50')
    expect(rowCount(root)).toBe(50)
    expect(root.querySelectorAll('.velora-pager-page')).toHaveLength(2)
    expect(count(root)).toBe('Showing 1–50 of 80')
  })

  it('defaults to 50 per page without the attribute', async () => {
    const root = await mountPaged()
    expect(rowCount(root)).toBe(50)
  })

  it('falls back to 50 when data-per-page is not a number', async () => {
    const root = await mountPaged('lots')
    expect(rowCount(root)).toBe(50)
  })

  it('moves to the remaining 30 on next', async () => {
    const root = await mountPaged('50')
    click(root, '.velora-pager-next')
    expect(rowCount(root)).toBe(30)
    expect(count(root)).toBe('Showing 51–80 of 80')
    expect(root.querySelector('.velora-table tbody tr a')?.textContent).toContain('Cattery 050')
  })

  it('scrolls the widget into view after a page change when the browser can', async () => {
    const root = await mountPaged('50')
    const scroll = vi.fn()
    root.scrollIntoView = scroll
    click(root, '.velora-pager-next')
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('shows everything and no pager for data-per-page="all"', async () => {
    for (const value of ['all', 'ALL', '0']) {
      const root = await mountPaged(value)
      expect(rowCount(root)).toBe(80)
      expect(root.querySelector('.velora-pager')).toBeNull()
      expect(count(root)).toBe('Showing: 80')
    }
  })

  it('returns to page 1 when the sort changes', async () => {
    const root = await mountPaged('50')
    click(root, '.velora-pager-next')
    const select = root.querySelector('.velora-toolbar-select') as HTMLSelectElement
    select.value = 'name:desc'
    select.dispatchEvent(new Event('change'))
    expect(count(root)).toBe('Showing 1–50 of 80')
    expect(root.querySelector('.velora-table tbody tr a')?.textContent).toContain('Cattery 079')
  })

  it('returns to page 1 when the layout changes', async () => {
    const root = await mountPaged('50')
    click(root, '.velora-pager-next')
    click(root, '.velora-toolbar-layout button')
    expect(count(root)).toBe('Showing 1–50 of 80')
  })

  it('returns to page 1 when a column header re-sorts the table', async () => {
    const root = await mountPaged('50')
    click(root, '.velora-pager-next')
    click(root, '.velora-table th')
    expect(count(root)).toBe('Showing 1–50 of 80')
  })

  it('returns to page 1 when a filter changes', async () => {
    mockBreeders([
      ...manyBreeders(60).map((b) => ({ ...b, region: 'A' })),
      ...manyBreeders(20).map((b, i) => ({ ...b, id: `r-${i}`, slug: `r-${i}`, region: 'B' })),
    ])
    const root = document.createElement('div')
    root.setAttribute('data-club', 'baltic-feline')
    document.body.appendChild(root)
    await new ClubBreedersWidget(root, CONFIG).mount()
    click(root, '.velora-pager-next')
    const regionSelect = Array.from(root.querySelectorAll('.velora-toolbar-select'))
      .find((s) => Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'B')) as HTMLSelectElement
    regionSelect.value = 'B'
    regionSelect.dispatchEvent(new Event('change'))
    expect(rowCount(root)).toBe(20)
    expect(root.querySelector('.velora-pager')).toBeNull()
  })
})
