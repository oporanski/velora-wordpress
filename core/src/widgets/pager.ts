export interface PagerLabels {
  prev: string
  next: string
  page: (n: number) => string
  nav: string
}

export function pageCount(totalItems: number, perPage: number): number {
  if (perPage <= 0 || totalItems === 0) return 1
  return Math.ceil(totalItems / perPage)
}

export function clampPage(page: number, pages: number): number {
  return Math.min(Math.max(page, 1), Math.max(pages, 1))
}

export function pageSlice<T>(items: T[], page: number, perPage: number): T[] {
  if (perPage <= 0) return items
  const start = (page - 1) * perPage
  return items.slice(start, start + perPage)
}

/** Page numbers to show: first, last, a run around `current`, and 'gap' for skipped stretches. */
export function pageWindow(current: number, pages: number, span = 7): (number | 'gap')[] {
  if (pages <= span) return Array.from({ length: pages }, (_, i) => i + 1)
  // Slots for the neighbours of `current`: span minus first, last and the two gaps.
  const inner = Math.max(span - 4, 1)
  let start = Math.max(2, current - Math.floor(inner / 2))
  const end = Math.min(pages - 1, start + inner - 1)
  start = Math.max(2, end - inner + 1)
  const out: (number | 'gap')[] = [1]
  if (start > 2) out.push(start === 3 ? 2 : 'gap')
  for (let n = start; n <= end; n++) out.push(n)
  if (end < pages - 1) out.push(end === pages - 2 ? pages - 1 : 'gap')
  out.push(pages)
  return out
}

function pagerButton(className: string, text: string, ariaLabel: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `velora-pager-btn ${className}`
  btn.textContent = text
  btn.setAttribute('aria-label', ariaLabel)
  return btn
}

export function buildPager(opts: {
  current: number
  pages: number
  labels: PagerLabels
  onGo: (page: number) => void
}): HTMLElement {
  const { current, pages, labels, onGo } = opts
  const nav = document.createElement('nav')
  if (pages <= 1) {
    nav.className = 'velora-pager velora-pager-empty'
    return nav
  }
  nav.className = 'velora-pager'
  nav.setAttribute('aria-label', labels.nav)

  const prev = pagerButton('velora-pager-prev', `‹ ${labels.prev}`, labels.prev)
  prev.disabled = current <= 1
  prev.addEventListener('click', () => onGo(current - 1))
  nav.appendChild(prev)

  for (const item of pageWindow(current, pages)) {
    if (item === 'gap') {
      const gap = document.createElement('span')
      gap.className = 'velora-pager-gap'
      gap.setAttribute('aria-hidden', 'true')
      gap.textContent = '…'
      nav.appendChild(gap)
      continue
    }
    const btn = pagerButton('velora-pager-page', String(item), labels.page(item))
    if (item === current) {
      btn.classList.add('velora-pager-current')
      btn.setAttribute('aria-current', 'page')
      btn.disabled = true
    } else {
      btn.addEventListener('click', () => onGo(item))
    }
    nav.appendChild(btn)
  }

  const next = pagerButton('velora-pager-next', `${labels.next} ›`, labels.next)
  next.disabled = current >= pages
  next.addEventListener('click', () => onGo(current + 1))
  nav.appendChild(next)
  return nav
}
