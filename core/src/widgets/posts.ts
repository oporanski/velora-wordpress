import { Widget, getAttr } from './base'
import type { VeloraPost } from '../api-client'
import { imgSrc } from '../image'

/**
 * Posts widget — renders the latest published posts from a breeder or club.
 *
 * Designed to mirror the portal post card so a visitor on the breeder's
 * own WP site sees the same content that lives at velora.pet/posts/{id}:
 *   - Multi-image mini-gallery layouts (1 / 2 / 3 / 4+ photos) matching
 *     PostCardMedia.tsx on the portal.
 *   - Click any photo → opens an inline lightbox (same component used by
 *     the gallery widget).
 *   - Sanitized HTML content rendered inline (paragraphs, bold, italics,
 *     links, lists, headings, blockquotes, embedded images). NOT raw
 *     content from the API — every node passes through sanitizeHtml()
 *     which strips scripts, event handlers, iframes, on* attrs, and any
 *     element / attribute not in the allow-list.
 *
 * XSS surface: the embed runs on third-party pages. Even though Velora
 * posts go through Tiptap (server-side sanitized) before storage,
 * accepting that as our only defence would mean a single Tiptap bug
 * compromises every host site. Re-sanitizing client-side gives us
 * defence in depth.
 */
export class PostsWidget extends Widget {
  async mount(): Promise<void> {
    const source = getAttr(this.ctx.root, 'data-source') as 'breeders' | 'clubs'
    const slug = getAttr(this.ctx.root, 'data-slug')
    const limit = Number(getAttr(this.ctx.root, 'data-limit', '6')) || 6

    if (!slug || (source !== 'breeders' && source !== 'clubs')) {
      this.renderError('Required: data-source="breeders|clubs" + data-slug="..."')
      return
    }

    this.renderLoading()
    try {
      const posts = await this.ctx.api.getPosts(source, slug, limit)
      if (posts.length === 0) {
        this.renderEmpty()
        return
      }
      this.renderPosts(posts)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  protected renderEmpty(): void {
    this.ctx.root.replaceChildren(
      this.createDiv('velora-state velora-state-empty', (el) => {
        el.appendChild(this.createEl('p', undefined, this.ctx.t('postsNone')))
      }),
    )
  }

  private renderPosts(posts: VeloraPost[]): void {
    const list = this.createDiv('velora-posts')
    for (const post of posts) list.appendChild(this.renderPost(post))
    this.ctx.root.replaceChildren(list, this.buildFooter())
  }

  private renderPost(post: VeloraPost): HTMLElement {
    const article = document.createElement('article')
    article.className = 'velora-post velora-post-full'

    const body = this.createDiv('velora-post-body')

    const title = this.createEl('h3', 'velora-post-title', post.title)
    body.appendChild(title)

    if (post.publishedAt) {
      const date = new Date(post.publishedAt).toLocaleDateString(this.ctx.config.locale, {
        day: 'numeric', month: 'long', year: 'numeric',
      })
      body.appendChild(this.createEl('p', 'velora-post-date', `${this.ctx.t('postsPublishedAt')}: ${date}`))
    }

    if (post.content) {
      const contentBox = this.createDiv('velora-post-content')
      // sanitizeHtml returns a DocumentFragment of allow-listed nodes only.
      const safe = sanitizeHtml(post.content, this.ctx.config.profileBase)
      contentBox.appendChild(safe)
      body.appendChild(contentBox)
    }

    article.appendChild(body)

    if (post.mediaUrls && post.mediaUrls.length > 0) {
      article.appendChild(this.renderGallery(post.mediaUrls))
    }

    const link = document.createElement('a')
    link.className = 'velora-post-link'
    link.href = `${this.ctx.config.profileBase}/posts/${encodeURIComponent(post.id)}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = this.ctx.t('postReadMore') + ' →'
    body.appendChild(link)

    return article
  }

  /**
   * Mini-gallery matching the portal PostCardMedia layouts:
   *   1   → single max-480px centered image
   *   2   → 2-column grid
   *   3   → 1 large left + 2 stacked right
   *   4+  → 2x2 grid; cell 4 shows "+N" overlay if more
   * Click any tile → opens the inline lightbox at that index.
   */
  private renderGallery(urls: string[]): HTMLElement {
    const wrap = this.createDiv(`velora-post-gallery velora-post-gallery-${Math.min(urls.length, 4)}`)
    const visible = urls.slice(0, 4)
    const extra = urls.length - 4

    visible.forEach((url, i) => {
      const tile = document.createElement('button')
      tile.type = 'button'
      tile.className = 'velora-post-gallery-tile'
      const img = document.createElement('img')
      // 'md' is enough for grid; lightbox uses 'lg'/'original' on demand.
      img.src = imgSrc(url, urls.length === 1 ? 'lg' : 'md')
      img.alt = ''
      img.loading = 'lazy'
      tile.appendChild(img)
      if (i === 3 && extra > 0) {
        const overlay = this.createDiv('velora-post-gallery-overflow')
        overlay.textContent = `+${extra}`
        tile.appendChild(overlay)
      }
      tile.addEventListener('click', () => this.openLightbox(urls, i))
      wrap.appendChild(tile)
    })

    return wrap
  }

  private openLightbox(urls: string[], startIndex: number): void {
    let cursor = startIndex
    const overlay = this.createDiv('velora-lightbox')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')

    const stage = this.createDiv('velora-lightbox-stage')
    const img = document.createElement('img')
    img.className = 'velora-lightbox-img'
    stage.appendChild(img)
    const caption = this.createDiv('velora-lightbox-caption')

    const close = this.createEl('button', 'velora-lightbox-btn velora-lightbox-close', '×')
    const prev = this.createEl('button', 'velora-lightbox-btn velora-lightbox-prev', '‹')
    const next = this.createEl('button', 'velora-lightbox-btn velora-lightbox-next', '›')

    overlay.append(close, prev, stage, caption, next)
    document.body.appendChild(overlay)

    const setCursor = (i: number) => {
      cursor = (i + urls.length) % urls.length
      img.src = imgSrc(urls[cursor], 'original')
      caption.textContent = `${cursor + 1} / ${urls.length}`
    }
    const closeOverlay = () => {
      document.removeEventListener('keydown', onKey)
      overlay.remove()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
      else if (e.key === 'ArrowLeft') setCursor(cursor - 1)
      else if (e.key === 'ArrowRight') setCursor(cursor + 1)
    }

    close.addEventListener('click', closeOverlay)
    prev.addEventListener('click', () => setCursor(cursor - 1))
    next.addEventListener('click', () => setCursor(cursor + 1))
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay() })
    document.addEventListener('keydown', onKey)

    setCursor(startIndex)
  }
}

/**
 * Strict allow-list HTML sanitizer.
 *
 * Parses input through DOMParser into a detached document (no script
 * execution), then walks the tree keeping only allow-listed elements
 * and attributes. Anything else is unwrapped (for permitted-but-unknown
 * elements) or stripped entirely (script/style/iframe/event-handlers).
 *
 * Returns a DocumentFragment ready for appendChild. We never assign
 * innerHTML on the host page — every appended node is one we created
 * or vetted.
 */
function sanitizeHtml(html: string, profileBase: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html')
  const frag = document.createDocumentFragment()
  for (const node of Array.from(doc.body.childNodes)) {
    const cloned = sanitizeNode(node, profileBase)
    if (cloned) frag.appendChild(cloned)
  }
  return frag
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['class']),
}

function sanitizeChildren(parent: Node, target: Node, profileBase: string): void {
  for (const child of Array.from(parent.childNodes)) {
    const c = sanitizeNode(child, profileBase)
    if (c) target.appendChild(c)
  }
}

function copyAllowedAttrs(el: Element, tag: string, out: Element, profileBase: string): void {
  const allowedForTag = ALLOWED_ATTRS[tag] ?? new Set<string>()
  const allowedAlways = ALLOWED_ATTRS['*']
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) continue
    if (!allowedForTag.has(name) && !allowedAlways.has(name)) continue
    let value = attr.value
    if ((tag === 'a' && name === 'href') || (tag === 'img' && name === 'src')) {
      value = sanitizeUrl(value, profileBase)
      if (!value) continue
    }
    out.setAttribute(name, value)
  }
}

function applyTagDefaults(tag: string, out: Element): void {
  if (tag === 'a') {
    out.setAttribute('target', '_blank')
    out.setAttribute('rel', 'noopener noreferrer')
  }
  if (tag === 'img') {
    out.setAttribute('loading', 'lazy')
    const src = out.getAttribute('src')
    if (src) out.setAttribute('src', imgSrc(src, 'lg'))
  }
}

function sanitizeNode(node: Node, profileBase: string): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (!ALLOWED_TAGS.has(tag)) {
    const wrapper = document.createDocumentFragment()
    sanitizeChildren(el, wrapper, profileBase)
    return wrapper
  }

  const out = document.createElement(tag)
  copyAllowedAttrs(el, tag, out, profileBase)
  applyTagDefaults(tag, out)
  sanitizeChildren(el, out, profileBase)
  return out
}

/**
 * Allow only http/https/relative URLs. Reject javascript:, data:, vbscript:,
 * file:, etc. Relative URLs starting with / get the profileBase prepended
 * so embeds on third-party origins resolve to velora.pet.
 */
function sanitizeUrl(url: string, profileBase: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^javascript:|^data:|^vbscript:|^file:/i.test(trimmed)) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return `${profileBase.replace(/\/$/, '')}${trimmed}`
  // Relative URLs without leading slash are rare in Tiptap output;
  // pass through but they'll resolve against the host page (typically
  // safe but unintended).
  return trimmed
}
