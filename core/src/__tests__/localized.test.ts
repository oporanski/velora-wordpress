import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ApiClient } from '../api-client'
import type { VeloraEvent, VeloraListing, VeloraPost, VeloraProfile } from '../api-client'
import { resolveConfig } from '../config'
import type { VeloraConfig } from '../config'
import { pickText, setLang } from '../localized'
import { EventsWidget } from '../widgets/events'
import { ListingsWidget } from '../widgets/listings'
import { PostsWidget } from '../widgets/posts'
import { AboutWidget } from '../widgets/about'

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

function respondWith(body: unknown): void {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

async function mount(
  Widget: new (root: HTMLElement, config: VeloraConfig) => { mount(): Promise<void> | void },
  attrs: Record<string, string> = {},
): Promise<HTMLElement> {
  const root = document.createElement('div')
  for (const [k, v] of Object.entries({ 'data-source': 'breeders', 'data-slug': 'cattery', ...attrs })) {
    root.setAttribute(k, v)
  }
  document.body.appendChild(root)
  await new Widget(root, { ...CONFIG, contentLang: 'de' }).mount()
  return root
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  delete (window as unknown as Record<string, unknown>).VeloraEmbedConfig
})

describe('resolveConfig contentLang', () => {
  const resolveWith = (contentLang: unknown): string | undefined => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = { contentLang }
    return resolveConfig().contentLang
  }

  it('keeps a two-letter lowercase code', () => {
    expect(resolveWith('de')).toBe('de')
  })

  it.each(['', 'DE', 'deu', 'd', 'd1', 'de_DE', 5, null])('drops %j', (value) => {
    expect(resolveWith(value)).toBeUndefined()
  })

  it('is unset when the page does not publish it', () => {
    expect(resolveConfig().contentLang).toBeUndefined()
  })
})

describe('ApiClient language parameter', () => {
  const lastUrl = (): string => fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string
  const calls: [string, (c: ApiClient) => Promise<unknown>, string][] = [
    ['events', (c) => c.getEvents('breeders', 'a b'), 'https://api.test/v1/breeders/a%20b/events?limit=20&when=upcoming'],
    ['posts', (c) => c.getPosts('clubs', 'club'), 'https://api.test/v1/clubs/club/posts?limit=10'],
    ['listings', (c) => c.getListings('breeders', 'cattery'), 'https://api.test/v1/breeders/cattery/listings?limit=20'],
    ['profile', (c) => c.getProfile('clubs', 'club'), 'https://api.test/v1/clubs/club'],
  ]

  it.each(calls)('appends lang to %s', async (_name, call, base) => {
    respondWith({ data: [] })
    await call(new ApiClient({ ...CONFIG, contentLang: 'de' }))
    expect(lastUrl()).toBe(`${base}${base.includes('?') ? '&' : '?'}lang=de`)
  })

  it.each(calls)('leaves %s untouched without contentLang', async (_name, call, base) => {
    respondWith({ data: [] })
    await call(new ApiClient(CONFIG))
    expect(lastUrl()).toBe(base)
  })

  it('encodes the value instead of splicing raw text', async () => {
    respondWith({ data: [] })
    await new ApiClient({ ...CONFIG, contentLang: 'a&b=c' }).getPosts('clubs', 'club')
    expect(lastUrl()).toBe('https://api.test/v1/clubs/club/posts?limit=10&lang=a%26b%3Dc')
  })
})

describe('pickText and setLang', () => {
  const item = {
    title: 'Original',
    body: 'Original body',
    note: null as string | null,
    localized: { language: 'de' as string | null, title: 'Titel', body: null as string | null },
  }

  it('prefers the selected version and reports its language', () => {
    expect(pickText(item, 'title')).toEqual({ text: 'Titel', lang: 'de' })
  })

  it('keeps the original, without a language, when the version lacks the field', () => {
    expect(pickText(item, 'body')).toEqual({ text: 'Original body', lang: null })
    expect(pickText(item, 'note')).toEqual({ text: null, lang: null })
  })

  it('keeps the original without a localized version', () => {
    expect(pickText({ title: 'Original', localized: undefined }, 'title')).toEqual({ text: 'Original', lang: null })
  })

  it('reads the version from a separate contract when given one', () => {
    const profile = { description: 'Original' }
    const group = { localized: { language: 'fr', description: 'Texte' } }
    expect(pickText(profile, 'description', group)).toEqual({ text: 'Texte', lang: 'fr' })
  })

  it('sets lang only when a language is known', () => {
    const a = document.createElement('p')
    setLang(a, 'de')
    expect(a.lang).toBe('de')
    const b = document.createElement('p')
    setLang(b, null)
    expect(b.hasAttribute('lang')).toBe(false)
  })
})

describe('widgets show the selected language version', () => {
  const event: VeloraEvent = {
    id: 'e1', title: 'Show', slug: 'show', startDate: '2030-01-01', endDate: null,
    city: null, country: null, imageUrl: null,
    localized: { language: 'de', title: 'Ausstellung' }, availableLanguages: ['pl', 'de'],
  }
  const listing: VeloraListing = {
    id: 'l1', slug: null, title: 'Kitten', price: null, currency: 'PLN', species: 'CAT',
    city: null, country: null, images: [], createdAt: '2030-01-01',
    localized: { language: 'de', title: 'Kätzchen' },
  }
  const post: VeloraPost = {
    id: 'p1', title: 'News', content: '<p>Original</p>', mediaUrls: [],
    publishedAt: '2030-01-01', createdAt: '2030-01-01',
    localized: { language: 'de', title: 'Neuigkeiten', content: '<p>Übersetzt</p>' },
  }
  const profile: VeloraProfile = {
    id: 'b1', name: 'Cattery', slug: 'cattery', logo: null, description: 'Original text',
    city: null, country: null,
    // Real shape: the profile is a grouped model, its texts sit in localizedGroups.profile.
    localizedGroups: {
      profile: {
        localized: { language: 'de', description: 'Übersetzter Text' },
        availableLanguages: ['pl', 'de'],
      },
    },
  }

  it('events: localized title with lang attribute', async () => {
    respondWith({ data: [event] })
    const root = await mount(EventsWidget)
    const h = root.querySelector('h3.velora-card-title') as HTMLElement
    expect(h.textContent).toBe('Ausstellung')
    expect(h.lang).toBe('de')
  })

  it('events: base title when there is no localized version', async () => {
    const { localized: _unused, ...plain } = event
    respondWith({ data: [plain] })
    const root = await mount(EventsWidget)
    const h = root.querySelector('h3.velora-card-title') as HTMLElement
    expect(h.textContent).toBe('Show')
    expect(h.hasAttribute('lang')).toBe(false)
  })

  it('listings: localized title', async () => {
    respondWith({ data: [listing] })
    const root = await mount(ListingsWidget)
    expect(root.querySelector('h3.velora-card-title')?.textContent).toBe('Kätzchen')
  })

  it('posts: localized title and content', async () => {
    respondWith({ data: [post] })
    const root = await mount(PostsWidget)
    expect(root.querySelector('.velora-post-title')?.textContent).toBe('Neuigkeiten')
    const box = root.querySelector('.velora-post-content') as HTMLElement
    expect(box.textContent).toBe('Übersetzt')
    expect(box.lang).toBe('de')
  })

  it('posts: base content without localized version', async () => {
    const { localized: _unused, ...plain } = post
    respondWith({ data: [plain] })
    const root = await mount(PostsWidget)
    expect(root.querySelector('.velora-post-title')?.textContent).toBe('News')
    expect(root.querySelector('.velora-post-content')?.textContent).toBe('Original')
  })

  it('posts: original content carries no lang when the version has none', async () => {
    const partial: VeloraPost = { ...post, localized: { language: 'de', title: 'Neuigkeiten', content: null } }
    respondWith({ data: [partial] })
    const root = await mount(PostsWidget)
    expect((root.querySelector('.velora-post-title') as HTMLElement).lang).toBe('de')
    const box = root.querySelector('.velora-post-content') as HTMLElement
    expect(box.textContent).toBe('Original')
    expect(box.hasAttribute('lang')).toBe(false)
  })

  it('about: localized description', async () => {
    respondWith(profile)
    const root = await mount(AboutWidget)
    const p = root.querySelector('.velora-about-description') as HTMLElement
    expect(p.textContent).toBe('Übersetzter Text')
    expect(p.lang).toBe('de')
  })
})
