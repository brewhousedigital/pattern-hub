/**
 * Canonical normalization rule for a tag name. See TAG_REDESIGN_PROJECT_NOTES.md,
 * Phase 0. Every place that stores or compares a tag string must run it
 * through this function first. This stops two admins, or an admin and a
 * public submitter, from creating two different rows for the same tag.
 *
 * This matches the LOWER(TRIM(...)) rule already used by the read-only
 * `tags` view (see the view's SQL in src/functions/database/pb_schema.json).
 * It adds one change: it also collapses internal whitespace to a single
 * space. So "sea  creature" (a double space) and "sea creature" become the
 * same tag. The view does not do this yet. This function is the single
 * source of truth for the canonical rule. Use it for the Phase 1 backfill
 * and every tag entry point after it.
 *
 * A plain Node script cannot import a .ts file from src/ directly. See the
 * copy of this same logic in scripts/audit-duplicate-author-names.mjs. Keep
 * both copies the same if this rule changes.
 */
export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}
