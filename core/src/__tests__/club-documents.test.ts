import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ClubDocumentsWidget } from '../widgets/club-documents'
import type { VeloraConfig } from '../config'
import type { VeloraDocument } from '../api-client'

/**
 * Only global fetch is mocked; everything from the payload to the rendered
 * anchor is the real widget.
 *
 * The reason this file exists is the link. A document's bytes are served by the
 * portal's own download route, which re-checks that the club is still publicly
 * visible on every hit — the API therefore hands the embed that address
 * (`downloadUrl`) and never the storage path the upload wrote. Nothing else
 * covered `renderDoc`, so a link pointed back at an internal `/uploads/…` path
 * would have rendered green.
 *
 * The rest of this file (2026-09-17) fills in what the original single test
 * left dark: the empty state, the network/parse error paths and their retry,
 * category filtering and its heading translation, the description line, and
 * the file-type icon's extension/size formatting — all real branches in
 * `club-documents.ts` that a broken commit could otherwise slip through.
 */

const CONFIG: VeloraConfig = {
  apiBase: 'https://api.test',
  profileBase: 'https://test.pet',
  apiKey: null,
  locale: 'en',
  theme: 'light',
  contactProxyUrl: null,
  showCredit: false,
}

const fetchMock = vi.fn()

function mockDocuments(documents: VeloraDocument[]): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: documents }),
  })
}

function buildDocument(overrides: Partial<VeloraDocument> = {}): VeloraDocument {
  return {
    id: 'doc-1',
    title: 'Statut klubu',
    description: null,
    category: 'ADMINISTRATIVE',
    downloadUrl: 'https://test.pet/api/clubs/c-1/documents/doc-1/download',
    fileName: 'statut.pdf',
    fileSize: 184320,
    mimeType: 'application/pdf',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function mountWidget(
  opts: { club?: string | null; limit?: string } = {},
): Promise<HTMLElement> {
  const { club = 'baltic-feline', limit } = opts
  const root = document.createElement('div')
  if (club !== null) root.setAttribute('data-club', club)
  if (limit !== undefined) root.setAttribute('data-limit', limit)
  document.body.appendChild(root)
  await new ClubDocumentsWidget(root, CONFIG).mount()
  return root
}

function documentLinks(root: HTMLElement): HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a.velora-doc'))
}

function sectionHeadings(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('.velora-doc-section-title')).map((el) => el.textContent ?? '')
}

function extBadge(root: HTMLElement): string | null {
  return root.querySelector('.velora-doc-ext')?.textContent ?? null
}

describe('ClubDocumentsWidget', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockDocuments([])
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an error and skips the request when data-club is missing', async () => {
    const root = await mountWidget({ club: null })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(root.querySelector('.velora-state-error')?.textContent).toContain('data-club')
  })

  it('requests the club documents endpoint with the configured limit', async () => {
    mockDocuments([buildDocument()])
    await mountWidget({ limit: '25' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('/v1/clubs/baltic-feline/documents')
    expect(url).toContain('limit=25')
  })

  it('falls back to the default limit when data-limit is not a number', async () => {
    mockDocuments([buildDocument()])
    await mountWidget({ limit: 'not-a-number' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('limit=100')
  })

  // CAN-GO-RED: point `renderDoc` at any other field and the href changes.
  it('links each document at the gated download address the API returned', async () => {
    mockDocuments([buildDocument()])
    const root = await mountWidget()
    const [link] = documentLinks(root)
    expect(link.getAttribute('href')).toBe(
      'https://test.pet/api/clubs/c-1/documents/doc-1/download',
    )
  })

  // The payload deliberately carries a stray storage path under an old field
  // name: an embed that still reached for it would render that path as the
  // link, which is exactly the regression this asserts against.
  it('never links a raw storage path, even when one rides along in the payload', async () => {
    mockDocuments([
      Object.assign(buildDocument(), { fileUrl: '/uploads/deadbeef' }),
    ])
    const root = await mountWidget()
    for (const link of documentLinks(root)) {
      expect(link.getAttribute('href')).not.toContain('/uploads/')
    }
  })

  it('groups documents under their category heading', async () => {
    mockDocuments([
      buildDocument(),
      buildDocument({ id: 'doc-2', title: 'Regulamin', category: 'REGULATION' }),
    ])
    const root = await mountWidget()
    expect(root.querySelectorAll('.velora-doc-section').length).toBe(2)
    expect(documentLinks(root).length).toBe(2)
  })

  it('renders the empty state when the club has no documents', async () => {
    mockDocuments([])
    const root = await mountWidget()
    expect(root.querySelector('.velora-state-empty')).not.toBeNull()
    expect(root.querySelector('.velora-state-empty')?.textContent).toBe('No documents available')
    expect(documentLinks(root).length).toBe(0)
  })

  it('shows a network error with a retry button that re-fetches the documents', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const root = await mountWidget()
    expect(root.querySelector('.velora-state-error')).not.toBeNull()
    expect(root.querySelector('.velora-state-detail')?.textContent).toBe('Network error: boom')

    mockDocuments([buildDocument()])
    root.querySelector<HTMLButtonElement>('.velora-btn-retry')!.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(root.querySelector('.velora-state-error')).toBeNull()
    expect(documentLinks(root).length).toBe(1)
  })

  // The API client only wraps genuine fetch/network failures in an Error; a
  // response body that fails to parse rejects with whatever the JSON parser
  // throws. The widget still has to show something instead of crashing.
  it('falls back to a generic error message when the failure is not an Error instance', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject('not-an-error-instance'),
    })
    const root = await mountWidget()
    expect(root.querySelector('.velora-state-detail')?.textContent).toBe('Unknown error')
  })

  it('renders the description when the document has one', async () => {
    mockDocuments([buildDocument({ description: 'Ważny dokument klubowy' })])
    const root = await mountWidget()
    expect(root.querySelector('.velora-doc-desc')?.textContent).toBe('Ważny dokument klubowy')
  })

  it('omits the description line when the document has none', async () => {
    mockDocuments([buildDocument({ description: null })])
    const root = await mountWidget()
    expect(root.querySelector('.velora-doc-desc')).toBeNull()
  })

  it('hides the category filter toolbar when every document shares one category', async () => {
    mockDocuments([
      buildDocument({ id: 'doc-1', category: 'ADMINISTRATIVE' }),
      buildDocument({ id: 'doc-2', category: 'ADMINISTRATIVE' }),
    ])
    const root = await mountWidget()
    expect(root.querySelector('.velora-toolbar')).toBeNull()
  })

  it('shows the category filter, sorted, with an "all" option once documents span more than one category', async () => {
    mockDocuments([
      buildDocument({ id: 'doc-1', category: 'FINANCIAL' }),
      buildDocument({ id: 'doc-2', category: 'ADMINISTRATIVE' }),
    ])
    const root = await mountWidget()
    const select = root.querySelector<HTMLSelectElement>('.velora-toolbar-select')
    expect(select).not.toBeNull()
    expect(Array.from(select!.options).map((o) => o.value)).toEqual(['', 'ADMINISTRATIVE', 'FINANCIAL'])
  })

  it('filters to the selected category and marks it selected after re-rendering the toolbar', async () => {
    mockDocuments([
      buildDocument({ id: 'doc-1', category: 'REGULATIONS' }),
      buildDocument({ id: 'doc-2', category: 'FINANCIAL' }),
    ])
    const root = await mountWidget()
    const select = root.querySelector<HTMLSelectElement>('.velora-toolbar-select')!
    select.value = 'FINANCIAL'
    select.dispatchEvent(new Event('change'))

    expect(documentLinks(root).length).toBe(1)
    expect(sectionHeadings(root)).toEqual(['Financial'])

    const rebuiltSelect = root.querySelector<HTMLSelectElement>('.velora-toolbar-select')!
    expect(rebuiltSelect.value).toBe('FINANCIAL')
  })

  it('translates a known category heading and falls back to the raw value for an unknown one', async () => {
    mockDocuments([
      buildDocument({ id: 'doc-1', category: 'REGULATIONS' }),
      buildDocument({ id: 'doc-2', category: 'MISC' }),
    ])
    const root = await mountWidget()
    expect(sectionHeadings(root).sort()).toEqual(['MISC', 'Regulations'])
  })

  it.each<[number, string]>([
    [500, '500 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [184320, '180.0 KB'],
    [1024 * 1024, '1.0 MB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats a %i-byte file as %s', async (fileSize, expected) => {
    mockDocuments([buildDocument({ fileSize })])
    const root = await mountWidget()
    expect(root.querySelector('.velora-doc-info')?.textContent).toContain(expected)
  })

  // extensionFor() first tries the filename's own extension, then falls back
  // to the MIME type; extColor() then picks the badge colour per type. Each row
  // drives a different branch of one or the other, and the badge text and its
  // colour are the only visible sign either ran correctly.
  it.each<[string, string, string, string]>([
    ['statute', 'application/pdf', 'PDF', '#dc2626'],
    ['agreement', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX', '#2563eb'],
    ['charter', 'application/vnd.oasis.opendocument.text', 'ODT', '#7c3aed'],
    ['budget', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'XLSX', '#16a34a'],
    ['photo', 'image/jpeg', 'JPG', '#0891b2'],
    ['photo', 'image/png', 'PNG', '#0891b2'],
    ['archive', 'application/zip', 'ZIP', '#a16207'],
    ['contract.doc', 'application/msword', 'DOC', '#2563eb'],
    ['sheet.xls', 'application/vnd.ms-excel', 'XLS', '#16a34a'],
    ['photo.webp', 'image/webp', 'WEBP', '#0891b2'],
    ['notes.txt', 'text/plain', 'TXT', '#6b7280'],
  ])('shows "%s" (%s) with a %s badge coloured %s', async (fileName, mimeType, expected, colour) => {
    mockDocuments([buildDocument({ fileName, mimeType })])
    const root = await mountWidget()
    expect(extBadge(root)).toBe(expected)
    const badge = root.querySelector<HTMLElement>('.velora-doc-ext')!
    expect(badge.style.getPropertyValue('--velora-doc-ext-color')).toBe(colour)
  })

  it('renders no extension badge when neither the filename nor the MIME type identify a type', async () => {
    mockDocuments([buildDocument({ fileName: 'mystery', mimeType: 'application/octet-stream' })])
    const root = await mountWidget()
    expect(extBadge(root)).toBeNull()
  })
})
