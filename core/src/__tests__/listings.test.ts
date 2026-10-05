import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ListingsWidget } from '../widgets/listings'
import type { VeloraConfig } from '../config'
import type { VeloraListing } from '../api-client'

/**
 * The network boundary (global fetch) is the only thing mocked — everything
 * between the mocked response and the assertions is the real widget code:
 * attribute parsing, URL construction, card rendering, and error/empty
 * handling. "Rendered card X" here means exactly what it means in a browser.
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

function jsonResponse(body: unknown, ok = true, status = 200): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return { ok, status, json: () => Promise.resolve(body) }
}

function mockListings(listings: VeloraListing[]): void {
  fetchMock.mockResolvedValue(jsonResponse({ data: listings }))
}

function buildListing(overrides: Partial<VeloraListing> = {}): VeloraListing {
  return {
    id: 'listing-1',
    slug: 'listing-1-slug',
    title: 'Playful Kitten',
    price: 500,
    currency: 'PLN',
    species: 'CAT',
    breed: 'Maine Coon',
    breedRef: null,
    city: 'Warsaw',
    country: 'Poland',
    images: ['https://cdn.example.com/kitten.jpg'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** Lets every pending microtask/macrotask of an un-awaited mount() settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

async function mountWidget(
  opts: { source?: string | null; slug?: string | null; limit?: string } = {},
): Promise<HTMLElement> {
  const { source = 'breeders', slug = 'royal-cattery', limit } = opts
  const root = document.createElement('div')
  if (source !== null) root.setAttribute('data-source', source)
  if (slug !== null) root.setAttribute('data-slug', slug)
  if (limit !== undefined) root.setAttribute('data-limit', limit)
  document.body.appendChild(root)
  await new ListingsWidget(root, CONFIG).mount()
  return root
}

function requestedUrl(): string {
  const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
  return url
}

describe('ListingsWidget', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockListings([])
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ---------------------------------------------------------------------
  // Attribute validation — no network call should happen for bad markup
  // ---------------------------------------------------------------------

  describe('attribute validation', () => {
    it('renders an error and never calls the API when data-slug is missing', async () => {
      const root = await mountWidget({ slug: null })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(root.querySelector('[role="alert"]')).toBeTruthy()
      expect(root.querySelector('.velora-state-detail')?.textContent).toBe(
        'Required: data-source="breeders|clubs" + data-slug="..."',
      )
    })

    it('renders an error and never calls the API when data-source is neither "breeders" nor "clubs"', async () => {
      const root = await mountWidget({ source: 'invalid' })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(root.querySelector('[role="alert"]')).toBeTruthy()
      expect(root.querySelector('.velora-state-detail')?.textContent).toBe(
        'Required: data-source="breeders|clubs" + data-slug="..."',
      )
    })
  })

  // ---------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------

  it('shows a busy loading state while the request is in flight', async () => {
    let resolveFetch!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))
    const root = document.createElement('div')
    root.setAttribute('data-source', 'breeders')
    root.setAttribute('data-slug', 'royal-cattery')
    document.body.appendChild(root)

    const mountPromise = new ListingsWidget(root, CONFIG).mount()

    expect(root.querySelector('[aria-busy="true"]')).toBeTruthy()

    resolveFetch(jsonResponse({ data: [] }))
    await mountPromise

    expect(root.querySelector('[aria-busy="true"]')).toBeFalsy()
  })

  // ---------------------------------------------------------------------
  // Request construction
  // ---------------------------------------------------------------------

  describe('request construction', () => {
    it('requests the breeders listings endpoint with the default limit of 12', async () => {
      await mountWidget()

      expect(requestedUrl()).toBe('https://api.test/v1/breeders/royal-cattery/listings?limit=12')
    })

    it('requests the clubs listings endpoint when data-source="clubs"', async () => {
      await mountWidget({ source: 'clubs' })

      expect(requestedUrl()).toBe('https://api.test/v1/clubs/royal-cattery/listings?limit=12')
    })

    it('uses a custom limit when data-limit is a valid number', async () => {
      await mountWidget({ limit: '5' })

      expect(requestedUrl()).toBe('https://api.test/v1/breeders/royal-cattery/listings?limit=5')
    })

    it('falls back to the default limit of 12 when data-limit is not a valid number', async () => {
      await mountWidget({ limit: 'not-a-number' })

      expect(requestedUrl()).toBe('https://api.test/v1/breeders/royal-cattery/listings?limit=12')
    })
  })

  // ---------------------------------------------------------------------
  // Rendering listings
  // ---------------------------------------------------------------------

  describe('rendering listings', () => {
    it('renders one card per listing returned by the API', async () => {
      mockListings([
        buildListing({ id: 'l-1' }),
        buildListing({ id: 'l-2' }),
        buildListing({ id: 'l-3' }),
      ])

      const root = await mountWidget()

      expect(root.querySelectorAll('.velora-card-listing').length).toBe(3)
    })

    it('renders the title, breed, city tag and a profile link built from the listing id', async () => {
      mockListings([buildListing({ id: 'kitten-42', title: 'Playful Kitten', breed: 'Maine Coon', city: 'Warsaw' })])

      const root = await mountWidget()
      const card = root.querySelector<HTMLAnchorElement>('.velora-card-listing')

      expect(card?.querySelector('.velora-card-title')?.textContent).toBe('Playful Kitten')
      expect(card?.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon')
      expect(card?.querySelector('.velora-tag')?.textContent).toBe('Warsaw')
      expect(card?.getAttribute('href')).toBe('https://test.pet/marketplace/listings/kitten-42')
      expect(card?.target).toBe('_blank')
      expect(card?.rel).toContain('noopener')
      expect(card?.rel).toContain('noreferrer')
      expect(card?.title).toBe('View profile')
    })

    it('reads the breed from breedRef.name when the flat breed field is absent', async () => {
      mockListings([buildListing({ breed: null, breedRef: { name: 'Siberian' } })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Siberian')
    })

    it('renders the price formatted with the currency when price is a positive number', async () => {
      mockListings([buildListing({ price: 250, currency: 'PLN' })])

      const root = await mountWidget()
      const priceEl = root.querySelector('.velora-card-listing-price')

      expect(priceEl?.textContent).toBe('250 PLN')
      expect(priceEl?.classList.contains('velora-card-listing-price-ask')).toBe(false)
    })

    it('renders "price on request" when price is null', async () => {
      mockListings([buildListing({ price: null })])

      const root = await mountWidget()
      const priceEl = root.querySelector('.velora-card-listing-price')

      expect(priceEl?.textContent).toBe('Price on request')
      expect(priceEl?.classList.contains('velora-card-listing-price-ask')).toBe(true)
    })

    it('renders "price on request" when price is exactly 0', async () => {
      mockListings([buildListing({ price: 0 })])

      const root = await mountWidget()
      const priceEl = root.querySelector('.velora-card-listing-price')

      expect(priceEl?.textContent).toBe('Price on request')
      expect(priceEl?.classList.contains('velora-card-listing-price-ask')).toBe(true)
    })

    it('does not render a city tag when city is null', async () => {
      mockListings([buildListing({ city: null })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-tag')).toBeNull()
    })

    it('renders an <img> with the listing photo when images are present', async () => {
      mockListings([buildListing({ title: 'Photo Kitten', images: ['https://cdn.example.com/kitten.jpg'] })])

      const root = await mountWidget()
      const img = root.querySelector<HTMLImageElement>('.velora-card-img')

      expect(img?.tagName).toBe('IMG')
      expect(img?.src).toBe('https://cdn.example.com/kitten.jpg')
      expect(img?.alt).toBe('Photo Kitten')
      expect(img?.loading).toBe('lazy')
    })

    it('renders a cat emoji placeholder instead of a photo when a CAT listing has no images', async () => {
      mockListings([buildListing({ species: 'CAT', images: [] })])

      const root = await mountWidget()
      const placeholder = root.querySelector('.velora-card-img-placeholder')

      expect(placeholder).toBeTruthy()
      expect(placeholder?.textContent).toBe('🐱')
      expect(root.querySelector('img.velora-card-img')).toBeNull()
    })

    it('renders a dog emoji placeholder instead of a photo when a DOG listing has no images', async () => {
      mockListings([buildListing({ species: 'DOG', images: [] })])

      const root = await mountWidget()
      const placeholder = root.querySelector('.velora-card-img-placeholder')

      expect(placeholder).toBeTruthy()
      expect(placeholder?.textContent).toBe('🐶')
    })

    it('injects Product JSON-LD structured data describing the rendered listing', async () => {
      mockListings([buildListing({ title: 'Playful Kitten', price: 500, currency: 'PLN' })])

      const root = await mountWidget()
      const script = root.querySelector('script[type="application/ld+json"]')

      expect(script).toBeTruthy()
      const payload = JSON.parse(script!.textContent ?? '{}') as {
        itemListElement: Array<{ item: { name: string; offers?: { price: number } } }>
      }
      expect(payload.itemListElement[0].item.name).toBe('Playful Kitten')
      expect(payload.itemListElement[0].item.offers?.price).toBe(500)
    })
  })

  // ---------------------------------------------------------------------
  // Empty results
  // ---------------------------------------------------------------------

  it('renders the empty state (not a grid) when the API returns zero listings', async () => {
    mockListings([])

    const root = await mountWidget()

    expect(root.querySelector('.velora-state-empty')?.textContent).toBe('No active listings')
    expect(root.querySelector('.velora-grid-listings')).toBeNull()
  })

  // ---------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------

  describe('error handling', () => {
    it('renders an error state with the API-provided message when the request fails', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'Marketplace temporarily unavailable' }, false, 503))

      const root = await mountWidget()

      expect(root.querySelector('[role="alert"]')).toBeTruthy()
      expect(root.querySelector('.velora-state-detail')?.textContent).toBe(
        'Marketplace temporarily unavailable',
      )
    })

    it('retries the request when the retry button is clicked, and renders the retried result', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, false, 500))
      // Subsequent call (the retry) falls through to the default beforeEach mock: empty listings.

      const root = await mountWidget()
      const retryBtn = root.querySelector<HTMLButtonElement>('.velora-btn-retry')
      expect(retryBtn).toBeTruthy()

      retryBtn!.click()
      await flush()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(root.querySelector('.velora-state-empty')).toBeTruthy()
      expect(root.querySelector('[role="alert"]')).toBeNull()
    })
  })
})
