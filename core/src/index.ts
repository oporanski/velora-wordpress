import { resolveConfig } from './config'
import { AboutWidget } from './widgets/about'
import { BreederAnimalsWidget } from './widgets/breeder-animals'
import { BreederContactWidget } from './widgets/breeder-contact'
import { GalleryWidget } from './widgets/gallery'
// NOTE: BreederLittersWidget intentionally removed — litters are private breeder
// data and MUST NOT be exposed via the public embed surface.
import { ClubBreedersWidget } from './widgets/club-breeders'
import { ClubContactWidget } from './widgets/club-contact'
import { ClubDocumentsWidget } from './widgets/club-documents'
import { EventsWidget } from './widgets/events'
import { ListingsWidget } from './widgets/listings'
import { PostsWidget } from './widgets/posts'
import { Widget } from './widgets/base'
import './styles/embed.css'

const VERSION = '0.1.0'

type WidgetCtor = new (root: HTMLElement, config: ReturnType<typeof resolveConfig>) => Widget

const REGISTRY: Record<string, WidgetCtor> = {
  about: AboutWidget,
  'breeder-animals': BreederAnimalsWidget,
  'breeder-contact': BreederContactWidget,
  gallery: GalleryWidget,
  'club-breeders': ClubBreedersWidget,
  'club-contact': ClubContactWidget,
  'club-documents': ClubDocumentsWidget,
  events: EventsWidget,
  listings: ListingsWidget,
  posts: PostsWidget,
}

declare global {
  interface Window {
    VeloraEmbed?: {
      version: string
      widgets: string[]
      mount?: (root: HTMLElement) => void
      mountAll?: () => void
    }
  }
}

function mount(root: HTMLElement): void {
  const type = root.dataset.veloraWidget
  if (!type) return
  const Ctor = REGISTRY[type]
  if (!Ctor) {
    // eslint-disable-next-line no-console
    console.warn(`[velora-embed] unknown widget type: ${type}`)
    return
  }
  if (root.dataset.veloraMounted === '1') return
  root.dataset.veloraMounted = '1'
  // Per-element, not per-page: two Velora plugins on one page each publish
  // their own config global, and a widget must read the one its plugin wrote.
  const config = resolveConfig(root.dataset.veloraConfig)
  const widget = new Ctor(root, config)
  void widget.mount()
}

function mountAll(): void {
  document.querySelectorAll<HTMLElement>('[data-velora-widget]').forEach(mount)
}

globalThis.window.VeloraEmbed = {
  version: VERSION,
  widgets: Object.keys(REGISTRY),
  mount,
  mountAll,
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll)
} else {
  mountAll()
}

// eslint-disable-next-line no-console
console.info(`[velora-embed] v${VERSION} ready — widgets:`, Object.keys(REGISTRY).join(', '))
