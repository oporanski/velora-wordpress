import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BreederAnimalsWidget } from '../widgets/breeder-animals'
import type { VeloraConfig } from '../config'
import type { BreederAnimal } from '../api-client'

/**
 * The network boundary (global fetch) is the only thing mocked — everything
 * between the mocked response and the assertions is the real widget code:
 * attribute parsing, tolerant breed/color reading (commit 993af12a2 made
 * about.ts/listings.ts/seo.ts tolerant of both the flat-string and the
 * breedRef/colorRef relation-object shape via breedName()/colorName(), but
 * this widget — the one that actually renders the [object Object] bug the
 * fix targeted — shipped without a test file), card rendering, age
 * calculation and error/empty handling.
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

/** Routes by URL: /animals -> the animals list, anything else -> the profile fetch. */
function mockAnimals(animals: BreederAnimal[], profile: { name: string; slug: string } = { name: 'Velvet Paws', slug: 'velvet-paws' }): void {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/animals')) return Promise.resolve(jsonResponse({ data: animals }))
    return Promise.resolve(jsonResponse(profile))
  })
}

function buildAnimal(overrides: Partial<BreederAnimal> = {}): BreederAnimal {
  return {
    id: 'a-1',
    name: 'Luna',
    slug: 'luna',
    breed: 'Maine Coon',
    sex: 'FEMALE',
    birthDate: '2021-01-01',
    photoUrl: null,
    ...overrides,
  }
}

/** Lets every pending microtask/macrotask of an un-awaited fire-and-forget chain settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

async function mountWidget(
  opts: { breeder?: string | null; limit?: string } = {},
): Promise<HTMLElement> {
  const { breeder = 'velvet-paws', limit } = opts
  const root = document.createElement('div')
  if (breeder !== null) root.setAttribute('data-breeder', breeder)
  if (limit !== undefined) root.setAttribute('data-limit', limit)
  document.body.appendChild(root)
  await new BreederAnimalsWidget(root, CONFIG).mount()
  return root
}

function requestedUrl(callIndex = 0): string {
  const [url] = fetchMock.mock.calls[callIndex] as [string, RequestInit]
  return url
}

describe('BreederAnimalsWidget', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockAnimals([])
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------------
  // Attribute validation — no network call should happen for bad markup
  // ---------------------------------------------------------------------

  describe('attribute validation', () => {
    it('renders an error and never calls the API when data-breeder is missing', async () => {
      const root = await mountWidget({ breeder: null })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(root.querySelector('[role="alert"]')).toBeTruthy()
      expect(root.querySelector('.velora-state-detail')?.textContent).toBe('Missing data-breeder attribute')
    })
  })

  // ---------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------

  it('shows a busy loading state while the request is in flight', async () => {
    let resolveFetch!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))
    const root = document.createElement('div')
    root.setAttribute('data-breeder', 'velvet-paws')
    document.body.appendChild(root)

    const mountPromise = new BreederAnimalsWidget(root, CONFIG).mount()

    expect(root.querySelector('[aria-busy="true"]')).toBeTruthy()

    resolveFetch(jsonResponse({ data: [] }))
    await mountPromise

    expect(root.querySelector('[aria-busy="true"]')).toBeFalsy()
  })

  // ---------------------------------------------------------------------
  // Request construction
  // ---------------------------------------------------------------------

  describe('request construction', () => {
    it('requests the breeder animals endpoint with the default limit of 12', async () => {
      await mountWidget()

      expect(requestedUrl()).toBe('https://api.test/v1/breeders/velvet-paws/animals?limit=12')
    })

    it('uses a custom limit when data-limit is a valid number', async () => {
      await mountWidget({ limit: '5' })

      expect(requestedUrl()).toBe('https://api.test/v1/breeders/velvet-paws/animals?limit=5')
    })

    it('falls back to the default limit of 12 when data-limit is not a valid number', async () => {
      await mountWidget({ limit: 'not-a-number' })

      expect(requestedUrl()).toBe('https://api.test/v1/breeders/velvet-paws/animals?limit=12')
    })
  })

  // ---------------------------------------------------------------------
  // Tolerant breed/color rendering — the shapes commit 993af12a2 made this
  // widget accept. Every accepted shape gets its own pinned test, plus one
  // rejected shape (both fields absent).
  // ---------------------------------------------------------------------

  describe('tolerant breed rendering', () => {
    it('renders a flat breed string as-is', async () => {
      mockAnimals([buildAnimal({ breed: 'Maine Coon', breedRef: null })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon')
    })

    it('falls back to breedRef.name when the flat breed field is absent', async () => {
      mockAnimals([buildAnimal({ breed: null, breedRef: { name: 'Siberian' } })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Siberian')
    })

    it('prefers the flat breed string over breedRef when both are present', async () => {
      mockAnimals([buildAnimal({ breed: 'Sphynx', breedRef: { name: 'Ragdoll' } })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Sphynx')
    })

    it('renders no [object Object] and an empty breed segment when neither shape is present', async () => {
      mockAnimals([buildAnimal({ breed: null, breedRef: null })])

      const root = await mountWidget()

      expect(root.textContent).not.toContain('[object Object]')
      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('')
    })
  })

  describe('tolerant color rendering', () => {
    it('renders a flat color string appended after the breed', async () => {
      mockAnimals([buildAnimal({ breed: 'Maine Coon', color: 'Brown Tabby' })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon · Brown Tabby')
    })

    it('falls back to colorRef.nameEn when the flat color field is absent', async () => {
      mockAnimals([buildAnimal({ breed: 'Maine Coon', color: null, colorRef: { nameEn: 'Black', emsCode: 'n' } })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon · Black')
    })

    it('falls back to colorRef.emsCode when colorRef.nameEn is empty', async () => {
      mockAnimals([buildAnimal({ breed: 'Maine Coon', color: null, colorRef: { nameEn: '', emsCode: 'n 22' } })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon · n 22')
    })

    it('renders just the breed, with no separator, when no color is present in either shape', async () => {
      mockAnimals([buildAnimal({ breed: 'Maine Coon', color: null, colorRef: null })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-breed')?.textContent).toBe('Maine Coon')
    })
  })

  // ---------------------------------------------------------------------
  // Card rendering
  // ---------------------------------------------------------------------

  describe('card rendering', () => {
    it('renders one card per animal returned by the API', async () => {
      mockAnimals([
        buildAnimal({ id: 'a-1' }),
        buildAnimal({ id: 'a-2', name: 'Max' }),
        buildAnimal({ id: 'a-3', name: 'Bella' }),
      ])

      const root = await mountWidget()

      expect(root.querySelectorAll('.velora-card-animal').length).toBe(3)
    })

    it('renders the name, a profile link built from profileBase, and target/rel attributes', async () => {
      mockAnimals([buildAnimal({ slug: 'luna', name: 'Luna' })])

      const root = await mountWidget()
      const card = root.querySelector<HTMLAnchorElement>('.velora-card-animal')

      expect(card?.querySelector('.velora-card-title')?.textContent).toBe('Luna')
      expect(card?.getAttribute('href')).toBe('https://test.pet/breeders/velvet-paws/animals/luna')
      expect(card?.target).toBe('_blank')
      expect(card?.rel).toContain('noopener')
      expect(card?.rel).toContain('noreferrer')
      expect(card?.title).toBe('View profile')
    })

    it('renders the sex tag for a male animal', async () => {
      mockAnimals([buildAnimal({ sex: 'MALE' })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-meta .velora-tag')?.textContent).toBe('♂ Male')
    })

    it('renders the sex tag for a female animal', async () => {
      mockAnimals([buildAnimal({ sex: 'FEMALE' })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-card-meta .velora-tag')?.textContent).toBe('♀ Female')
    })

    /**
     * The upload URL matters here, and a third-party one would make this test
     * pass with the variant resolution removed — for anything that is not a
     * velora.pet upload, imgSrc is the identity function.
     *
     * What has to stay wired is the CORP bypass: an upload served from
     * velora.pet answers with a redirect carrying
     * `Cross-Origin-Resource-Policy: same-origin`, which the browser refuses to
     * follow from a breeder's own WordPress site — which is every site this
     * plugin exists for. Resolving images.velora.pet directly is what avoids
     * it, and dropping that call has already lost one cattery its photos in
     * production.
     */
    it('resolves an upload to the CDN variant rather than the redirecting URL', async () => {
      mockAnimals([
        buildAnimal({ name: 'Photo Cat', photoUrl: 'https://velora.pet/uploads/abc123' }),
      ])

      const root = await mountWidget()
      const img = root.querySelector<HTMLImageElement>('.velora-card-img')

      expect(img?.tagName).toBe('IMG')
      expect(img?.src).toBe('https://images.velora.pet/abc123-md.webp')
      expect(img?.alt).toBe('Photo Cat')
      expect(img?.loading).toBe('lazy')
    })

    it('leaves a third-party photo URL untouched', async () => {
      mockAnimals([buildAnimal({ photoUrl: 'https://cdn.example.com/luna.jpg' })])

      const root = await mountWidget()

      expect(root.querySelector<HTMLImageElement>('.velora-card-img')?.src).toBe(
        'https://cdn.example.com/luna.jpg',
      )
    })

    it('renders a paw emoji placeholder instead of a photo when photoUrl is absent', async () => {
      mockAnimals([buildAnimal({ photoUrl: null })])

      const root = await mountWidget()
      const placeholder = root.querySelector('.velora-card-img-placeholder')

      expect(placeholder).toBeTruthy()
      expect(placeholder?.textContent).toBe('🐾')
      expect(root.querySelector('img.velora-card-img')).toBeNull()
    })

    it('renders title tags when the animal has titles', async () => {
      mockAnimals([buildAnimal({ titles: ['GIC', 'CH'] })])

      const root = await mountWidget()
      const titleTags = Array.from(root.querySelectorAll('.velora-tag-title')).map((el) => el.textContent)

      expect(titleTags).toEqual(['GIC', 'CH'])
    })

    it('renders no title tags when the animal has no titles', async () => {
      mockAnimals([buildAnimal({ titles: [] })])

      const root = await mountWidget()

      expect(root.querySelector('.velora-tag-title')).toBeNull()
    })

    it('injects animal JSON-LD structured data after rendering', async () => {
      mockAnimals([buildAnimal({ name: 'Luna' })])

      const root = await mountWidget()
      await flush()
      const script = root.querySelector('script[type="application/ld+json"]')

      expect(script).toBeTruthy()
      const payload = JSON.parse(script!.textContent ?? '{}') as { '@type': string }
      expect(payload['@type']).toBe('ItemList')
    })

    it('uses the fetched breeder profile name in the JSON-LD title', async () => {
      mockAnimals([buildAnimal()], { name: 'Velvet Paws Cattery', slug: 'velvet-paws' })

      const root = await mountWidget()
      await flush()
      const script = root.querySelector('script[type="application/ld+json"]')
      const payload = JSON.parse(script!.textContent ?? '{}') as { name: string }

      expect(payload.name).toBe('Velvet Paws Cattery — animals')
    })

    it('falls back to the breeder slug in the JSON-LD title when the profile fetch fails', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/animals')) return Promise.resolve(jsonResponse({ data: [buildAnimal()] }))
        return Promise.reject(new Error('profile fetch failed'))
      })

      const root = await mountWidget()
      await flush()
      const script = root.querySelector('script[type="application/ld+json"]')
      const payload = JSON.parse(script!.textContent ?? '{}') as { name: string }

      expect(payload.name).toBe('velvet-paws — animals')
    })
  })

  // ---------------------------------------------------------------------
  // Age calculation
  // ---------------------------------------------------------------------

  /**
   * These pin a bug, not a contract. The widget's config below is `locale: 'en'`
   * and every other visible string honours it — the sex tag reads "♂ Male" —
   * but the age is assembled from Polish forms hardcoded in calculateAge, so an
   * English embed shows "3 lata". The assertions below describe what the code
   * does today so the four plural branches stay covered; when the age moves
   * behind the translator they have to change with it.
   * Recorded as item 3a in docs/backlog/wp-plugins-fixes.md.
   */
  describe('age tag', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'))
    })

    it('renders age in months for an animal under a year old', async () => {
      mockAnimals([buildAnimal({ birthDate: '2025-08-20' })])

      const root = await mountWidget()
      const tags = Array.from(root.querySelectorAll('.velora-card-meta .velora-tag')).map((el) => el.textContent)

      expect(tags).toContain('4 m-cy')
    })

    it('renders "rok" for an animal exactly one year old', async () => {
      mockAnimals([buildAnimal({ birthDate: '2025-01-15' })])

      const root = await mountWidget()
      const tags = Array.from(root.querySelectorAll('.velora-card-meta .velora-tag')).map((el) => el.textContent)

      expect(tags).toContain('1 rok')
    })

    it('renders "lata" for an animal between two and four years old', async () => {
      mockAnimals([buildAnimal({ birthDate: '2023-01-15' })])

      const root = await mountWidget()
      const tags = Array.from(root.querySelectorAll('.velora-card-meta .velora-tag')).map((el) => el.textContent)

      expect(tags).toContain('3 lata')
    })

    it('renders "lat" for an animal five years old or older', async () => {
      mockAnimals([buildAnimal({ birthDate: '2021-01-15' })])

      const root = await mountWidget()
      const tags = Array.from(root.querySelectorAll('.velora-card-meta .velora-tag')).map((el) => el.textContent)

      expect(tags).toContain('5 lat')
    })

    it('renders no age tag when birthDate cannot be parsed', async () => {
      mockAnimals([buildAnimal({ birthDate: 'not-a-date' })])

      const root = await mountWidget()
      const tags = Array.from(root.querySelectorAll('.velora-card-meta .velora-tag')).map((el) => el.textContent)

      // Only the sex tag should be present — no age tag for an unparseable date.
      expect(tags.length).toBe(1)
    })

    it('renders no age tag when birthDate is an empty string', async () => {
      mockAnimals([buildAnimal({ birthDate: '' })])

      const root = await mountWidget()
      const tags = Array.from(root.querySelectorAll('.velora-card-meta .velora-tag')).map((el) => el.textContent)

      expect(tags.length).toBe(1)
    })
  })

  // ---------------------------------------------------------------------
  // Empty results
  // ---------------------------------------------------------------------

  it('renders the empty state (not a grid) when the API returns zero animals', async () => {
    mockAnimals([])

    const root = await mountWidget()

    expect(root.querySelector('.velora-state-empty')?.textContent).toBe('No data to display')
    expect(root.querySelector('.velora-grid-animals')).toBeNull()
  })

  // ---------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------

  describe('error handling', () => {
    it('renders an error state with the thrown message when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('Network down'))

      const root = await mountWidget()

      expect(root.querySelector('[role="alert"]')).toBeTruthy()
      expect(root.querySelector('.velora-state-detail')?.textContent).toBe('Network error: Network down')
    })

    it('retries the request when the retry button is clicked, and renders the retried result', async () => {
      fetchMock.mockImplementationOnce(() => Promise.reject(new Error('boom')))
      // Subsequent calls fall through to the default beforeEach mock: empty animals.

      const root = await mountWidget()
      const retryBtn = root.querySelector<HTMLButtonElement>('.velora-btn-retry')
      expect(retryBtn).toBeTruthy()

      retryBtn!.click()
      await flush()

      expect(root.querySelector('.velora-state-empty')).toBeTruthy()
      expect(root.querySelector('[role="alert"]')).toBeNull()
    })
  })
})
