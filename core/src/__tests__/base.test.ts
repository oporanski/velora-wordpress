import { describe, it, expect, beforeEach } from 'vitest'
import { Widget, getAttr } from '../widgets/base'
import type { VeloraConfig } from '../config'

const TEST_CONFIG: VeloraConfig = {
  apiBase: 'https://api.test',
  profileBase: 'https://test.pet',
  apiKey: null,
  locale: 'pl',
  theme: 'light',
  contactProxyUrl: null,
  showCredit: false,
}

// Concrete test subclass — exposes protected methods for direct testing
class TestWidget extends Widget {
  // eslint-disable-next-line @typescript-eslint/require-await
  async mount(): Promise<void> {
    /* no-op */
  }

  testRenderLoading(): void {
    this.renderLoading()
  }

  testRenderError(msg: string, retry?: () => void): void {
    this.renderError(msg, retry)
  }

  testRenderEmpty(): void {
    this.renderEmpty()
  }

  testBuildFooter(): Node {
    return this.buildFooter()
  }

  testCreateEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    return this.createEl(tag, cls, text)
  }

  testCreateDiv(cls: string, init?: (el: HTMLDivElement) => void): HTMLDivElement {
    return this.createDiv(cls, init)
  }
}

describe('Widget base class', () => {
  let root: HTMLElement
  let widget: TestWidget

  beforeEach(() => {
    root = document.createElement('div')
    widget = new TestWidget(root, TEST_CONFIG)
  })

  it('adds velora-w class to root element', () => {
    expect(root.classList.contains('velora-w')).toBe(true)
  })

  it('adds theme class matching resolved theme', () => {
    expect(root.classList.contains('velora-w-light')).toBe(true)
  })

  it('applies dark theme class when theme is dark', () => {
    const darkRoot = document.createElement('div')
    new TestWidget(darkRoot, { ...TEST_CONFIG, theme: 'dark' })
    expect(darkRoot.classList.contains('velora-w-dark')).toBe(true)
  })

  // -----------------------------------------------------------------------
  // renderLoading
  // -----------------------------------------------------------------------

  it('renderLoading outputs aria-busy spinner', () => {
    widget.testRenderLoading()
    expect(root.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(root.querySelector('.velora-spinner')).toBeTruthy()
  })

  it('renderLoading replaces existing root content', () => {
    root.innerHTML = '<section id="old">old content</section>'
    widget.testRenderLoading()
    // Old content must be gone
    expect(root.querySelector('#old')).toBeFalsy()
    // Loading state must be present
    expect(root.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  // -----------------------------------------------------------------------
  // renderError
  // -----------------------------------------------------------------------

  it('renderError outputs role=alert element', () => {
    widget.testRenderError('Test error message')
    expect(root.querySelector('[role="alert"]')).toBeTruthy()
  })

  it('renderError includes detail message', () => {
    widget.testRenderError('Something went wrong')
    expect(root.querySelector('.velora-state-detail')).toBeTruthy()
  })

  it('renderError does not include retry button when no handler', () => {
    widget.testRenderError('Error without retry')
    expect(root.querySelector('.velora-btn-retry')).toBeFalsy()
  })

  it('renderError includes retry button when handler provided', () => {
    widget.testRenderError('Error', () => {})
    expect(root.querySelector('.velora-btn-retry')).toBeTruthy()
  })

  it('renderError retry button calls the handler on click', () => {
    let retried = false
    widget.testRenderError('Error', () => {
      retried = true
    })
    const btn = root.querySelector<HTMLButtonElement>('.velora-btn-retry')
    expect(btn).toBeTruthy()
    btn!.click()
    expect(retried).toBe(true)
  })

  // -----------------------------------------------------------------------
  // renderEmpty
  // -----------------------------------------------------------------------

  it('renderEmpty outputs velora-state-empty element', () => {
    widget.testRenderEmpty()
    expect(root.querySelector('.velora-state-empty')).toBeTruthy()
  })

  it('renderEmpty replaces existing content', () => {
    root.innerHTML = '<section id="old">old</section>'
    widget.testRenderEmpty()
    // Old content must be gone
    expect(root.querySelector('#old')).toBeFalsy()
    // Empty state must be present
    expect(root.querySelector('.velora-state-empty')).toBeTruthy()
  })

  // -----------------------------------------------------------------------
  // buildFooter
  // -----------------------------------------------------------------------

  // WP.org guideline #10 — the credit is opt-in and hidden by default.
  const buildFooterWithCredit = (): HTMLElement => {
    const creditRoot = document.createElement('div')
    const creditWidget = new TestWidget(creditRoot, { ...TEST_CONFIG, showCredit: true })
    return creditWidget.testBuildFooter() as HTMLElement
  }

  it('buildFooter renders nothing when showCredit is false', () => {
    const footer = widget.testBuildFooter()
    expect(footer.nodeType).toBe(Node.DOCUMENT_FRAGMENT_NODE)
    expect(footer.childNodes.length).toBe(0)
  })

  it('appending the default footer leaves no credit link in the DOM', () => {
    root.replaceChildren(document.createElement('section'), widget.testBuildFooter())
    expect(root.querySelector('a')).toBeNull()
    expect(root.querySelector('.velora-footer')).toBeNull()
  })

  it('buildFooter returns a footer element when showCredit is true', () => {
    expect(buildFooterWithCredit().tagName).toBe('FOOTER')
  })

  it('buildFooter contains a link to velora.pet when showCredit is true', () => {
    const link = buildFooterWithCredit().querySelector('a')
    expect(link).toBeTruthy()
    expect(link!.href).toContain('velora.pet')
  })

  it('buildFooter link has rel=noopener noreferrer', () => {
    const link = buildFooterWithCredit().querySelector('a')!
    expect(link.rel).toContain('noopener')
    expect(link.rel).toContain('noreferrer')
  })

  it('buildFooter link opens in new tab', () => {
    const link = buildFooterWithCredit().querySelector('a')!
    expect(link.target).toBe('_blank')
  })

  // -----------------------------------------------------------------------
  // createEl
  // -----------------------------------------------------------------------

  it('createEl creates element with the correct tag', () => {
    const el = widget.testCreateEl('span')
    expect(el.tagName).toBe('SPAN')
  })

  it('createEl sets className when provided', () => {
    const el = widget.testCreateEl('span', 'my-class')
    expect(el.className).toBe('my-class')
  })

  it('createEl sets textContent when provided', () => {
    const el = widget.testCreateEl('span', undefined, 'Hello World')
    expect(el.textContent).toBe('Hello World')
  })

  it('createEl without optional args has empty className and textContent', () => {
    const el = widget.testCreateEl('span')
    expect(el.className).toBe('')
    expect(el.textContent).toBe('')
  })

  // -----------------------------------------------------------------------
  // createDiv
  // -----------------------------------------------------------------------

  it('createDiv creates a div with the given className', () => {
    const div = widget.testCreateDiv('my-div')
    expect(div.tagName).toBe('DIV')
    expect(div.className).toBe('my-div')
  })

  it('createDiv calls init callback when provided', () => {
    let called = false
    widget.testCreateDiv('cls', () => {
      called = true
    })
    expect(called).toBe(true)
  })

  it('createDiv passes the div element to init callback', () => {
    let passedEl: HTMLDivElement | null = null
    const div = widget.testCreateDiv('cls', (el) => {
      passedEl = el
    })
    expect(passedEl).toBe(div)
  })
})

// -----------------------------------------------------------------------
// getAttr helper
// -----------------------------------------------------------------------

describe('getAttr', () => {
  it('returns the attribute value when present', () => {
    const el = document.createElement('div')
    el.setAttribute('data-slug', 'my-cattery')
    expect(getAttr(el, 'data-slug')).toBe('my-cattery')
  })

  it('returns fallback when attribute is absent', () => {
    const el = document.createElement('div')
    expect(getAttr(el, 'data-missing', 'default')).toBe('default')
  })

  it('returns empty string by default when attribute is absent', () => {
    const el = document.createElement('div')
    expect(getAttr(el, 'data-missing')).toBe('')
  })

  it('returns empty string when attribute exists but is empty', () => {
    const el = document.createElement('div')
    el.setAttribute('data-empty', '')
    expect(getAttr(el, 'data-empty', 'fallback')).toBe('')
  })
})
