import type { BreedRef, BreedRelation, ColorRelation } from './api-client'

/**
 * Read a breed name tolerantly across API shapes.
 *
 * The live portal returns `breedRef: { name }`; a future clean-contract version
 * will return a flat `breed` string. The WP plugin deploys independently of the
 * portal backend, so it must accept either — flat string wins when present.
 */
export function breedName(entity: { breed?: string | null; breedRef?: BreedRelation | null }): string {
  // `||` (not `??`) so an empty string falls through to the next source.
  return entity.breed || entity.breedRef?.name || ''
}

/** Read a color name tolerantly (flat `color` string or `colorRef` relation). */
export function colorName(entity: { color?: string | null; colorRef?: ColorRelation | null }): string {
  // English name only — colour names are not translated (see the portal's
  // `colorLabel`); `||` (not `??`) so an empty one falls through to the EMS code.
  return entity.color || entity.colorRef?.nameEn || entity.colorRef?.emsCode || ''
}

/**
 * Normalize breed values to display strings.
 *
 * The backend serves breeds as AnimalBreed relation objects ({ id, name, ... })
 * via Prisma `select`/`include`, even though the widget types historically
 * declared `string[]`. This helper accepts either shape (BreedRef) so every
 * widget can render breeds as plain strings without `[object Object]`.
 *
 * Entries with an empty name are skipped (and logged) rather than silently
 * rendered as blanks — an empty breed name signals a data issue worth surfacing.
 */
export function normalizeBreeds(breeds: BreedRef[]): string[] {
  return breeds.flatMap((br) => {
    const name = typeof br === 'string' ? br : br.name
    if (name === '') {
      console.warn('[velora] breed with empty name skipped', br)
      return []
    }
    return [name]
  })
}
