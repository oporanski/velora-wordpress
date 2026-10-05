import { Widget, getAttr } from './base'
import type { VeloraListing } from '../api-client'
import { breedName } from '../breeds'
import { injectListingsJsonLd } from '../seo'
import { imgSrc } from '../image'

export class ListingsWidget extends Widget {
  async mount(): Promise<void> {
    const source = getAttr(this.ctx.root, 'data-source') as 'breeders' | 'clubs'
    const slug = getAttr(this.ctx.root, 'data-slug')
    const limit = Number(getAttr(this.ctx.root, 'data-limit', '12')) || 12

    if (!slug || (source !== 'breeders' && source !== 'clubs')) {
      this.renderError('Required: data-source="breeders|clubs" + data-slug="..."')
      return
    }

    this.renderLoading()
    try {
      const listings = await this.ctx.api.getListings(source, slug, limit)
      if (listings.length === 0) {
        this.renderEmpty()
        return
      }
      this.renderListings(listings)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  protected renderEmpty(): void {
    this.ctx.root.replaceChildren(
      this.createDiv('velora-state velora-state-empty', (el) => {
        el.appendChild(this.createEl('p', undefined, this.ctx.t('listingsNone')))
      }),
    )
  }

  private renderListings(listings: VeloraListing[]): void {
    const grid = this.createDiv('velora-grid velora-grid-listings')
    for (const l of listings) grid.appendChild(this.renderCard(l))
    this.ctx.root.replaceChildren(grid, this.buildFooter())
    injectListingsJsonLd(this.ctx.root, listings, this.ctx.config.profileBase)
  }

  private renderCard(l: VeloraListing): HTMLElement {
    const card = document.createElement('a')
    card.className = 'velora-card velora-card-listing'
    // Listing detail route: /marketplace/listings/:id (no slug routing).
    card.href = `${this.ctx.config.profileBase}/marketplace/listings/${encodeURIComponent(l.id)}`
    card.target = '_blank'
    card.rel = 'noopener noreferrer'
    card.title = this.ctx.t('viewProfile')

    if (l.images && l.images.length > 0) {
      const img = document.createElement('img')
      img.className = 'velora-card-img'
      img.src = imgSrc(l.images[0], 'md')
      img.alt = l.title
      img.loading = 'lazy'
      card.appendChild(img)
    } else {
      const placeholder = this.createDiv('velora-card-img velora-card-img-placeholder')
      placeholder.textContent = l.species === 'CAT' ? '🐱' : '🐶'
      card.appendChild(placeholder)
    }

    const body = this.createDiv('velora-card-body')
    body.appendChild(this.createEl('h3', 'velora-card-title', l.title))
    body.appendChild(this.createEl('p', 'velora-card-breed', breedName(l)))

    const meta = this.createDiv('velora-card-meta')
    if (l.city) meta.appendChild(this.createEl('span', 'velora-tag', l.city))
    body.appendChild(meta)

    const priceRow = this.createDiv('velora-card-listing-price')
    if (l.price !== null && l.price > 0) {
      priceRow.textContent = `${l.price.toLocaleString(this.ctx.config.locale)} ${l.currency}`
    } else {
      priceRow.textContent = this.ctx.t('listingPriceAsk')
      priceRow.classList.add('velora-card-listing-price-ask')
    }
    body.appendChild(priceRow)

    card.appendChild(body)
    return card
  }
}
