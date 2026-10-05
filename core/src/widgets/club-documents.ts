import { Widget, getAttr } from './base'
import type { VeloraDocument } from '../api-client'

interface State {
  category: string
}

export class ClubDocumentsWidget extends Widget {
  private all: VeloraDocument[] = []
  private state!: State
  private categoryOptions: string[] = []

  async mount(): Promise<void> {
    const slug = getAttr(this.ctx.root, 'data-club')
    const limit = Number(getAttr(this.ctx.root, 'data-limit', '100')) || 100

    if (!slug) {
      this.renderError('Missing data-club attribute')
      return
    }

    this.renderLoading()
    try {
      this.all = await this.ctx.api.getClubDocuments(slug, limit)
      if (this.all.length === 0) {
        this.renderEmpty()
        return
      }
      this.categoryOptions = Array.from(new Set(this.all.map((d) => d.category))).sort((a, b) => a.localeCompare(b))
      this.state = { category: '' }
      this.render()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      this.renderError(message, () => this.mount())
    }
  }

  protected renderEmpty(): void {
    this.ctx.root.replaceChildren(
      this.createDiv('velora-state velora-state-empty', (el) => {
        el.appendChild(this.createEl('p', undefined, this.ctx.t('documentsNone')))
      }),
    )
  }

  private render(): void {
    const filtered = this.state.category
      ? this.all.filter((d) => d.category === this.state.category)
      : this.all

    const wrap = document.createElement('div')
    if (this.categoryOptions.length > 1) {
      wrap.appendChild(this.buildToolbar())
    }

    const grouped = this.groupByCategory(filtered)
    for (const [category, docs] of grouped.entries()) {
      const section = document.createElement('section')
      section.className = 'velora-doc-section'
      section.appendChild(this.createEl('h3', 'velora-doc-section-title', this.categoryLabel(category)))
      const list = this.createDiv('velora-doc-list')
      for (const doc of docs) list.appendChild(this.renderDoc(doc))
      section.appendChild(list)
      wrap.appendChild(section)
    }

    this.ctx.root.replaceChildren(wrap, this.buildFooter())
  }

  private buildToolbar(): HTMLElement {
    const t = this.ctx.t
    const toolbar = this.createDiv('velora-toolbar')
    const group = this.createDiv('velora-toolbar-group')
    group.appendChild(this.createEl('label', 'velora-toolbar-label', t('filterCategory')))
    const select = document.createElement('select')
    select.className = 'velora-toolbar-select'
    const optAll = document.createElement('option')
    optAll.value = ''
    optAll.textContent = t('filterAll')
    select.appendChild(optAll)
    for (const cat of this.categoryOptions) {
      const opt = document.createElement('option')
      opt.value = cat
      opt.textContent = this.categoryLabel(cat)
      if (cat === this.state.category) opt.selected = true
      select.appendChild(opt)
    }
    select.addEventListener('change', () => { this.state.category = select.value; this.render() })
    group.appendChild(select)
    toolbar.appendChild(group)
    return toolbar
  }

  private categoryLabel(cat: string): string {
    const key = `cat_${cat}`
    const translated = this.ctx.t(key)
    return translated === key ? cat : translated
  }

  private groupByCategory(docs: VeloraDocument[]): Map<string, VeloraDocument[]> {
    const map = new Map<string, VeloraDocument[]>()
    for (const d of docs) {
      const list = map.get(d.category) ?? []
      list.push(d)
      map.set(d.category, list)
    }
    return map
  }

  private renderDoc(doc: VeloraDocument): HTMLElement {
    const a = document.createElement('a')
    a.className = 'velora-doc'
    a.href = doc.downloadUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.title = doc.fileName

    a.appendChild(buildDocIcon(doc.fileName, doc.mimeType))

    const meta = this.createDiv('velora-doc-meta')
    meta.appendChild(this.createEl('div', 'velora-doc-title', doc.title))
    if (doc.description) {
      meta.appendChild(this.createEl('div', 'velora-doc-desc', doc.description))
    }
    meta.appendChild(this.createEl('div', 'velora-doc-info',
      `${doc.fileName} · ${formatBytes(doc.fileSize)}`))
    a.appendChild(meta)

    const dl = this.createDiv('velora-doc-download')
    dl.textContent = '⬇ ' + this.ctx.t('documentDownload')
    a.appendChild(dl)

    return a
  }
}

/**
 * Build a clean document icon: SVG document shape + extension badge.
 * Replaces emoji icons (which are inconsistent across OSes / themes).
 */
function buildDocIcon(fileName: string, mime: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'velora-doc-icon'

  // SVG: rounded-corner page with folded top-right corner.
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 32 40')
  svg.setAttribute('width', '36')
  svg.setAttribute('height', '44')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')

  const page = document.createElementNS(NS, 'path')
  page.setAttribute('d', 'M4 2 A2 2 0 0 1 6 0 H22 L30 8 V36 A2 2 0 0 1 28 38 H6 A2 2 0 0 1 4 36 Z')
  page.setAttribute('fill', 'currentColor')
  page.setAttribute('opacity', '0.08')
  page.setAttribute('stroke', 'currentColor')
  page.setAttribute('stroke-width', '1.5')
  svg.appendChild(page)

  const fold = document.createElementNS(NS, 'path')
  fold.setAttribute('d', 'M22 0 V8 H30')
  fold.setAttribute('fill', 'none')
  fold.setAttribute('stroke', 'currentColor')
  fold.setAttribute('stroke-width', '1.5')
  fold.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(fold)

  wrap.appendChild(svg)

  // Extension badge (PDF / DOCX / ODT / etc.)
  const ext = extensionFor(fileName, mime)
  if (ext) {
    const badge = document.createElement('span')
    badge.className = 'velora-doc-ext'
    badge.textContent = ext
    badge.style.setProperty('--velora-doc-ext-color', extColor(ext))
    wrap.appendChild(badge)
  }

  return wrap
}

function extensionFor(fileName: string, mime: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName)
  if (m) return m[1].toUpperCase()
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('word')) return 'DOCX'
  if (mime.includes('opendocument.text')) return 'ODT'
  if (mime.includes('sheet') || mime.includes('excel')) return 'XLSX'
  if (mime.includes('image/jpeg')) return 'JPG'
  if (mime.includes('image/png')) return 'PNG'
  if (mime.includes('zip')) return 'ZIP'
  return ''
}

function extColor(ext: string): string {
  // Subtle color cues per file type (still readable in any theme via opacity blend).
  switch (ext) {
    case 'PDF':  return '#dc2626'
    case 'DOCX':
    case 'DOC':  return '#2563eb'
    case 'ODT':  return '#7c3aed'
    case 'XLSX':
    case 'XLS':  return '#16a34a'
    case 'JPG':
    case 'PNG':
    case 'WEBP': return '#0891b2'
    case 'ZIP':  return '#a16207'
    default:     return '#6b7280'
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
