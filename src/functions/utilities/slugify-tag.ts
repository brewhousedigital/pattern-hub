/**
 * Turns a normalized tag name into a URL-safe slug for its Definition Page
 * (see TAG_REDESIGN_PROJECT_NOTES.md, Phase 1) - e.g. "eye (flower)" ->
 * "eye-flower". Any run of characters that isn't a-z/0-9 becomes a single
 * hyphen, and leading/trailing hyphens are trimmed.
 *
 * Run normalizeTagName() (normalize-tag.ts) on the tag first - this
 * function doesn't normalize casing/whitespace itself.
 *
 * Callers are responsible for uniqueness: this function alone can't know
 * about other rows in `tags_v2`, so a caller about to write a slug should
 * check it against existing slugs first and disambiguate with a numeric
 * suffix (-2, -3, ...) on collision - see `uniqueSlugFor` in
 * src/routes/space-command/tags.tsx and the equivalent inline logic in
 * scripts/backfill-tags-v2.mjs for two examples of that pattern.
 *
 * A plain Node script can't import this file directly - scripts/backfill-
 * tags-v2.mjs keeps its own copy of this same logic in sync instead.
 */
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
