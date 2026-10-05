import { Widget, getAttr } from './base'
import type { VeloraEvent } from '../api-client'
import { injectEventsJsonLd } from '../seo'
import { imgSrc } from '../image'

type WhenFilter = 'upcoming' | 'past' | 'all'

interface State {
  when: WhenFilter
}

/**
 * Events widget — shared between breeder and club via data-source.
 *
 * Usage:
 *   <div data-velora-widget="events"
 *        data-source="breeders"
 *        data-slug="..."
 *        data-when="upcoming|past|all"
 *        data-show-filter="true|false"></div>
 */
export class EventsWidget extends Widget {
  private source!: 'breeders' | 'clubs'
  private slug!: string
  private limit!: number
  private state!: State
  private showFilter!: boolean

  async mount(): Promise<void> {
    this.source = getAttr(this.ctx.root, 'data-source') as 'breeders' | 'clubs'
    this.slug = getAttr(this.ctx.root, 'data-slug')
    this.limit = Number(getAttr(this.ctx.root, 'data-limit', '12')) || 12
    const when = (getAttr(this.ctx.root, 'data-when', 'upcoming') as WhenFilter)
    this.state = { when: ['upcoming', 'past', 'all'].includes(when) ? when : 'upcoming' }
    this.showFilter = getAttr(this.ctx.root, 'data-show-filter', 'true') !== 'false'

    if (!this.slug || (this.source !== 'breeders' && this.source !== 'clubs')) {
      this.renderError('Required: data-source="breeders|clubs" + data-slug="..."')
      return
    }

    await this.load()
  }

  private async load(): Promise<void> {
    this.renderLoading()
    try {
      const events = await this.ctx.api.getEvents(this.source, this.slug, this.limit, this.state.when)
      this.render(events)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.load())
    }
  }

  private render(events: VeloraEvent[]): void {
    const wrap = document.createElement('div')
    if (this.showFilter) wrap.appendChild(this.buildFilter())

    if (events.length === 0) {
      const empty = this.createDiv('velora-state velora-state-empty')
      empty.appendChild(this.createEl('p', undefined, this.ctx.t(
        this.state.when === 'past' ? 'eventNoPast' : 'eventNoUpcoming',
      )))
      wrap.appendChild(empty)
    } else {
      const grid = this.createDiv('velora-grid velora-grid-events')
      for (const event of events) grid.appendChild(this.renderCard(event))
      wrap.appendChild(grid)
    }

    this.ctx.root.replaceChildren(wrap, this.buildFooter())
    if (events.length > 0) injectEventsJsonLd(this.ctx.root, events)
  }

  private buildFilter(): HTMLElement {
    const t = this.ctx.t
    const toolbar = this.createDiv('velora-toolbar')
    const layout = this.createDiv('velora-toolbar-layout')

    const mkBtn = (when: WhenFilter, label: string): HTMLButtonElement => {
      const btn = this.createEl('button', undefined, label)
      btn.type = 'button'
      btn.setAttribute('aria-pressed', String(this.state.when === when))
      btn.addEventListener('click', () => {
        if (this.state.when === when) return
        this.state.when = when
        void this.load()
      })
      return btn
    }

    layout.appendChild(mkBtn('upcoming', t('whenUpcoming')))
    layout.appendChild(mkBtn('past', t('whenPast')))
    layout.appendChild(mkBtn('all', t('whenAll')))
    toolbar.appendChild(layout)
    return toolbar
  }

  private renderCard(event: VeloraEvent): HTMLElement {
    const card = document.createElement('a')
    card.className = 'velora-card velora-card-event'
    if (event.slug) {
      card.href = `${this.ctx.config.profileBase}/events/${encodeURIComponent(event.slug)}`
      card.target = '_blank'
      card.rel = 'noopener noreferrer'
      card.title = this.ctx.t('viewProfile')
    }

    if (event.imageUrl) {
      const img = document.createElement('img')
      img.className = 'velora-card-img'
      img.src = imgSrc(event.imageUrl, 'md')
      img.alt = event.title
      img.loading = 'lazy'
      card.appendChild(img)
    } else {
      const placeholder = this.createDiv('velora-card-img velora-card-img-placeholder')
      placeholder.textContent = '📅'
      card.appendChild(placeholder)
    }

    const body = this.createDiv('velora-card-body')
    body.appendChild(this.createEl('h3', 'velora-card-title', event.title))

    const dateLabel = formatDateRange(event.startDate, event.endDate, this.ctx.config.locale)
    if (dateLabel) {
      body.appendChild(this.createEl('p', 'velora-card-event-date', `📅 ${dateLabel}`))
    }

    const location = [event.city, event.country].filter(Boolean).join(', ')
    if (location) {
      body.appendChild(this.createEl('p', 'velora-card-event-location', `📍 ${location}`))
    }

    card.appendChild(body)
    return card
  }
}

function formatDateRange(start: string, end: string | null, locale: string): string {
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return ''
  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const startStr = startDate.toLocaleDateString(locale, fmt)
  if (!end) return startStr
  const endDate = new Date(end)
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() === startDate.getTime()) return startStr
  return `${startStr} – ${endDate.toLocaleDateString(locale, fmt)}`
}
