import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PostsWidget } from '../widgets/posts'
import type { VeloraConfig } from '../config'
import type { VeloraPost } from '../api-client'

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

function post(overrides: Partial<VeloraPost> = {}): VeloraPost {
  return {
    id: 'p1', title: 'News', content: '', mediaUrls: [],
    publishedAt: '2030-01-02T00:00:00Z', createdAt: '2030-01-01T00:00:00Z', ...overrides,
  }
}

async function mountPosts(posts: VeloraPost[], attrs: Record<string, string> = {}): Promise<HTMLElement> {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ data: posts }) })
  const root = document.createElement('div')
  for (const [k, v] of Object.entries({ 'data-source': 'clubs', 'data-slug': 'club', ...attrs })) {
    root.setAttribute(k, v)
  }
  document.body.appendChild(root)
  await new PostsWidget(root, CONFIG).mount()
  return root
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('PostsWidget', () => {
  it('requests the club posts with the configured limit', async () => {
    await mountPosts([post()], { 'data-limit': '3' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v1/clubs/club/posts?limit=3')
  })

  it('shows an empty state without posts', async () => {
    const root = await mountPosts([])
    expect(root.querySelector('.velora-state-empty')).not.toBeNull()
  })

  it('reports missing attributes and request failures', async () => {
    let root = await mountPosts([post()], { 'data-slug': '' })
    expect(root.querySelector('.velora-state-error')).not.toBeNull()
    fetchMock.mockRejectedValue(new Error('boom'))
    root = document.createElement('div')
    root.setAttribute('data-source', 'breeders')
    root.setAttribute('data-slug', 'x')
    document.body.appendChild(root)
    await new PostsWidget(root, CONFIG).mount()
    expect(root.querySelector('.velora-state-detail')?.textContent).toContain('boom')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ data: [post()] }) })
    root.querySelector<HTMLButtonElement>('.velora-btn-retry')!.click()
    await vi.waitFor(() => expect(root.querySelector('.velora-post')).not.toBeNull())
  })

  it('links each post to its portal page and shows the date', async () => {
    const root = await mountPosts([post({ id: 'a/b' })])
    expect((root.querySelector('a.velora-post-link') as HTMLAnchorElement).href).toBe('https://test.pet/posts/a%2Fb')
    expect(root.querySelector('.velora-post-date')).not.toBeNull()
  })

  it('omits the date when the post has none', async () => {
    const root = await mountPosts([post({ publishedAt: '' })])
    expect(root.querySelector('.velora-post-date')).toBeNull()
  })

  it('sanitizes the content to the allow-list', async () => {
    const html = [
      '<p class="x" onclick="evil()">Hi <strong>there</strong></p>',
      '<script>alert(1)</script>',
      '<custom-tag>kept text</custom-tag>',
      '<a href="javascript:alert(1)">bad</a>',
      '<a href="https://ok.test/x">ok</a>',
      '<a href="/relative">rel</a>',
      '<a href="page">plain</a>',
      '<a href="  ">blank</a>',
      '<img src="/uploads/abc" alt="pic" onerror="evil()">',
      '<!-- comment -->',
    ].join('')
    const root = await mountPosts([post({ content: html })])
    const box = root.querySelector('.velora-post-content') as HTMLElement
    expect(box.querySelector('script')).toBeNull()
    expect(box.querySelector('[onclick]')).toBeNull()
    expect(box.querySelector('[onerror]')).toBeNull()
    expect(box.textContent).toContain('kept text')
    const hrefs = Array.from(box.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([null, 'https://ok.test/x', 'https://test.pet/relative', 'page', null])
    const link = box.querySelectorAll('a')[1]
    expect(link.rel).toBe('noopener noreferrer')
    expect(box.querySelector('img')?.getAttribute('loading')).toBe('lazy')
  })

  it.each([1, 2, 3, 5])('lays out %i media items', async (n) => {
    const urls = Array.from({ length: n }, (_, i) => `https://cdn.test/${i}.jpg`)
    const root = await mountPosts([post({ mediaUrls: urls })])
    expect(root.querySelector(`.velora-post-gallery-${Math.min(n, 4)}`)).not.toBeNull()
    expect(root.querySelectorAll('.velora-post-gallery-tile').length).toBe(Math.min(n, 4))
    expect(root.querySelector('.velora-post-gallery-overflow')?.textContent ?? '').toBe(n > 4 ? `+${n - 4}` : '')
  })

  it('opens a lightbox that steps through photos and closes', async () => {
    const urls = ['https://cdn.test/0.jpg', 'https://cdn.test/1.jpg', 'https://cdn.test/2.jpg']
    const root = await mountPosts([post({ mediaUrls: urls })])
    const tiles = root.querySelectorAll<HTMLButtonElement>('.velora-post-gallery-tile')
    tiles[0].click()
    const overlay = () => document.querySelector('.velora-lightbox') as HTMLElement | null
    const caption = () => document.querySelector('.velora-lightbox-caption')?.textContent
    expect(caption()).toBe('1 / 3')

    ;(document.querySelector('.velora-lightbox-next') as HTMLElement).click()
    expect(caption()).toBe('2 / 3')
    ;(document.querySelector('.velora-lightbox-prev') as HTMLElement).click()
    ;(document.querySelector('.velora-lightbox-prev') as HTMLElement).click()
    expect(caption()).toBe('3 / 3')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(caption()).toBe('1 / 3')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(caption()).toBe('3 / 3')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(overlay()).not.toBeNull()

    overlay()!.click()
    expect(overlay()).toBeNull()

    tiles[1].click()
    ;(document.querySelector('.velora-lightbox-close') as HTMLElement).click()
    expect(overlay()).toBeNull()

    tiles[2].click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(overlay()).toBeNull()
  })

  it('keeps the lightbox open when the click lands inside it', async () => {
    const root = await mountPosts([post({ mediaUrls: ['https://cdn.test/0.jpg'] })])
    root.querySelector<HTMLButtonElement>('.velora-post-gallery-tile')!.click()
    ;(document.querySelector('.velora-lightbox-caption') as HTMLElement).click()
    expect(document.querySelector('.velora-lightbox')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
})
