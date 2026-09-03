// Backfills every tags_v2 relation field (tag_refs, tag_ref,
// implies_tag_ref, target_tag_ref) for every row the live save paths'
// dual-write never touched, and re-derives every row it did touch too (see
// "Always re-derive" below).
//
// Populates, for every row in each collection:
//   patterns.tag_refs                  <- resolved from patterns.tags
//   implied_tags.tag_ref               <- resolved from implied_tags.tag
//   implied_tags.implies_tag_ref       <- resolved from implied_tags.implies_tag
//   tag_aliases.target_tag_ref         <- resolved from tag_aliases.target_tag
//
// One resolution rule, used for all four: match the first tags_v2 row with
// this name, regardless of type, creating a General-type one only if none
// exists at all - mirrors resolveOrCreateTagV2Row in
// src/functions/database/tags.ts (also used by resolveOrCreateTagRefs, the
// live pattern-save resolver, and by ImpliedTagsDialog/AliasDialog in
// space-command/tags.tsx). An earlier version of this script (and of
// resolveOrCreateTagRefs itself) scoped patterns.tag_refs to General-type
// rows only, reasoning that a bare typed string should never accidentally
// resolve to an unrelated Author-typed row of the same name. That
// reasoning is sound for a name typed fresh into an entry field, but wrong
// applied to every name already sitting in patterns.tags - including a
// name the author-cascade mechanism (scripts/backfill-author-tags.mjs,
// /api/sync-author-tags) already resolved to a specific Author-typed row
// before it ever reached patterns.tags. General-only resolution there
// created a redundant, disconnected General-type row for every such name
// instead of reusing the one already linked to that author - caught via
// this script's own first live dry run, which reported ~136 such rows.
// Matching resolveOrCreateTagV2Row's type-blind rule everywhere fixes it,
// and matches how every other tags_v2 consumer in this codebase has always
// resolved a tag name, from back when tags_v2.tag was still globally
// unique and type-blind was the only kind of lookup that could exist.
//
// Always re-derive, not "fill in what's missing": every ref field this
// script writes is computed fresh from its corresponding string field on
// every run, and OVERWRITES whatever the ref field currently holds, rather
// than only filling empty ones in. This is deliberate, not an
// inefficiency - patterns.tags/implied_tags.tag/implies_tag/
// tag_aliases.target_tag are the fields this backfill trusts as canonical
// when deriving a ref field. Computing fresh every time, rather than only
// filling in a blank ref field, is what keeps this script a reliable
// reconciliation pass - safe to re-run at any point, and correct even for
// a row an earlier run (or the live save path's own dual-write) already
// touched. A row whose derived value already matches what is stored is
// skipped - that only costs an extra read, never a wasted write.
//
// This does NOT touch patterns.tags, implied_tags.tag/implies_tag, or
// tag_aliases.alias/target_tag - those stay exactly as they are. alias
// itself never gets a ref field at all, on any pass, since an alias like
// "orca" is allowed to have no tags_v2 row of its own.
//
// This makes writes. By default it's a DRY RUN - it prints exactly what it
// would do, without writing anything. Pass --apply to actually write.
// Safe to re-run: anything already correct is skipped.
//
// Usage:
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/backfill-tag-refs.mjs            # dry run (default)
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/backfill-tag-refs.mjs --apply    # actually writes
//
// PowerShell:
//   $env:PB_ADMIN_EMAIL = "you@example.com"
//   $env:PB_ADMIN_PASSWORD = "your-password"
//   npm run backfill:tag-refs              # dry run
//   npm run backfill:tag-refs -- --apply   # apply
//
// PB_URL defaults to the production instance; override it to point at
// staging instead. Credentials are read from the environment only - do not
// hardcode them here, and do not add them to a committed file.

import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'https://stained-glass.pockethost.io';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const APPLY = process.argv.includes('--apply');
// Small metadata rows (tags_v2) - matches the delay
// scripts/backfill-author-tags.mjs already uses for the same kind of row.
const DELAY_MS_LIGHT = 200;
// patterns/implied_tags/tag_aliases writes - patterns especially are much
// heavier records, the same reasoning scripts/backfill-author-tags.mjs
// already documents for this pacing.
const DELAY_MS_RECORD = 400;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in the environment before running this script.\n' +
      'Example:\n' +
      '  PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password node scripts/backfill-tag-refs.mjs',
  );
  process.exit(1);
}

// Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
// This plain script can't import a .ts file from src/ directly - keep this
// copy in sync if the canonical rule ever changes. (Also duplicated in
// scripts/backfill-author-tags.mjs and others, for the same reason.)
function normalizeTagName(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Mirrors slugifyTag() in src/functions/utilities/slugify-tag.ts.
function slugify(tag) {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// True when two arrays hold the same ids, ignoring order and duplicates -
// patterns.tag_refs is a relation (a set), not an ordered list, so this is
// the right equality check for "does this row already have the right
// value," not a positional array comparison. Compares set sizes, not array
// lengths, so a stray duplicate in the stored value (however it might have
// gotten there) can't produce a false "already equal."
function sameIdSet(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const x of setA) if (!setB.has(x)) return false;
  return true;
}

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection('admins').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  // No filter on patterns - every pattern gets tag_refs derived, including
  // a draft or a soft-deleted one, the same way resolveOrCreateTagRefs
  // itself doesn't discriminate by status at save time.
  const [patterns, impliedTags, tagAliases, existingTags] = await Promise.all([
    pb.collection('patterns').getFullList({ fields: 'id,name,tags,tag_refs' }),
    pb.collection('implied_tags').getFullList({ fields: 'id,tag,implies_tag,tag_ref,implies_tag_ref' }),
    pb.collection('tag_aliases').getFullList({ fields: 'id,alias,target_tag,target_tag_ref' }),
    pb.collection('tags_v2').getFullList({ fields: 'id,tag,slug,type' }),
  ]);

  const usedSlugs = new Set(existingTags.map((r) => r.slug));
  // First real row matching a name, regardless of type - mirrors
  // resolveOrCreateTagV2Row/findTagV2Record's own type-blind lookup, used
  // uniformly for all four ref fields (see the header comment).
  const byNorm = new Map();
  for (const r of existingTags) {
    if (!byNorm.has(r.tag)) byNorm.set(r.tag, r);
  }

  // Rows this run needs to create, keyed by norm.
  const toCreate = new Map(); // norm -> { norm, slug }
  const placeholderIdFor = (norm) => `<new:${norm}>`;

  // Resolves `name`, planning a creation if nothing already matches.
  // Returns a real id when one already exists; otherwise a stable
  // placeholder id, so two references to the same not-yet-existing name
  // within this run resolve to the same planned row instead of duplicate
  // creates, and so a dry-run report can still show "resolves to a tag
  // this run would create" without a real id yet.
  function resolve(name) {
    const norm = normalizeTagName(name);
    if (!norm) return null;
    const existing = byNorm.get(norm);
    if (existing) return existing.id;

    if (!toCreate.has(norm)) {
      const baseSlug = slugify(norm) || 'tag';
      let candidate = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(candidate)) candidate = baseSlug + '-' + suffix++;
      usedSlugs.add(candidate);
      toCreate.set(norm, { norm, slug: candidate });
    }
    return placeholderIdFor(norm);
  }

  // ─── Plan: patterns.tag_refs ─────────────────────────────────────────
  const patternPlans = [];
  for (const p of patterns) {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const derivedIds = [...new Set(tags.map((t) => resolve(t)).filter(Boolean))];
    const currentRefs = Array.isArray(p.tag_refs) ? p.tag_refs : [];
    if (sameIdSet(derivedIds, currentRefs)) continue;
    patternPlans.push({ id: p.id, name: p.name, derivedIds });
  }

  // ─── Plan: implied_tags.tag_ref / implies_tag_ref ────────────────────
  const impliedPlans = [];
  for (const e of impliedTags) {
    const tagRefId = resolve(e.tag);
    const impliesTagRefId = resolve(e.implies_tag);
    const tagChanged = tagRefId !== null && tagRefId !== (e.tag_ref || '');
    const impliesChanged = impliesTagRefId !== null && impliesTagRefId !== (e.implies_tag_ref || '');
    if (!tagChanged && !impliesChanged) continue;
    impliedPlans.push({
      id: e.id,
      tag: e.tag,
      implies_tag: e.implies_tag,
      tagRefId: tagChanged ? tagRefId : null,
      impliesTagRefId: impliesChanged ? impliesTagRefId : null,
    });
  }

  // ─── Plan: tag_aliases.target_tag_ref ────────────────────────────────
  const aliasPlans = [];
  for (const a of tagAliases) {
    const targetRefId = resolve(a.target_tag);
    if (targetRefId === null || targetRefId === (a.target_tag_ref || '')) continue;
    aliasPlans.push({ id: a.id, alias: a.alias, target_tag: a.target_tag, targetRefId });
  }

  // ─── Report ───────────────────────────────────────────────────────────
  console.log('=== tag_refs backfill ===');
  console.log(
    APPLY
      ? 'Mode: APPLY - this will create and update records.'
      : 'Mode: DRY RUN - nothing will be written. Pass --apply to write these changes.',
  );
  console.log();

  const toCreateList = [...toCreate.entries()];
  // Every entry here is a name with no tags_v2 row under any type yet -
  // resolve() only plans a creation once byNorm (built from every existing
  // row, any type) has already missed. A name that exists under some other
  // type resolves straight to that row instead, with nothing to create.
  console.log(`tags_v2 rows to create (all General-type): ${toCreateList.length}`);
  for (const [, plan] of toCreateList.slice(0, 20)) {
    console.log(`    would create  tag="${plan.norm}"  slug="${plan.slug}"`);
  }
  if (toCreateList.length > 20) console.log(`    ... and ${toCreateList.length - 20} more`);
  console.log();

  console.log(`patterns.tag_refs to update: ${patternPlans.length} of ${patterns.length} total`);
  if (!APPLY) {
    for (const p of patternPlans.slice(0, 20)) {
      console.log(`    would set  ${p.derivedIds.length} ref(s)  on pattern "${p.name}" (${p.id})`);
    }
    if (patternPlans.length > 20) console.log(`    ... and ${patternPlans.length - 20} more`);
  }
  console.log();

  console.log(`implied_tags refs to update: ${impliedPlans.length} of ${impliedTags.length} total`);
  if (!APPLY) {
    for (const e of impliedPlans.slice(0, 20)) {
      console.log(`    would resolve  "${e.tag}" implies "${e.implies_tag}"  (${e.id})`);
    }
    if (impliedPlans.length > 20) console.log(`    ... and ${impliedPlans.length - 20} more`);
  }
  console.log();

  console.log(`tag_aliases refs to update: ${aliasPlans.length} of ${tagAliases.length} total`);
  if (!APPLY) {
    for (const a of aliasPlans.slice(0, 20)) {
      console.log(`    would resolve  "${a.alias}" -> "${a.target_tag}"  (${a.id})`);
    }
    if (aliasPlans.length > 20) console.log(`    ... and ${aliasPlans.length - 20} more`);
  }
  console.log();

  if (toCreateList.length === 0 && patternPlans.length === 0 && impliedPlans.length === 0 && aliasPlans.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!APPLY) {
    console.log('Dry run complete. Review the list above, then re-run with --apply.');
    return;
  }

  // ─── Apply ────────────────────────────────────────────────────────────

  const failures = [];
  const realIdByNorm = new Map(); // norm -> real tags_v2 id, once created

  for (let i = 0; i < toCreateList.length; i++) {
    const [norm, plan] = toCreateList[i];
    try {
      const created = await pb.collection('tags_v2').create({
        tag: plan.norm,
        slug: plan.slug,
        previous_slugs: [],
      });
      realIdByNorm.set(norm, created.id);
      console.log(`  [create ${i + 1}/${toCreateList.length}] tag="${plan.norm}" (${created.id})`);
    } catch (err) {
      failures.push({ what: `create tag "${plan.norm}"`, error: err?.message || String(err) });
      console.error(`  [create ${i + 1}/${toCreateList.length}] FAILED tag="${plan.norm}": ${err?.message || err}`);
    }
    if (i < toCreateList.length - 1) await sleep(DELAY_MS_LIGHT);
  }

  // Substitutes a placeholder id with its real id once created; passes a
  // real id (one that already existed before this run) through unchanged.
  // Returns null for a placeholder whose create failed above - the caller
  // filters these out rather than writing a dead reference.
  function realize(id) {
    if (!id || !id.startsWith('<new:')) return id;
    const norm = id.slice('<new:'.length, -1);
    return realIdByNorm.get(norm) ?? null;
  }

  let patternsUpdated = 0;
  for (let i = 0; i < patternPlans.length; i++) {
    const p = patternPlans[i];
    const finalIds = p.derivedIds.map(realize).filter(Boolean);
    try {
      await pb.collection('patterns').update(p.id, { tag_refs: finalIds });
      patternsUpdated++;
      console.log(`  [pattern ${i + 1}/${patternPlans.length}] "${p.name}" (${p.id})  ${finalIds.length} ref(s)`);
    } catch (err) {
      failures.push({ what: `update pattern ${p.id}`, error: err?.message || String(err) });
      console.error(`  [pattern ${i + 1}/${patternPlans.length}] FAILED ${p.id}: ${err?.message || err}`);
    }
    if (i < patternPlans.length - 1) await sleep(DELAY_MS_RECORD);
  }

  let impliedUpdated = 0;
  for (let i = 0; i < impliedPlans.length; i++) {
    const e = impliedPlans[i];
    const payload = {};
    if (e.tagRefId !== null) {
      const id = realize(e.tagRefId);
      if (id) payload.tag_ref = id;
    }
    if (e.impliesTagRefId !== null) {
      const id = realize(e.impliesTagRefId);
      if (id) payload.implies_tag_ref = id;
    }
    if (Object.keys(payload).length === 0) continue; // both sides' creates failed above
    try {
      await pb.collection('implied_tags').update(e.id, payload);
      impliedUpdated++;
      console.log(`  [implied_tags ${i + 1}/${impliedPlans.length}] "${e.tag}" implies "${e.implies_tag}" (${e.id})`);
    } catch (err) {
      failures.push({ what: `update implied_tags ${e.id}`, error: err?.message || String(err) });
      console.error(`  [implied_tags ${i + 1}/${impliedPlans.length}] FAILED ${e.id}: ${err?.message || err}`);
    }
    if (i < impliedPlans.length - 1) await sleep(DELAY_MS_RECORD);
  }

  let aliasesUpdated = 0;
  for (let i = 0; i < aliasPlans.length; i++) {
    const a = aliasPlans[i];
    const id = realize(a.targetRefId);
    if (!id) continue; // its create failed above
    try {
      await pb.collection('tag_aliases').update(a.id, { target_tag_ref: id });
      aliasesUpdated++;
      console.log(`  [tag_aliases ${i + 1}/${aliasPlans.length}] "${a.alias}" -> "${a.target_tag}" (${a.id})`);
    } catch (err) {
      failures.push({ what: `update tag_aliases ${a.id}`, error: err?.message || String(err) });
      console.error(`  [tag_aliases ${i + 1}/${aliasPlans.length}] FAILED ${a.id}: ${err?.message || err}`);
    }
    if (i < aliasPlans.length - 1) await sleep(DELAY_MS_RECORD);
  }

  console.log();
  console.log(
    `Done. Created ${realIdByNorm.size} of ${toCreateList.length} planned tag(s), ` +
      `updated ${patternsUpdated} pattern(s), ${impliedUpdated} implied_tags edge(s), ${aliasesUpdated} tag_aliases row(s).`,
  );
  if (failures.length > 0) {
    console.log(`${failures.length} failure(s) - safe to re-run this script to retry just these:`);
    for (const f of failures) console.log(`  - ${f.what}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err?.message || err);
  process.exit(1);
});
