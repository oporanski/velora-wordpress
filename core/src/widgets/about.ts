import { Widget, getAttr } from './base'
import type { VeloraProfile } from '../api-client'
import { normalizeBreeds } from '../breeds'
import { imgSrc } from '../image'

/**
 * About widget — shared between breeder and club via data-source.
 * Renders profile header (logo + name + verified badge) + meta + description preview + social links.
 *
 * Usage:
 *   <div data-velora-widget="about" data-source="breeders" data-slug="..."></div>
 */
export class AboutWidget extends Widget {
  async mount(): Promise<void> {
    const source = getAttr(this.ctx.root, 'data-source') as 'breeders' | 'clubs'
    const slug = getAttr(this.ctx.root, 'data-slug')

    if (!slug || (source !== 'breeders' && source !== 'clubs')) {
      this.renderError('Required: data-source="breeders|clubs" + data-slug="..."')
      return
    }

    this.renderLoading()
    try {
      const profile = await this.ctx.api.getProfile(source, slug)
      this.renderProfile(profile, source)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  private buildHeader(p: VeloraProfile, source: 'breeders' | 'clubs'): HTMLElement {
    const header = this.createDiv('velora-about-header')
    if (p.logo) {
      const img = document.createElement('img')
      img.className = 'velora-about-logo'
      img.src = imgSrc(p.logo, 'md')
      img.alt = p.name
      img.loading = 'lazy'
      header.appendChild(img)
    } else {
      const placeholder = this.createDiv('velora-about-logo velora-card-avatar-placeholder')
      placeholder.textContent = p.name.charAt(0).toUpperCase()
      header.appendChild(placeholder)
    }

    const headerBody = this.createDiv('velora-about-header-body')
    const titleRow = this.createDiv('velora-about-title-row')
    const titleLink = document.createElement('a')
    titleLink.className = 'velora-about-title'
    titleLink.href = `${this.ctx.config.profileBase}/${source}/${encodeURIComponent(p.slug)}`
    titleLink.target = '_blank'
    titleLink.rel = 'noopener noreferrer'
    titleLink.textContent = p.name
    titleRow.appendChild(titleLink)
    if (p.verified) {
      titleRow.appendChild(this.createEl('span', 'velora-tag velora-tag-verified', '✓ ' + this.ctx.t('verified')))
    }
    headerBody.appendChild(titleRow)

    const meta = this.createDiv('velora-about-meta')
    const breedNames = normalizeBreeds(p.breeds ?? [])
    if (breedNames.length > 0) {
      meta.appendChild(this.metaItem(this.ctx.t('aboutBreeds'), breedNames.join(', ')))
    }
    const loc = [p.city, p.region, (p.country && p.country !== 'PL') ? p.country : null].filter(Boolean).join(', ')
    if (loc) meta.appendChild(this.metaItem(this.ctx.t('aboutLocation'), loc))
    if (p.foundedYear) meta.appendChild(this.metaItem(this.ctx.t('aboutFounded'), String(p.foundedYear)))
    headerBody.appendChild(meta)

    header.appendChild(headerBody)
    return header
  }

  private renderProfile(p: VeloraProfile, source: 'breeders' | 'clubs'): void {
    const wrap = this.createDiv('velora-about')
    wrap.appendChild(this.buildHeader(p, source))

    // Description preview (strip HTML)
    if (p.description) {
      const text = stripHtml(p.description)
      if (text) wrap.appendChild(this.createEl('p', 'velora-about-description', text))
    }

    // Contact row
    const contact = this.createDiv('velora-about-contact')
    if (p.contactEmail) {
      const a = document.createElement('a')
      a.href = `mailto:${p.contactEmail}`
      a.textContent = '✉ ' + p.contactEmail
      contact.appendChild(a)
    }
    if (p.contactPhone) {
      const a = document.createElement('a')
      a.href = `tel:${p.contactPhone.replace(/\s/g, '')}`
      a.textContent = '☎ ' + p.contactPhone
      contact.appendChild(a)
    }
    if (contact.children.length > 0) wrap.appendChild(contact)

    // Social row
    const social = this.createDiv('velora-about-social')
    const addSocial = (url: string | null | undefined, label: string): void => {
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = label
      a.className = 'velora-tag'
      social.appendChild(a)
    }
    addSocial(p.socialFacebook, 'Facebook')
    addSocial(p.socialInstagram, 'Instagram')
    addSocial(p.socialYoutube, 'YouTube')
    addSocial(p.socialTiktok, 'TikTok')
    addSocial(p.socialWebsite, '🌐 ' + (p.socialWebsite ?? '').replace(/^https?:\/\//, ''))
    if (social.children.length > 0) wrap.appendChild(social)

    this.ctx.root.replaceChildren(wrap, this.buildFooter())
  }

  private metaItem(label: string, value: string): HTMLElement {
    const item = this.createDiv('velora-about-meta-item')
    item.appendChild(this.createEl('span', 'velora-about-meta-label', label))
    item.appendChild(this.createEl('span', 'velora-about-meta-value', value))
    return item
  }
}

function stripHtml(html: string): string {
  if (!html) return ''
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${stripped.replace(/[<>]/g, '')}`, 'text/html')
  return doc.body.textContent ?? stripped
}
