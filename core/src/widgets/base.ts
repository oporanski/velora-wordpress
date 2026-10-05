import type { VeloraConfig } from '../config'
import { resolveTheme } from '../config'
import { ApiClient } from '../api-client'
import { translator } from '../i18n'

export interface WidgetContext {
  root: HTMLElement
  config: VeloraConfig
  api: ApiClient
  t: (key: string) => string
  theme: 'light' | 'dark'
}

export abstract class Widget {
  protected readonly ctx: WidgetContext

  constructor(root: HTMLElement, config: VeloraConfig) {
    const theme = resolveTheme(config.theme)
    root.classList.add('velora-w', `velora-w-${theme}`)
    this.ctx = {
      root,
      config,
      api: new ApiClient(config),
      t: translator(config.locale),
      theme,
    }
  }

  abstract mount(): Promise<void> | void

  protected renderLoading(): void {
    this.ctx.root.replaceChildren(
      this.createDiv('velora-state velora-state-loading', (el) => {
        el.setAttribute('aria-busy', 'true')
        el.appendChild(this.createDiv('velora-spinner'))
        el.appendChild(this.createEl('p', undefined, this.ctx.t('loading')))
      }),
    )
  }

  protected renderError(message: string, retry?: () => void): void {
    this.ctx.root.replaceChildren(
      this.createDiv('velora-state velora-state-error', (el) => {
        el.setAttribute('role', 'alert')
        el.appendChild(this.createEl('p', undefined, this.ctx.t('error')))
        el.appendChild(this.createEl('p', 'velora-state-detail', message))
        if (retry) {
          const btn = this.createEl('button', 'velora-btn velora-btn-retry', this.ctx.t('retry'))
          btn.setAttribute('type', 'button')
          btn.addEventListener('click', retry)
          el.appendChild(btn)
        }
      }),
    )
  }

  protected renderEmpty(): void {
    this.ctx.root.replaceChildren(
      this.createDiv('velora-state velora-state-empty', (el) => {
        el.appendChild(this.createEl('p', undefined, this.ctx.t('empty')))
      }),
    )
  }

  /**
   * "Powered by Velora" credit. Opt-in: returns an empty DocumentFragment
   * when the site owner has not enabled it, so callers can keep passing the
   * result to replaceChildren() unconditionally and nothing gets rendered.
   */
  protected buildFooter(): Node {
    if (!this.ctx.config.showCredit) return document.createDocumentFragment()

    const footer = document.createElement('footer')
    footer.className = 'velora-footer'
    const link = document.createElement('a')
    link.href = 'https://velora.pet/'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = this.ctx.t('poweredBy')
    footer.appendChild(link)
    return footer
  }

  protected createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    textContent?: string,
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag)
    if (className) el.className = className
    if (textContent !== undefined) el.textContent = textContent
    return el
  }

  protected createDiv(className: string, init?: (el: HTMLDivElement) => void): HTMLDivElement {
    const div = document.createElement('div')
    div.className = className
    if (init) init(div)
    return div
  }
}

export function getAttr(el: HTMLElement, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback
}
