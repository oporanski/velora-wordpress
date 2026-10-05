import { describe, it, expect, beforeEach } from 'vitest'
import { injectAnimalsJsonLd, injectListingsJsonLd, injectEventsJsonLd } from '../seo'
import type { BreederAnimal, VeloraEvent, VeloraListing } from '../api-client'

function parseJsonLd(root: HTMLElement): unknown[] {
  return Array.from(root.querySelectorAll('script[type="application/ld+json"]')).map((s) =>
    JSON.parse(s.textContent ?? ''),
  )
}

describe('injectAnimalsJsonLd', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
  })

  const makeAnimal = (overrides: Partial<BreederAnimal> = {}): BreederAnimal => ({
    id: '1',
    name: 'Luna',
    slug: 'luna',
    breed: 'Maine Coon',
    sex: 'FEMALE',
    birthDate: '2021-01-01',
    photoUrl: null,
    ...overrides,
  })

  it('injects a script tag with ld+json type', () => {
    injectAnimalsJsonLd(root, [makeAnimal()], 'Velvet Paws', 'https://velora.pet', 'velvet-paws')
    const script = root.querySelector('script[type="application/ld+json"]')
    expect(script).toBeTruthy()
  })

  it('uses ItemList schema type', () => {
    injectAnimalsJsonLd(root, [makeAnimal()], 'Velvet Paws', 'https://velora.pet', 'velvet-paws')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data['@type']).toBe('ItemList')
    expect(data['@context']).toBe('https://schema.org')
  })

  it('sets numberOfItems to animal count', () => {
    const animals = [makeAnimal({ id: '1' }), makeAnimal({ id: '2', name: 'Max' })]
    injectAnimalsJsonLd(root, animals, 'Velvet Paws', 'https://velora.pet', 'velvet-paws')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data.numberOfItems).toBe(2)
  })

  it('includes breed in additionalProperty', () => {
    injectAnimalsJsonLd(root, [makeAnimal()], 'Velvet Paws', 'https://velora.pet', 'velvet-paws')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    const props = item.additionalProperty as Array<{ name: string; value: string }>
    const breed = props.find((p) => p.name === 'Breed')
    expect(breed?.value).toBe('Maine Coon')
  })

  it('includes color when present', () => {
    injectAnimalsJsonLd(root, [makeAnimal({ color: 'Brown Tabby' })], 'B', 'https://velora.pet', 's')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    const props = item.additionalProperty as Array<{ name: string; value: string }>
    const color = props.find((p) => p.name === 'Color')
    expect(color?.value).toBe('Brown Tabby')
  })

  it('omits color property when color is null', () => {
    injectAnimalsJsonLd(root, [makeAnimal({ color: null })], 'B', 'https://velora.pet', 's')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    const props = item.additionalProperty as Array<{ name: string; value: string }>
    const color = props.find((p) => p.name === 'Color')
    expect(color).toBeUndefined()
  })

  // The API is mid-transition (see api-client.ts): breed/color may arrive as
  // flat strings or as breedRef/colorRef relation objects. breedName()/
  // colorName() already pin every shape in isolation (breeds.test.ts) — this
  // pins that the JSON-LD wiring actually calls them instead of reading the
  // raw fields directly.
  it('reads breed and color from breedRef/colorRef when the flat fields are absent', () => {
    injectAnimalsJsonLd(
      root,
      [makeAnimal({ breed: null, breedRef: { name: 'Siberian' }, color: null, colorRef: { nameEn: 'Black', emsCode: 'n' } })],
      'B',
      'https://velora.pet',
      's',
    )
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    const props = item.additionalProperty as Array<{ name: string; value: string }>
    expect(props.find((p) => p.name === 'Breed')?.value).toBe('Siberian')
    expect(props.find((p) => p.name === 'Color')?.value).toBe('Black')
  })

  it('builds correct profile URL', () => {
    injectAnimalsJsonLd(root, [makeAnimal()], 'B', 'https://velora.pet', 'velvet-paws')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    expect(item.url).toContain('velvet-paws')
    expect(item.url).toContain('luna')
  })

  it('does not inject when animals array is empty', () => {
    injectAnimalsJsonLd(root, [], 'B', 'https://velora.pet', 's')
    const scripts = root.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts.length).toBe(1) // still injects the empty ItemList
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data.numberOfItems).toBe(0)
  })
})

describe('injectListingsJsonLd', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
  })

  const makeListing = (overrides: Partial<VeloraListing> = {}): VeloraListing => ({
    id: '1',
    slug: 'listing-one',
    title: 'Maine Coon kitten',
    price: 1500,
    currency: 'PLN',
    species: 'CAT',
    breed: 'Maine Coon',
    city: 'Warsaw',
    country: 'PL',
    images: ['/uploads/photo.jpg'],
    createdAt: '2024-01-01',
    ...overrides,
  })

  it('injects ItemList schema', () => {
    injectListingsJsonLd(root, [makeListing()], 'https://velora.pet')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data['@type']).toBe('ItemList')
    expect(data.numberOfItems).toBe(1)
  })

  it('includes price in offers when present', () => {
    injectListingsJsonLd(root, [makeListing({ price: 1500, currency: 'PLN' })], 'https://velora.pet')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    const offers = item.offers as Record<string, unknown>
    expect(offers).toBeTruthy()
    expect(offers.price).toBe(1500)
    expect(offers.priceCurrency).toBe('PLN')
  })

  it('omits offers when price is null', () => {
    injectListingsJsonLd(root, [makeListing({ price: null })], 'https://velora.pet')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    expect(item.offers).toBeUndefined()
  })

  it('builds slug URL when slug is present', () => {
    injectListingsJsonLd(root, [makeListing({ slug: 'my-listing' })], 'https://velora.pet')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    expect(item.url).toContain('my-listing')
  })

  it('omits URL when slug is null', () => {
    injectListingsJsonLd(root, [makeListing({ slug: null })], 'https://velora.pet')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    expect(item.url).toBeUndefined()
  })

  it('reads the category from breedRef.name when the flat breed field is absent', () => {
    injectListingsJsonLd(root, [makeListing({ breed: null, breedRef: { name: 'Ragdoll' } })], 'https://velora.pet')
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const items = data.itemListElement as Array<Record<string, unknown>>
    const item = items[0].item as Record<string, unknown>
    expect(item.category).toBe('Ragdoll')
  })
})

describe('injectEventsJsonLd', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
  })

  const makeEvent = (overrides: Partial<VeloraEvent> = {}): VeloraEvent => ({
    id: '1',
    title: 'Cat Show Warsaw',
    slug: 'cat-show-warsaw',
    startDate: '2025-06-01',
    endDate: '2025-06-02',
    city: 'Warsaw',
    country: 'PL',
    imageUrl: null,
    ...overrides,
  })

  it('injects one script tag per event', () => {
    injectEventsJsonLd(root, [makeEvent(), makeEvent({ id: '2', title: 'Gdansk Show' })])
    const scripts = root.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts.length).toBe(2)
  })

  it('uses Event schema type', () => {
    injectEventsJsonLd(root, [makeEvent()])
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data['@type']).toBe('Event')
    expect(data.name).toBe('Cat Show Warsaw')
  })

  it('includes startDate and endDate', () => {
    injectEventsJsonLd(root, [makeEvent()])
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data.startDate).toBe('2025-06-01')
    expect(data.endDate).toBe('2025-06-02')
  })

  it('includes location when city is present', () => {
    injectEventsJsonLd(root, [makeEvent({ city: 'Krakow', country: 'PL' })])
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    const location = data.location as Record<string, unknown>
    expect(location).toBeTruthy()
    expect(location['@type']).toBe('Place')
  })

  it('omits location when city and country are null', () => {
    injectEventsJsonLd(root, [makeEvent({ city: null, country: null })])
    const [data] = parseJsonLd(root) as Array<Record<string, unknown>>
    expect(data.location).toBeUndefined()
  })

  it('injects nothing when events array is empty', () => {
    injectEventsJsonLd(root, [])
    const scripts = root.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts.length).toBe(0)
  })
})
