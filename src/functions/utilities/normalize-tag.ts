/**
 * Canonical normalization rule for a tag name (Phase 0 of the tag redesign -
 * see TAG_REDESIGN_PROJECT_NOTES.md). Every place that stores or compares a
 * tag string should run it through this function first, so two admins (or
 * an admin and a public submitter) never end up with two different rows for
 * what's meant to be the same tag.
 *
 * This matches the LOWER(TRIM(...)) rule the read-only `tags` view already
 * applies in its own SQL (see the `tags` view's viewQuery in
 * src/functions/database/pb_schema.json), plus one deliberate strengthening:
 * internal whitespace is also collapsed to a single space, so "sea  creature"
 * (double space) and "sea creature" count as the same tag. The view itself
 * doesn't do that yet - this function is the single source of truth for the
 * *canonical* rule going forward, for the Phase 1 backfill and every tag
 * entry point after it.
 *
 * A plain Node script can't import a .ts file from src/ directly - see
 * scripts/audit-duplicate-author-names.mjs's own copy of this same logic.
 * Keep both in sync if this rule ever changes.
 */
export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}
