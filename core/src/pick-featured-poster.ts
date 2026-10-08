import type { VeloraEvent } from './api-client'

/** `yyyy-MM-dd` of a date-only API value (which may carry a time part). */
function toIsoDateOnly(value: string): string {
  return value.slice(0, 10)
}

/** The viewer's calendar day as `yyyy-MM-dd`. */
function todayLocalIsoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * The event whose poster the club widget features above its list: the
 * earliest-starting event that HAS a poster and is not over yet.
 *
 * Mirrors the portal's club page. Dates are compared as `yyyy-MM-dd` strings
 * against the viewer's calendar day — an event that ends today is still
 * upcoming, and a running event (started yesterday, ends tomorrow) qualifies;
 * `endDate` is inclusive. Ties keep the input order. The API's response order
 * is not part of the plugin's contract, so the first element is never assumed
 * to be the nearest.
 */
export function pickFeaturedPoster(
  events: readonly VeloraEvent[],
  now: Date = new Date(),
): VeloraEvent | undefined {
  const today = todayLocalIsoDate(now)
  return events
    .filter((event) => event.imageUrl)
    .filter((event) => toIsoDateOnly(event.endDate ?? event.startDate) >= today)
    .sort((a, b) => {
      // `<`/`>`, not `localeCompare`: these are technical keys, not text a
      // reader sees, and `yyyy-MM-dd` sorts chronologically in every locale.
      const left = toIsoDateOnly(a.startDate)
      const right = toIsoDateOnly(b.startDate)
      if (left === right) return 0
      return left < right ? -1 : 1
    })[0]
}
