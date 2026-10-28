/**
 * The API serves content in one language version chosen per request. Base
 * fields hold the author's original; the version picked for the reader (the
 * site's language, else English, else the original) arrives under `localized`
 * (same field names, plus `language`) next to `availableLanguages`, which lists
 * every version that exists. Profiles carry one such pair per group of fields:
 * `localizedGroups.profile`.
 */
type VersionedFields<T> = Omit<T, 'localized' | 'localizedGroups' | 'availableLanguages'>

/** A version holds null for a field it has no text for. */
export type LocalizedVersion<T> = { [K in keyof VersionedFields<T>]?: VersionedFields<T>[K] | null } & {
  /** ISO 639-1 code of the version shown; null when the original was chosen. */
  language: string | null
}

export interface LocalizedContract<T> {
  localized?: LocalizedVersion<T>
  availableLanguages?: string[]
}

/** A field's text together with the language that text is actually in. */
export interface PickedText<V> {
  text: V
  /** Set only when `text` came from the selected version, not the original. */
  lang: string | null
}

/**
 * Field of the selected language version, falling back to the original. `lang`
 * is reported only for text that really came from the version: a version that
 * lacks this field (null) leaves the original on screen, so it carries no `lang`.
 *
 * @param contract where the version lives; the item itself unless the field
 *   sits in a group (`profile.localizedGroups?.profile`).
 */
export function pickText<T extends object, K extends keyof T>(
  item: T,
  key: K,
  contract: LocalizedContract<T> | undefined = item as LocalizedContract<T>,
): PickedText<T[K]> {
  const version = contract?.localized
  const own = version?.[key as keyof typeof version] as T[K] | null | undefined
  if (own === null || own === undefined) return { text: item[key], lang: null }
  return { text: own, lang: version?.language ?? null }
}

/** Marks an element with the language of the text it shows, when known. */
export function setLang(el: HTMLElement, lang: string | null): void {
  if (lang) el.lang = lang
}
