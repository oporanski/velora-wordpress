import { Widget, getAttr } from './base'
import type { ClubBreeder } from '../api-client'
import { normalizeBreeds } from '../breeds'
import { imgSrc } from '../image'

type Layout = 'auto' | 'cards' | 'table'
type SortKey = 'name' | 'city'

interface FilterState {
  breed: string
  region: string
  sort: SortKey
  sortDir: 'asc' | 'desc'
  layout: 'cards' | 'table'
}

export class ClubBreedersWidget extends Widget {
  private all: ClubBreeder[] = []
  private state!: FilterState
  private breedOptions: string[] = []
  private regionOptions: string[] = []

  async mount(): Promise<void> {
    const slug = getAttr(this.ctx.root, 'data-club')
    const limit = Number(getAttr(this.ctx.root, 'data-limit', '200')) || 200
    const layoutAttr = (getAttr(this.ctx.root, 'data-layout', 'auto') as Layout)

    if (!slug) {
      this.renderError('Missing data-club attribute')
      return
    }

    this.renderLoading()
    try {
      const raw = await this.ctx.api.getClubBreeders(slug, limit)
      this.all = raw.map((b) => ({
        ...b,
        breeds: normalizeBreeds(b.breeds ?? []),
      }))
      if (this.all.length === 0) {
        this.renderEmpty()
        return
      }
      this.computeOptions()
      this.state = {
        breed: '',
        region: '',
        sort: 'name',
        sortDir: 'asc',
        // Auto: table for >20 entries (balticfeline-style), cards for fewer.
        layout: layoutAttr === 'auto' ? this.resolveAutoLayout() : layoutAttr,
      }
      this.render()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  private resolveAutoLayout(): 'cards' | 'table' {
    return this.all.length > 20 ? 'table' : 'cards'
  }

  private computeOptions(): void {
    const breeds = new Set<string>()
    const regions = new Set<string>()
    for (const b of this.all) {
      for (const breed of b.breeds ?? []) breeds.add(breed)
      if (b.region != null) regions.add(b.region)
    }
    this.breedOptions = Array.from(breeds).sort((a, b) => a.localeCompare(b))
    this.regionOptions = Array.from(regions).sort((a, b) => a.localeCompare(b))
  }

  private filteredAndSorted(): ClubBreeder[] {
    const { breed, region, sort, sortDir } = this.state
    const filtered = this.all.filter((b) => {
      if (breed && !(b.breeds ?? []).includes(breed)) return false
      if (region && b.region !== region) return false
      return true
    })
    const cmp = (a: ClubBreeder, b: ClubBreeder): number => {
      let av = '', bv = ''
      if (sort === 'name') { av = a.name ?? ''; bv = b.name ?? '' }
      else if (sort === 'city') { av = a.city ?? ''; bv = b.city ?? '' }
      return av.localeCompare(bv, this.ctx.config.locale, { sensitivity: 'base' }) * (sortDir === 'asc' ? 1 : -1)
    }
    return filtered.slice().sort(cmp)
  }

  private render(): void {
    const list = this.filteredAndSorted()
    const wrap = document.createElement('div')
    wrap.appendChild(this.buildToolbar(list.length))
    if (list.length === 0) {
      const empty = this.createDiv('velora-state velora-state-empty')
      empty.appendChild(this.createEl('p', undefined, this.ctx.t('empty')))
      wrap.appendChild(empty)
    } else if (this.state.layout === 'table') {
      wrap.appendChild(this.buildTable(list))
    } else {
      wrap.appendChild(this.buildGrid(list))
    }
    this.ctx.root.replaceChildren(wrap, this.buildFooter())
  }

  private buildToolbar(visibleCount: number): HTMLElement {
    const t = this.ctx.t
    const toolbar = this.createDiv('velora-toolbar')

    // No species filter — clubs are single-species by design.
    if (this.breedOptions.length > 1) {
      toolbar.appendChild(this.buildSelect(t('filterBreed'), this.state.breed, [
        { value: '', label: t('filterAll') },
        ...this.breedOptions.map((b) => ({ value: b, label: b })),
      ], (v) => { this.state.breed = v; this.render() }))
    }

    if (this.regionOptions.length > 1) {
      toolbar.appendChild(this.buildSelect(t('filterRegion'), this.state.region, [
        { value: '', label: t('filterAll') },
        ...this.regionOptions.map((r) => ({ value: r, label: r })),
      ], (v) => { this.state.region = v; this.render() }))
    }

    toolbar.appendChild(this.buildSelect(t('sortBy'), `${this.state.sort}:${this.state.sortDir}`, [
      { value: 'name:asc',  label: `${t('sortName')} A→Z` },
      { value: 'name:desc', label: `${t('sortName')} Z→A` },
      { value: 'city:asc',  label: `${t('sortCity')} A→Z` },
    ], (v) => {
      const [k, d] = v.split(':') as [SortKey, 'asc' | 'desc']
      this.state.sort = k
      this.state.sortDir = d
      this.render()
    }))

    const spacer = this.createDiv('velora-toolbar-spacer')
    toolbar.appendChild(spacer)

    const count = this.createEl('span', 'velora-toolbar-count', t('countShowing').replace('{n}', String(visibleCount)))
    toolbar.appendChild(count)

    toolbar.appendChild(this.buildLayoutSwitch())

    return toolbar
  }

  private buildSelect(
    labelText: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
  ): HTMLElement {
    const group = this.createDiv('velora-toolbar-group')
    const label = this.createEl('label', 'velora-toolbar-label', labelText)
    const select = document.createElement('select')
    select.className = 'velora-toolbar-select'
    for (const opt of options) {
      const optionEl = document.createElement('option')
      optionEl.value = opt.value
      optionEl.textContent = opt.label
      if (opt.value === value) optionEl.selected = true
      select.appendChild(optionEl)
    }
    select.addEventListener('change', () => onChange(select.value))
    group.appendChild(label)
    group.appendChild(select)
    return group
  }

  private buildLayoutSwitch(): HTMLElement {
    const t = this.ctx.t
    const wrap = this.createDiv('velora-toolbar-layout')
    const mkBtn = (layout: 'cards' | 'table', label: string): HTMLButtonElement => {
      const btn = this.createEl('button', undefined, label)
      btn.type = 'button'
      btn.setAttribute('aria-pressed', String(this.state.layout === layout))
      btn.addEventListener('click', () => { this.state.layout = layout; this.render() })
      return btn
    }
    wrap.appendChild(mkBtn('cards', t('layoutCards')))
    wrap.appendChild(mkBtn('table', t('layoutTable')))
    return wrap
  }

  private buildGrid(list: ClubBreeder[]): HTMLElement {
    const grid = this.createDiv('velora-grid velora-grid-breeders')
    for (const b of list) grid.appendChild(this.renderCard(b))
    return grid
  }

  private renderCard(b: ClubBreeder): HTMLElement {
    const card = document.createElement('a')
    card.className = 'velora-card velora-card-breeder'
    card.href = `${this.ctx.config.profileBase}/breeders/${encodeURIComponent(b.slug)}`
    card.target = '_blank'
    card.rel = 'noopener noreferrer'
    card.title = this.ctx.t('viewProfile')

    if (b.logo) {
      const img = document.createElement('img')
      img.className = 'velora-card-avatar'
      img.src = imgSrc(b.logo, 'thumb')
      img.alt = b.name
      img.loading = 'lazy'
      card.appendChild(img)
    } else {
      const placeholder = this.createDiv('velora-card-avatar velora-card-avatar-placeholder')
      placeholder.textContent = b.name.charAt(0).toUpperCase()
      card.appendChild(placeholder)
    }

    const body = this.createDiv('velora-card-body')
    body.appendChild(this.createEl('h3', 'velora-card-title', b.name))
    if (b.breeds && b.breeds.length > 0) {
      body.appendChild(this.createEl('p', 'velora-card-breed', b.breeds.join(', ')))
    }

    const meta = this.createDiv('velora-card-meta')
    const location = [b.city, b.region].filter(Boolean).join(', ')
    if (location) meta.appendChild(this.createEl('span', 'velora-tag', location))
    if (b.country) meta.appendChild(this.createEl('span', 'velora-tag', b.country))
    if (b.verified) meta.appendChild(this.createEl('span', 'velora-tag velora-tag-verified', '✓ ' + this.ctx.t('verified')))
    body.appendChild(meta)

    card.appendChild(body)
    return card
  }

  private buildTableHead(): HTMLElement {
    const t = this.ctx.t
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    const cols: { key: SortKey | null; label: string }[] = [
      { key: 'name', label: t('thBreeder') },
      { key: null, label: t('thBreeds') },
      { key: 'city', label: t('thLocation') },
      { key: null, label: t('thCountry') },
    ]
    for (const col of cols) {
      const th = this.createEl('th', undefined, col.label)
      if (col.key) {
        const k = col.key
        if (this.state.sort === k) {
          th.setAttribute('aria-sort', this.state.sortDir === 'asc' ? 'ascending' : 'descending')
        }
        th.addEventListener('click', () => {
          if (this.state.sort === k) {
            this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc'
          } else {
            this.state.sort = k
            this.state.sortDir = 'asc'
          }
          this.render()
        })
      } else {
        th.style.cursor = 'default'
      }
      headRow.appendChild(th)
    }
    thead.appendChild(headRow)
    return thead
  }

  private buildTableRow(b: ClubBreeder): HTMLElement {
    const tr = document.createElement('tr')

    const tdName = document.createElement('td')
    const link = document.createElement('a')
    link.className = 'velora-table-link'
    link.href = `${this.ctx.config.profileBase}/breeders/${encodeURIComponent(b.slug)}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    if (b.logo) {
      const thumb = document.createElement('img')
      thumb.className = 'velora-table-thumb'
      thumb.src = imgSrc(b.logo, 'thumb')
      thumb.alt = ''
      thumb.loading = 'lazy'
      link.appendChild(thumb)
    }
    if (b.verified) {
      const mark = document.createElement('span')
      mark.className = 'velora-table-verified'
      mark.textContent = '✓'
      mark.title = this.ctx.t('verified')
      mark.setAttribute('aria-label', this.ctx.t('verified'))
      link.appendChild(mark)
    }
    link.appendChild(document.createTextNode(b.name))
    tdName.appendChild(link)
    tr.appendChild(tdName)

    tr.appendChild(this.createEl('td', undefined, (b.breeds && b.breeds.length > 0) ? b.breeds.join(', ') : '—'))
    const cityRegion = [b.city, b.region].filter(Boolean).join(', ')
    tr.appendChild(this.createEl('td', undefined, cityRegion || '—'))
    tr.appendChild(this.createEl('td', undefined, b.country || '—'))

    return tr
  }

  private buildTable(list: ClubBreeder[]): HTMLElement {
    const wrap = this.createDiv('velora-table-wrap')
    const table = document.createElement('table')
    table.className = 'velora-table'
    table.appendChild(this.buildTableHead())

    const tbody = document.createElement('tbody')
    for (const b of list) {
      tbody.appendChild(this.buildTableRow(b))
    }
    table.appendChild(tbody)
    wrap.appendChild(table)
    return wrap
  }
}
