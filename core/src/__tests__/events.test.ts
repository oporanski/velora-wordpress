import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventsWidget } from '../widgets/events'
import type { VeloraConfig } from '../config'
import type { VeloraEvent } from '../api-client'

/**
 * Only global fetch is mocked; the picking rule, the widget and the DOM it
 * builds are real. The widget is shared with the breeder plugin, so the poster
 * must appear for clubs only and only on the "upcoming" view.
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

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A date-only value `days` from today, in the viewer's calendar. */
function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildEvent(overrides: Partial<VeloraEvent> & { id: string }): VeloraEvent {
  return {
    title: `Show ${overrides.id}`,
    slug: overrides.id,
    startDate: inDays(10),
    endDate: null,
    city: null,
    country: null,
    imageUrl: '/uploads/abc',
    ...overrides,
  }
}

function mockEvents(events: VeloraEvent[]): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: events }),
  })
}

async function mountWidget(attrs: Record<string, string> = {}): Promise<HTMLElement> {
  const root = document.createElement('div')
  const all = { 'data-source': 'clubs', 'data-slug': 'baltic-feline', ...attrs }
  for (const [name, value] of Object.entries(all)) root.setAttribute(name, value)
  document.body.appendChild(root)
  await new EventsWidget(root, CONFIG).mount()
  return root
}

const poster = (root: HTMLElement): HTMLAnchorElement | null => root.querySelector('a.velora-event-poster')

describe('EventsWidget poster', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the nearest upcoming event as a linked, uncropped-image poster', async () => {
    mockEvents([
      buildEvent({ id: 'later', startDate: inDays(30) }),
      buildEvent({ id: 'nearest', startDate: inDays(5), title: 'Winter Cup' }),
    ])
    const root = await mountWidget()

    const link = poster(root)
    expect(link?.href).toBe('https://test.pet/events/nearest')
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toBe('noopener noreferrer')
    const img = link?.querySelector('img')
    expect(img?.src).toBe('https://test.pet/uploads/abc-lg.webp')
    expect(img?.alt).toBe('Winter Cup')
    expect(img?.loading).toBe('lazy')
  })

  it('keeps the featured event in the card grid below the poster', async () => {
    mockEvents([buildEvent({ id: 'nearest' }), buildEvent({ id: 'other', startDate: inDays(20) })])
    const root = await mountWidget()

    expect(poster(root)).not.toBeNull()
    expect(root.querySelectorAll('a.velora-card-event')).toHaveLength(2)
  })

  it('puts the poster above the grid', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget()

    const grid = root.querySelector('.velora-grid-events')
    expect(poster(root)!.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('features a running event', async () => {
    mockEvents([buildEvent({ id: 'running', startDate: inDays(-2), endDate: inDays(2) })])
    const root = await mountWidget()

    expect(poster(root)?.href).toContain('/events/running')
  })

  it('skips an event without an image in favour of a later one with it', async () => {
    mockEvents([
      buildEvent({ id: 'no-image', startDate: inDays(3), imageUrl: null }),
      buildEvent({ id: 'with-image', startDate: inDays(9) }),
    ])
    const root = await mountWidget()

    expect(poster(root)?.href).toContain('/events/with-image')
  })

  it('renders no poster when show_poster is "false"', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget({ 'data-show-poster': 'false' })

    expect(poster(root)).toBeNull()
    expect(root.querySelectorAll('a.velora-card-event')).toHaveLength(1)
  })

  it('treats any value other than "false" as enabled', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget({ 'data-show-poster': 'yes' })

    expect(poster(root)).not.toBeNull()
  })

  it('renders no poster for the breeder plugin (source="breeders")', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget({ 'data-source': 'breeders' })

    expect(poster(root)).toBeNull()
    expect(root.querySelectorAll('a.velora-card-event')).toHaveLength(1)
  })

  it('renders no poster on the past view', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget({ 'data-when': 'past' })

    expect(poster(root)).toBeNull()
  })

  it('renders no poster on the "all" view', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget({ 'data-when': 'all' })

    expect(poster(root)).toBeNull()
  })

  it('renders no poster when the featured event has no slug', async () => {
    mockEvents([buildEvent({ id: 'nearest', slug: null })])
    const root = await mountWidget()

    expect(poster(root)).toBeNull()
  })

  it('renders no poster when nothing qualifies', async () => {
    mockEvents([buildEvent({ id: 'over', startDate: inDays(-9), endDate: inDays(-8) })])
    const root = await mountWidget()

    expect(poster(root)).toBeNull()
  })

  it('makes exactly one API request', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    await mountWidget()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('EventsWidget (list, filter and cards)', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an error and skips the request when the source is invalid', async () => {
    const root = await mountWidget({ 'data-source': 'nope' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(root.querySelector('.velora-state-error')?.textContent).toContain('data-source')
  })

  it('renders an error and skips the request when data-slug is missing', async () => {
    const root = await mountWidget({ 'data-slug': '' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(root.querySelector('.velora-state-error')).not.toBeNull()
  })

  it('shows the error with a retry button that loads again', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const root = await mountWidget()
    expect(root.querySelector('.velora-state-error')?.textContent).toContain('network down')

    mockEvents([buildEvent({ id: 'nearest' })])
    root.querySelector<HTMLButtonElement>('.velora-btn-retry')!.click()
    await vi.waitFor(() => expect(root.querySelector('a.velora-card-event')).not.toBeNull())
  })

  it('shows the empty message for the upcoming and the past view', async () => {
    mockEvents([])
    const upcoming = await mountWidget()
    expect(upcoming.querySelector('.velora-state-empty')?.textContent).toBe('No upcoming events')

    const past = await mountWidget({ 'data-when': 'past' })
    expect(past.querySelector('.velora-state-empty')?.textContent).toBe('No past events')
  })

  it('falls back to the upcoming view for an unknown data-when', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    await mountWidget({ 'data-when': 'bogus' })

    expect(fetchMock.mock.calls[0][0]).toContain('when=upcoming')
  })

  it('switches view through the filter and reloads, ignoring a click on the active one', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget()
    const [upcoming, past] = Array.from(root.querySelectorAll<HTMLButtonElement>('.velora-toolbar button'))

    upcoming.click()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    past.click()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).toContain('when=past')
    await vi.waitFor(() => expect(root.querySelector('a.velora-event-poster')).toBeNull())
  })

  it('hides the filter toolbar when data-show-filter is "false"', async () => {
    mockEvents([buildEvent({ id: 'nearest' })])
    const root = await mountWidget({ 'data-show-filter': 'false' })

    expect(root.querySelector('.velora-toolbar')).toBeNull()
  })

  it('renders the date range, the location and the JSON-LD for a card', async () => {
    mockEvents([
      buildEvent({ id: 'multi', startDate: '2026-10-20', endDate: '2026-10-21', city: 'Gdańsk', country: 'PL' }),
    ])
    const root = await mountWidget()

    const card = root.querySelector('a.velora-card-event')!
    expect(card.querySelector('.velora-card-event-date')?.textContent).toContain(' – ')
    expect(card.querySelector('.velora-card-event-location')?.textContent).toContain('Gdańsk, PL')
    expect(root.querySelector('script[type="application/ld+json"]')).not.toBeNull()
  })

  it('renders a single date, a placeholder and a non-linked card for a bare event', async () => {
    mockEvents([buildEvent({ id: 'bare', slug: null, imageUrl: null, startDate: '2026-10-20', endDate: '2026-10-20' })])
    const root = await mountWidget()

    const card = root.querySelector<HTMLAnchorElement>('a.velora-card-event')!
    expect(card.getAttribute('href')).toBeNull()
    expect(card.querySelector('.velora-card-img-placeholder')).not.toBeNull()
    expect(card.querySelector('.velora-card-event-date')?.textContent).not.toContain(' – ')
    expect(card.querySelector('.velora-card-event-location')).toBeNull()
  })

  it('omits the date line when the start date is not a date', async () => {
    mockEvents([buildEvent({ id: 'odd', startDate: 'not-a-date' })])
    const root = await mountWidget()

    expect(root.querySelector('.velora-card-event-date')).toBeNull()
  })

  it('shows the start date alone when the end date is not a date', async () => {
    mockEvents([buildEvent({ id: 'odd-end', startDate: '2026-10-20', endDate: 'garbage' })])
    const root = await mountWidget()

    expect(root.querySelector('.velora-card-event-date')?.textContent).not.toContain(' – ')
  })
})
