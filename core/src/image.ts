/**
 * Image variant resolution — mirrors apps/frontend/src/lib/image.ts so embeds
 * follow the same convention as the portal.
 *
 * Velora's upload pipeline stores each image in 4 WebP variants:
 *   /uploads/{hash}-original.webp  (max 2000px, q85)
 *   /uploads/{hash}-lg.webp        (max 1200px, q80)
 *   /uploads/{hash}-md.webp        (max  600px, q75)
 *   /uploads/{hash}-thumb.webp     (max  200px, q70)
 *
 * The API returns the URL WITHOUT extension (e.g. "/uploads/abc123") so the
 * caller picks the variant that matches its render size — saves bandwidth on
 * grids/cards by shipping `md` instead of `lg`.
 *
 * Static assets (/img/cat1.webp) and external URLs are returned unchanged so
 * the same helper can be applied uniformly without conditionals at callsites.
 */

export type ImageVariant = 'original' | 'lg' | 'md' | 'thumb'

const VELORA_CDN_BASE = 'https://images.velora.pet'

export function imgSrc(
  url: string | null | undefined,
  variant: ImageVariant = 'lg',
): string {
  if (!url) return ''
  // blob:/data: URLs are inert — never modify them.
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  // Velora upload references served via the backend proxy (e.g.
  // https://velora.pet/uploads/{hash}) respond with a 302 redirect to
  // images.velora.pet AND include "Cross-Origin-Resource-Policy: same-origin"
  // on the redirect response. That header blocks the browser from following
  // the redirect when the page origin differs from velora.pet (e.g. a club's
  // own WordPress site). Bypass the redirect by resolving the CDN URL
  // directly — images.velora.pet has no CORP restriction.
  // Regex scoped to *.velora.pet to avoid misrouting third-party URLs that
  // happen to contain /uploads/ in their path.
  const uploadMatch = /^https?:\/\/(?:[a-z0-9-]+\.)?velora\.pet\/uploads\/(.+)$/.exec(url)
  if (uploadMatch) {
    const path = uploadMatch[1]
    if (/\.\w{2,5}$/.test(path)) return `${VELORA_CDN_BASE}/${path}`
    return `${VELORA_CDN_BASE}/${path}-${variant}.webp`
  }
  // Has a file extension already — caller knows exactly what they want.
  if (/\.\w{2,5}$/.test(url)) return url
  // Relative extension-less Velora upload reference (/uploads/{hash}) or
  // other absolute URL without extension — append the variant suffix.
  return `${url}-${variant}.webp`
}
