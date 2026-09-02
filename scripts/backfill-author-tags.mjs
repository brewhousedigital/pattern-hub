// Phase 4 of the tag redesign (see TAG_REDESIGN_PROJECT_NOTES.md) - the
// one-time backfill that turns every author, registered or manual, into an
// Author-type tags_v2 row, and cascades each pattern's resolved author
// name(s) into its own `patterns.tags` list.
//
// Run scripts/audit-duplicate-author-names.mjs first and resolve any real
// collision it finds - this script assumes a normalized author name
// identifies exactly one person, the same assumption that audit checks.
//
// What this does, in order:
//
//   1. Finds or creates one `tag_types` row named "Author"
//      (display_mode: "author"). Every author tag below points at it.
//   2. For every distinct normalized author name - from patterns.authors
//      (a registered user) or patterns.author_manual (free text) - finds or
//      creates one Author-type tags_v2 row. A registered author's row gets
//      `linked_user` set to their account id. If a tags_v2 row already
//      exists for that exact name (e.g. it was already a plain descriptive
//      tag), this retypes it to Author instead of creating a duplicate -
//      the dry run lists these separately so they're easy to review before
//      applying.
//   3. Links every existing `manual_authors` profile to the matching
//      Author tag, when their (normalized) name matches and the profile
//      isn't already linked - this preserves existing avatar/bio/external
//      link flair without needing an admin to manually re-link every one.
//   4. For every published pattern, adds any resolved author tag(s) missing
//      from its own `tags` array. Existing tags are never removed - this
//      only ever adds.
//
// This does NOT touch patterns.authors or patterns.author_manual - those
// stay exactly as they are and stay the fields the admin editor writes.
// See TAG_REDESIGN_PROJECT_NOTES.md, Phase 4, "this freeze instruction was
// wrong" for why.
//
// This makes writes. By default it's a DRY RUN - it prints exactly what it
// would do, without writing anything. Pass --apply to actually write.
// Safe to re-run: anything already correct (existing tag, existing link,
// tag already present on a pattern) is skipped.
//
// Usage:
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/backfill-author-tags.mjs            # dry run (default)
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/backfill-author-tags.mjs --apply    # actually writes
//
// PowerShell:
//   $env:PB_ADMIN_EMAIL = "you@example.com"
//   $env:PB_ADMIN_PASSWORD = "your-password"
//   npm run backfill:author-tags              # dry run
//   npm run backfill:author-tags -- --apply   # apply
//
// PB_URL defaults to the production instance; override it to point at
// staging instead. Credentials are read from the environment only - do not
// hardcode them here, and do not add them to a committed file.

import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'https://stained-glass.pockethost.io';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const APPLY = process.argv.includes('--apply');
// Small metadata rows (tags_v2, manual_authors) - matches the delay
// scripts/backfill-tags-v2.mjs already uses for the same kind of row.
const DELAY_MS_LIGHT = 200;
// Pattern records are much heavier - this codebase's own admin bulk-rewrite
// tool (RenameOrMergePanel) treats them with extra care for that reason.
// This script isn't sending from a browser, but a more conservative pace
// than the light delay above is still the sensible default for a batch
// that could touch every pattern on the site.
const DELAY_MS_PATTERN = 400;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in the environment before running this script.\n' +
      'Example:\n' +
      '  PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password node scripts/backfill-author-tags.mjs',
  );
  process.exit(1);
}

// Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
// This plain script can't import a .ts file from src/ directly - keep this
// copy in sync if the canonical rule ever changes. (Also duplicated in
// scripts/audit-duplicate-author-names.mjs and scripts/backfill-tags-v2.mjs
// for the same reason.)
function normalizeTagName(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Mirrors slugify() in scripts/backfill-tags-v2.mjs - see that file's
// comment for the exact rule.
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

// Manual overrides for a normalized author name that collides with an
// existing, unrelated tag or word - confirmed by the dry run's per-retype
// usage check (the "checked: N of M pattern(s)... do NOT credit this
// author" line under "existing tags_v2 rows to retype/relink" below).
//
// Add an entry here - normalized author name -> the tag string to use
// instead, following the site's existing "(context)" disambiguation
// convention - then re-run. This only changes the literal tag string this
// author's identity is stored and cascaded under; the person's own account
// name, and every display surface that reads it directly rather than
// through tags (profile page, "Designed by" credits, etc.), is unaffected.
// Leave every non-colliding name out of this map entirely.
const AUTHOR_TAG_OVERRIDES = {
  // Confirmed 2026-09-02: all 3 patterns already using the plain tag
  // "autumn" (Pumpkins, Fall Harvest, Issue_11) are seasonal, not credits
  // to this author - see TAG_REDESIGN_PROJECT_NOTES.md, Phase 4.
  autumn: 'autumn (artist)',
};

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection('admins').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const [users, patterns, manualAuthorProfiles, tagTypes, existingTags] = await Promise.all([
    pb.collection('users').getFullList({ fields: 'id,name' }),
    pb.collection('patterns').getFullList({
      filter: 'isDeleted = false && is_draft = false',
      fields: 'id,name,tags,tag_refs,authors,author_manual',
    }),
    pb.collection('manual_authors').getFullList({ fields: 'id,name,linked_tag' }),
    pb.collection('tag_types').getFullList({ fields: 'id,name' }),
    pb.collection('tags_v2').getFullList({ fields: 'id,tag,slug,type,linked_user' }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const patternNameById = new Map(patterns.map((p) => [p.id, p.name]));
  const tagsByNorm = new Map(existingTags.map((r) => [r.tag, r]));
  const usedSlugs = new Set(existingTags.map((r) => r.slug));

  // tag string -> every pattern currently carrying it, regardless of why.
  // Used below to check a "would retype" collision against every pattern
  // that actually uses the literal string, not just the ones crediting
  // this author via authors/author_manual - see the report section.
  const patternsByTag = new Map();
  for (const p of patterns) {
    for (const t of p.tags || []) {
      if (!patternsByTag.has(t)) patternsByTag.set(t, new Set());
      patternsByTag.get(t).add(p.id);
    }
  }

  // ─── Step 1: find or plan the "Author" tag_types row ────────────────────
  let authorTypeId = tagTypes.find((t) => t.name === 'Author')?.id ?? null;
  const willCreateAuthorType = !authorTypeId;
  if (!authorTypeId) authorTypeId = '<new-author-tag-type-id>'; // dry-run placeholder

  // ─── Step 2: resolve one identity per distinct normalized author name ───
  // normalized -> { name, linkedUserId: string|null, patternIds: Set, tagValue }
  // tagValue is the literal string this identity is stored and cascaded
  // under - the normalized name itself, unless AUTHOR_TAG_OVERRIDES above
  // says otherwise.
  const identities = new Map();

  for (const p of patterns) {
    for (const uid of p.authors || []) {
      const user = userById.get(uid);
      if (!user?.name) continue;
      const norm = normalizeTagName(user.name);
      if (!identities.has(norm)) {
        identities.set(norm, {
          name: user.name,
          linkedUserId: uid,
          patternIds: new Set(),
          tagValue: AUTHOR_TAG_OVERRIDES[norm] || norm,
        });
      }
      identities.get(norm).patternIds.add(p.id);
    }
    for (const raw of p.author_manual || []) {
      if (!raw || !String(raw).trim()) continue;
      const norm = normalizeTagName(String(raw));
      if (!identities.has(norm)) {
        identities.set(norm, {
          name: raw,
          linkedUserId: null,
          patternIds: new Set(),
          tagValue: AUTHOR_TAG_OVERRIDES[norm] || norm,
        });
      }
      identities.get(norm).patternIds.add(p.id);
    }
  }

  const sortedIdentities = [...identities.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const tagsToCreate = [];
  const tagsToRetype = [];
  // norm -> tags_v2 id (existing or about-to-exist), for steps 3 and 4 below.
  // Deliberately keyed by the raw normalized name, not tagValue - step 3 and
  // 4 both resolve an identity from raw pattern/profile data, so they need
  // to look this map up by that same raw key regardless of any override.
  const tagIdByNorm = new Map();

  for (const [norm, identity] of sortedIdentities) {
    const tagValue = identity.tagValue;
    const existing = tagsByNorm.get(tagValue);
    if (existing) {
      tagIdByNorm.set(norm, existing.id);
      if (existing.type !== authorTypeId) {
        tagsToRetype.push({ norm, tagValue, identity, existingRow: existing });
      } else if (identity.linkedUserId && existing.linked_user !== identity.linkedUserId) {
        // Already Author-typed but missing the user link (e.g. someone
        // registered an account after their manual credit was migrated).
        tagsToRetype.push({ norm, tagValue, identity, existingRow: existing });
      }
      continue;
    }

    const slug = slugify(tagValue);
    let candidate = slug || 'author';
    let suffix = 2;
    while (usedSlugs.has(candidate)) candidate = `${slug || 'author'}-${suffix++}`;
    usedSlugs.add(candidate);
    tagIdByNorm.set(norm, `<new-tag-id:${tagValue}>`); // dry-run placeholder
    tagsToCreate.push({ norm, tagValue, identity, slug: candidate });
  }

  // ─── Step 3: link existing manual_authors profiles ──────────────────────
  const profilesToLink = [];
  for (const profile of manualAuthorProfiles) {
    if (profile.linked_tag) continue; // already linked - never overwritten
    const norm = normalizeTagName(profile.name || '');
    if (!norm || !identities.has(norm)) continue;
    profilesToLink.push({ profile, norm });
  }

  // ─── Step 4: cascade resolved author tags into each pattern's own tags ──
  // (and, Tag Relational Refactor Phase R1 - see
  // TAG_RELATIONAL_REFACTOR_NOTES.md - into tag_refs too, dual-write
  // alongside the existing string cascade below.)
  const patternsToUpdate = [];
  for (const p of patterns) {
    // Resolves through each identity's tagValue, not the raw normalized
    // name directly - a pattern crediting an author with an override (e.g.
    // "autumn" -> "autumn (artist)") must be cascaded with the
    // disambiguated string, never the raw one, or it would recreate the
    // exact collision the override exists to avoid. resolvedNorms tracks
    // the raw norms alongside tagValues - tagIdByNorm (used for tag_refs
    // below) is keyed by norm, not tagValue, same as step 2 above.
    const resolvedTagValues = new Set();
    const resolvedNorms = new Set();
    for (const uid of p.authors || []) {
      const user = userById.get(uid);
      if (!user?.name) continue;
      const norm = normalizeTagName(user.name);
      const identity = identities.get(norm);
      resolvedTagValues.add(identity ? identity.tagValue : norm);
      resolvedNorms.add(norm);
    }
    for (const raw of p.author_manual || []) {
      if (!raw || !String(raw).trim()) continue;
      const norm = normalizeTagName(String(raw));
      const identity = identities.get(norm);
      resolvedTagValues.add(identity ? identity.tagValue : norm);
      resolvedNorms.add(norm);
    }
    if (resolvedTagValues.size === 0) continue;

    const currentTags = Array.isArray(p.tags) ? p.tags : [];
    const currentTagSet = new Set(currentTags);
    const missing = [...resolvedTagValues].filter((n) => !currentTagSet.has(n));

    const currentRefs = Array.isArray(p.tag_refs) ? p.tag_refs : [];
    const currentRefSet = new Set(currentRefs);
    // tagIdByNorm may still hold a dry-run placeholder (e.g.
    // "<new-tag-id:...>") for a tag this run would create - that's fine
    // here, a placeholder string can never match a real id already in
    // currentRefSet, so it still correctly counts as missing. Resolved to
    // real ids at apply time, once every non-conflicted identity's create
    // has run - see the apply loop below.
    const missingRefNorms = [...resolvedNorms].filter((n) => !currentRefSet.has(tagIdByNorm.get(n)));

    if (missing.length === 0 && missingRefNorms.length === 0) continue;

    patternsToUpdate.push({ id: p.id, missing, newTags: [...currentTags, ...missing], missingRefNorms, currentRefs });
  }

  // ─── Report ───────────────────────────────────────────────────────────
  console.log('=== Author tags backfill (Phase 4, tag redesign) ===');
  console.log(
    APPLY
      ? 'Mode: APPLY - this will create and update records.'
      : 'Mode: DRY RUN - nothing will be written. Pass --apply to write these changes.',
  );
  console.log();

  console.log(`"Author" tag type: ${willCreateAuthorType ? 'would create' : 'already exists (' + authorTypeId + ')'}`);
  console.log();

  console.log(`Distinct author identities found: ${identities.size}`);
  console.log(`  tags_v2 rows to create: ${tagsToCreate.length}`);
  for (const t of tagsToCreate) {
    const overrideNote = t.tagValue !== t.norm ? `  (override, author name: "${t.norm}")` : '';
    console.log(
      `    would create  tag="${t.tagValue}"  slug="${t.slug}"${t.identity.linkedUserId ? `  linked_user=${t.identity.linkedUserId}` : ''}${overrideNote}`,
    );
  }
  console.log(`  existing tags_v2 rows to retype/relink: ${tagsToRetype.length}`);
  for (const t of tagsToRetype) {
    console.log(
      `    would retype  tag="${t.tagValue}"  (id=${t.existingRow.id}, was type="${t.existingRow.type || '(none)'}")` +
        `${t.identity.linkedUserId ? `  linked_user=${t.identity.linkedUserId}` : ''}` +
        `  <- REVIEW: confirm this existing tag really is this author, not a coincidentally-matching word`,
    );
    // Every pattern currently carrying this literal tag string, versus just
    // the ones this identity's own author credit (authors/author_manual)
    // accounts for. Anything in the first set but not the second is using
    // "${t.tagValue}" for some other reason - the concrete signal that this
    // is a real name/word collision, not just a cautious false alarm. Once
    // AUTHOR_TAG_OVERRIDES resolves a collision, that identity moves to
    // tagsToCreate under its new tagValue instead, so this check no longer
    // runs for it - the override is confirmation enough at that point.
    const allUsage = patternsByTag.get(t.tagValue) ?? new Set();
    const unexplained = [...allUsage].filter((id) => !t.identity.patternIds.has(id));
    if (unexplained.length === 0) {
      console.log(
        `        checked: all ${allUsage.size} pattern(s) already carrying "${t.tagValue}" are ones this author is credited on - likely a real match, not a collision.`,
      );
    } else {
      console.log(
        `        checked: ${unexplained.length} of ${allUsage.size} pattern(s) carrying "${t.tagValue}" do NOT credit this author - look closely, this may be a genuine word/name collision. Add an entry to AUTHOR_TAG_OVERRIDES at the top of this script if so:`,
      );
      for (const id of unexplained.slice(0, 5)) {
        console.log(`          - ${patternNameById.get(id) ?? '(unknown name)'}  (${id})`);
      }
      if (unexplained.length > 5) console.log(`          ... and ${unexplained.length - 5} more`);
    }
  }
  console.log();

  console.log(`manual_authors profiles to link: ${profilesToLink.length}`);
  for (const l of profilesToLink) {
    console.log(`    would link  manual_authors "${l.profile.name}" (${l.profile.id})  -> tag "${l.norm}"`);
  }
  console.log();

  const totalMissingTags = patternsToUpdate.reduce((sum, p) => sum + p.missing.length, 0);
  const totalMissingRefs = patternsToUpdate.reduce((sum, p) => sum + p.missingRefNorms.length, 0);
  console.log(
    `Patterns needing an author tag added: ${patternsToUpdate.length} ` +
      `(${totalMissingTags} tag-adds, ${totalMissingRefs} tag_refs-adds total)`,
  );
  if (!APPLY) {
    for (const p of patternsToUpdate.slice(0, 20)) {
      const parts = [];
      if (p.missing.length) parts.push(`tags +${JSON.stringify(p.missing)}`);
      if (p.missingRefNorms.length) parts.push(`tag_refs +${p.missingRefNorms.length}`);
      console.log(`    would update  ${parts.join('  ')}  on pattern ${p.id}`);
    }
    if (patternsToUpdate.length > 20) console.log(`    ... and ${patternsToUpdate.length - 20} more`);
  }
  console.log();

  if (
    !willCreateAuthorType &&
    tagsToCreate.length === 0 &&
    tagsToRetype.length === 0 &&
    profilesToLink.length === 0 &&
    patternsToUpdate.length === 0
  ) {
    console.log('Nothing to do.');
    return;
  }

  if (!APPLY) {
    console.log('Dry run complete. Review the list above - retyped tags especially - then re-run with --apply.');
    return;
  }

  // ─── Apply ────────────────────────────────────────────────────────────

  if (willCreateAuthorType) {
    const created = await pb.collection('tag_types').create({ name: 'Author', display_mode: 'author' });
    authorTypeId = created.id;
    console.log(`Created tag_types "Author" (${authorTypeId})`);
  }

  const failures = [];

  for (let i = 0; i < tagsToCreate.length; i++) {
    const t = tagsToCreate[i];
    try {
      const created = await pb.collection('tags_v2').create({
        tag: t.tagValue,
        slug: t.slug,
        previous_slugs: [],
        type: authorTypeId,
        linked_user: t.identity.linkedUserId || '',
      });
      tagIdByNorm.set(t.norm, created.id);
      console.log(`  [create ${i + 1}/${tagsToCreate.length}] tag="${t.tagValue}" (${created.id})`);
    } catch (err) {
      failures.push({ what: `create tag "${t.tagValue}"`, error: err?.message || String(err) });
      console.error(`  [create ${i + 1}/${tagsToCreate.length}] FAILED tag="${t.tagValue}": ${err?.message || err}`);
    }
    if (i < tagsToCreate.length - 1) await sleep(DELAY_MS_LIGHT);
  }

  for (let i = 0; i < tagsToRetype.length; i++) {
    const t = tagsToRetype[i];
    try {
      await pb.collection('tags_v2').update(t.existingRow.id, {
        type: authorTypeId,
        ...(t.identity.linkedUserId ? { linked_user: t.identity.linkedUserId } : {}),
      });
      console.log(`  [retype ${i + 1}/${tagsToRetype.length}] tag="${t.tagValue}" (${t.existingRow.id})`);
    } catch (err) {
      failures.push({ what: `retype tag "${t.tagValue}"`, error: err?.message || String(err) });
      console.error(`  [retype ${i + 1}/${tagsToRetype.length}] FAILED tag="${t.tagValue}": ${err?.message || err}`);
    }
    if (i < tagsToRetype.length - 1) await sleep(DELAY_MS_LIGHT);
  }

  for (let i = 0; i < profilesToLink.length; i++) {
    const l = profilesToLink[i];
    const tagId = tagIdByNorm.get(l.norm);
    try {
      await pb.collection('manual_authors').update(l.profile.id, { linked_tag: tagId });
      console.log(`  [link ${i + 1}/${profilesToLink.length}] manual_authors "${l.profile.name}" -> ${tagId}`);
    } catch (err) {
      failures.push({ what: `link manual_authors "${l.profile.name}"`, error: err?.message || String(err) });
      console.error(`  [link ${i + 1}/${profilesToLink.length}] FAILED "${l.profile.name}": ${err?.message || err}`);
    }
    if (i < profilesToLink.length - 1) await sleep(DELAY_MS_LIGHT);
  }

  for (let i = 0; i < patternsToUpdate.length; i++) {
    const p = patternsToUpdate[i];
    // Resolve missingRefNorms to real ids now - every non-failed create/
    // retype above has already replaced its tagIdByNorm placeholder with a
    // real id by this point. A norm whose id is still a placeholder (its
    // create failed above) is left out here, not written - safe to re-run
    // this script afterward to pick it up once the tag exists for real.
    const newRefIds = [...new Set([...p.currentRefs, ...p.missingRefNorms.map((n) => tagIdByNorm.get(n))])].filter(
      (id) => id && !String(id).startsWith('<'),
    );
    try {
      await pb.collection('patterns').update(p.id, { tags: p.newTags, tag_refs: newRefIds });
      console.log(
        `  [pattern ${i + 1}/${patternsToUpdate.length}] ${p.id}  +${JSON.stringify(p.missing)}  +refs:${p.missingRefNorms.length}`,
      );
    } catch (err) {
      failures.push({ what: `update pattern ${p.id}`, error: err?.message || String(err) });
      console.error(`  [pattern ${i + 1}/${patternsToUpdate.length}] FAILED ${p.id}: ${err?.message || err}`);
    }
    if (i < patternsToUpdate.length - 1) await sleep(DELAY_MS_PATTERN);
  }

  console.log();
  console.log(
    `Done. Created ${tagsToCreate.length - failures.filter((f) => f.what.startsWith('create')).length} tag(s), ` +
      `retyped ${tagsToRetype.length - failures.filter((f) => f.what.startsWith('retype')).length}, ` +
      `linked ${profilesToLink.length - failures.filter((f) => f.what.startsWith('link')).length} profile(s), ` +
      `updated ${patternsToUpdate.length - failures.filter((f) => f.what.startsWith('update pattern')).length} pattern(s).`,
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
