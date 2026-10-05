import { Widget, getAttr } from './base'
import type { VeloraGalleryAlbum, VeloraGalleryPhoto } from '../api-client'
import { imgSrc } from '../image'

/**
 * Gallery widget — shared between breeder and club via data-source.
 *
 * Mirrors the portal's /breeders/:slug/gallery + /clubs/:slug/gallery
 * UX: visitor sees a grid of ALBUMS (not flat photo dump), each with a
 * cover thumb and photo count. Clicking an album opens a lightbox-style
 * carousel of that album's photos. This matches user mental model
 * ("Wystawy 2024" / "Kocięta z miotu A" are distinct contexts) and
 * keeps the embed lightweight (cover-only render, photos lazy-load
 * once the lightbox opens).
 *
 * Usage:
 *   <div data-velora-widget="gallery"
 *        data-source="breeders|clubs"
 *        data-slug="..."
 *        data-photos-per-album="30"></div>
 */
export class GalleryWidget extends Widget {
  async mount(): Promise<void> {
    const source = getAttr(this.ctx.root, 'data-source') as 'breeders' | 'clubs'
    const slug = getAttr(this.ctx.root, 'data-slug')
    const photosPerAlbum = Number(getAttr(this.ctx.root, 'data-photos-per-album', '30')) || 30

    if (!slug || (source !== 'breeders' && source !== 'clubs')) {
      this.renderError('Required: data-source="breeders|clubs" + data-slug="..."')
      return
    }

    this.renderLoading()
    try {
      const albums = await this.ctx.api.getGallery(source, slug, photosPerAlbum)
      if (albums.length === 0) {
        this.renderEmpty()
        return
      }
      this.renderAlbums(albums)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  private renderAlbums(albums: VeloraGalleryAlbum[]): void {
    const grid = this.createDiv('velora-grid velora-grid-gallery-albums')
    for (const album of albums) grid.appendChild(this.renderAlbumCard(album))
    this.ctx.root.replaceChildren(grid, this.buildFooter())
  }

  private renderAlbumCard(album: VeloraGalleryAlbum): HTMLElement {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'velora-gallery-album'
    card.setAttribute('aria-label', album.name)

    const cover = document.createElement('div')
    cover.className = 'velora-gallery-album-cover'
    if (album.coverPhoto) {
      const img = document.createElement('img')
      img.src = imgSrc(album.coverPhoto, 'md')
      img.alt = album.name
      img.loading = 'lazy'
      cover.appendChild(img)
    }
    card.appendChild(cover)

    const body = this.createDiv('velora-gallery-album-body')
    body.appendChild(this.createEl('h3', 'velora-gallery-album-title', album.name))
    const count = album.photoCount === 1
      ? '1 zdjęcie'
      : `${album.photoCount} zdjęć`
    body.appendChild(this.createEl('p', 'velora-gallery-album-meta', count))
    if (album.description) {
      body.appendChild(this.createEl('p', 'velora-gallery-album-desc', album.description))
    }
    card.appendChild(body)

    card.addEventListener('click', () => this.openAlbumLightbox(album))
    return card
  }

  private openAlbumLightbox(album: VeloraGalleryAlbum): void {
    const photos = album.photos
    if (photos.length === 0) return

    let cursor = 0
    const overlay = this.createDiv('velora-lightbox')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', album.name)

    const stage = this.createDiv('velora-lightbox-stage')
    const img = document.createElement('img')
    img.className = 'velora-lightbox-img'
    stage.appendChild(img)

    const caption = this.createDiv('velora-lightbox-caption')

    const close = this.createEl('button', 'velora-lightbox-btn velora-lightbox-close', '×')
    close.setAttribute('aria-label', 'Close')
    const prev = this.createEl('button', 'velora-lightbox-btn velora-lightbox-prev', '‹')
    prev.setAttribute('aria-label', 'Previous')
    const next = this.createEl('button', 'velora-lightbox-btn velora-lightbox-next', '›')
    next.setAttribute('aria-label', 'Next')

    overlay.append(close, prev, stage, caption, next)
    document.body.appendChild(overlay)

    const setCursor = (i: number) => {
      cursor = (i + photos.length) % photos.length
      const p: VeloraGalleryPhoto = photos[cursor]
      img.src = imgSrc(p.fileUrl, 'lg')
      img.alt = p.title || album.name
      const counter = `${cursor + 1} / ${photos.length}`
      caption.textContent = [album.name, p.title, counter].filter(Boolean).join(' · ')
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
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay()
    })
    document.addEventListener('keydown', onKey)

    setCursor(0)
  }
}
