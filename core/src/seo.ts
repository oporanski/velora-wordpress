/**
 * Schema.org JSON-LD injection helpers for embed widgets.
 *
 * Why this lives in the embed (not the Velora portal): structured data
 * benefits the host page where it's rendered. A breeder embedding the
 * animals widget on royal-whiskers.pl wants Google to associate the
 * Pet/Product schema with *their* domain — rich snippets in search
 * results then drive traffic to royal-whiskers.pl directly. JSON-LD
 * injected only on velora.pet would credit the wrong domain.
 *
 * Each helper appends a single <script type="application/ld+json"> to
 * the widget root. Scripts are scoped to the widget so multiple embeds
 * on one page each get their own block (Google de-duplicates by content).
 */

import type { BreederAnimal, VeloraEvent, VeloraListing } from './api-client'
import { breedName, colorName } from './breeds'

export function injectAnimalsJsonLd(
  root: HTMLElement,
  animals: BreederAnimal[],
  breederName: string,
  profileBase: string,
  breederSlug: string,
): void {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${breederName} — animals`,
    numberOfItems: animals.length,
    itemListElement: animals.map((a, i) => {
      const color = colorName(a)
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Pet',
          name: a.name,
          image: a.photoUrl ?? undefined,
          url: `${profileBase}/breeders/${encodeURIComponent(breederSlug)}/animals/${encodeURIComponent(a.slug)}`,
          // additionalProperty surfaces breed/sex/color in rich-result preview.
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'Breed', value: breedName(a) },
            { '@type': 'PropertyValue', name: 'Sex', value: a.sex === 'MALE' ? 'Male' : 'Female' },
            ...(color ? [{ '@type': 'PropertyValue', name: 'Color', value: color }] : []),
          ],
        },
      }
    }),
  }
  appendJsonLd(root, itemList)
}

export function injectListingsJsonLd(
  root: HTMLElement,
  listings: VeloraListing[],
  profileBase: string,
): void {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: listings.length,
    itemListElement: listings.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: l.title,
        image: l.images && l.images.length > 0 ? l.images[0] : undefined,
        url: l.slug ? `${profileBase}/marketplace/${encodeURIComponent(l.slug)}` : undefined,
        category: breedName(l) || undefined,
        offers: l.price ? {
          '@type': 'Offer',
          price: l.price,
          priceCurrency: l.currency || 'PLN',
          availability: 'https://schema.org/InStock',
        } : undefined,
      },
    })),
  }
  appendJsonLd(root, itemList)
}

export function injectEventsJsonLd(
  root: HTMLElement,
  events: VeloraEvent[],
): void {
  // Each event is its own top-level Event schema (Google prefers this for
  // event rich results over wrapping in ItemList).
  for (const e of events) {
    const event = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: e.title,
      startDate: e.startDate,
      endDate: e.endDate ?? undefined,
      image: e.imageUrl ?? undefined,
      location: (e.city || e.country) ? {
        '@type': 'Place',
        name: [e.city, e.country].filter(Boolean).join(', '),
        address: {
          '@type': 'PostalAddress',
          addressLocality: e.city ?? undefined,
          addressCountry: e.country ?? undefined,
        },
      } : undefined,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    }
    appendJsonLd(root, event)
  }
}

function appendJsonLd(root: HTMLElement, payload: unknown): void {
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  // JSON.stringify with no spacing — keeps payload small. Strip undefined
  // properties so output validates against Google's parser.
  script.textContent = JSON.stringify(payload, (_k, v) => v === undefined ? undefined : v)
  root.appendChild(script)
}
