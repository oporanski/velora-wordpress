import { Widget, getAttr } from './base'
import type { BreederAnimal } from '../api-client'
import { breedName, colorName } from '../breeds'
import { injectAnimalsJsonLd } from '../seo'
import { imgSrc } from '../image'

export class BreederAnimalsWidget extends Widget {
  async mount(): Promise<void> {
    const slug = getAttr(this.ctx.root, 'data-breeder')
    const limit = Number(getAttr(this.ctx.root, 'data-limit', '12')) || 12

    if (!slug) {
      this.renderError('Missing data-breeder attribute')
      return
    }

    this.renderLoading()
    try {
      const animals = await this.ctx.api.getBreederAnimals(slug, limit)
      if (animals.length === 0) {
        this.renderEmpty()
        return
      }
      this.renderAnimals(animals, slug)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  private renderAnimals(animals: BreederAnimal[], breederSlug: string): void {
    const grid = this.createDiv('velora-grid velora-grid-animals')
    for (const animal of animals) {
      grid.appendChild(this.renderCard(animal, breederSlug))
    }
    this.ctx.root.replaceChildren(grid, this.buildFooter())
    // SEO: schema.org Pet/ItemList — fire-and-forget profile fetch for the
    // breeder name. If it fails, we still inject without the name.
    this.ctx.api
      .getProfile('breeders', breederSlug)
      .then((profile) => injectAnimalsJsonLd(this.ctx.root, animals, profile.name, this.ctx.config.profileBase, breederSlug))
      .catch(() => injectAnimalsJsonLd(this.ctx.root, animals, breederSlug, this.ctx.config.profileBase, breederSlug))
  }

  private renderCard(animal: BreederAnimal, breederSlug: string): HTMLElement {
    const card = document.createElement('a')
    card.className = 'velora-card velora-card-animal'
    card.href = `${this.ctx.config.profileBase}/breeders/${encodeURIComponent(breederSlug)}/animals/${encodeURIComponent(animal.slug)}`
    card.target = '_blank'
    card.rel = 'noopener noreferrer'
    card.title = this.ctx.t('viewProfile')

    if (animal.photoUrl) {
      const img = document.createElement('img')
      img.className = 'velora-card-img'
      img.src = imgSrc(animal.photoUrl, 'md')
      img.alt = animal.name
      img.loading = 'lazy'
      card.appendChild(img)
    } else {
      const placeholder = this.createDiv('velora-card-img velora-card-img-placeholder')
      placeholder.textContent = '🐾'
      card.appendChild(placeholder)
    }

    const body = this.createDiv('velora-card-body')
    body.appendChild(this.createEl('h3', 'velora-card-title', animal.name))

    const breed = breedName(animal)
    const color = colorName(animal)
    const breedLine = color ? `${breed} · ${color}` : breed
    body.appendChild(this.createEl('p', 'velora-card-breed', breedLine))

    const meta = this.createDiv('velora-card-meta')
    meta.appendChild(this.createEl('span', 'velora-tag', this.ctx.t(animal.sex === 'MALE' ? 'sexMale' : 'sexFemale')))
    if (animal.birthDate) {
      const age = calculateAge(animal.birthDate)
      if (age) meta.appendChild(this.createEl('span', 'velora-tag', age))
    }
    body.appendChild(meta)

    if (animal.titles && animal.titles.length > 0) {
      const titles = this.createDiv('velora-card-meta')
      for (const title of animal.titles) {
        titles.appendChild(this.createEl('span', 'velora-tag velora-tag-title', title))
      }
      body.appendChild(titles)
    }

    card.appendChild(body)
    return card
  }
}

function calculateAge(birthDate: string): string | null {
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth()) -
    (now.getDate() < birth.getDate() ? 1 : 0)
  if (months < 12) return `${months} m-cy`
  const years = Math.floor(months / 12)
  let yearLabel: string
  if (years === 1) {
    yearLabel = 'rok'
  } else if (years < 5) {
    yearLabel = 'lata'
  } else {
    yearLabel = 'lat'
  }
  return `${years} ${yearLabel}`
}
