// Phase 1 of the tag redesign (see TAG_REDESIGN_PROJECT_NOTES.md) - the
// one-time backfill that populates the new `tags_v2` collection from every
// distinct tag string currently in use on a published pattern.
//
// For each distinct, normalized tag found in patterns.tags, this creates one
// tags_v2 row (type left empty, meaning General) - unless a row for that
// normalized tag already exists, in which case it's skipped. That makes
// this script safe to run more than once: an interrupted run, or a second
// run after more tags were added in the meantime, only ever creates what's
// still missing.
//
// This makes writes. By default it's a DRY RUN - it prints exactly what it
// would create, without writing anything. Pass --apply to actually create
// the rows.
//
// Usage:
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/backfill-tags-v2.mjs            # dry run (default)
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/backfill-tags-v2.mjs --apply    # actually creates rows
//
// PowerShell:
//   $env:PB_ADMIN_EMAIL = "you@example.com"
//   $env:PB_ADMIN_PASSWORD = "your-password"
//   npm run backfill:tags-v2              # dry run
//   npm run backfill:tags-v2 -- --apply   # apply
//
// PB_URL defaults to the production instance; override it to point at
// staging instead. Credentials are read from the environment only - do not
// hardcode them here, and do not add them to a committed file.

import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'https://stained-glass.pockethost.io';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const APPLY = process.argv.includes('--apply');
// Gentler than the admin UI's 3s batch delay (RenameOrMergePanel) - that
// delay protects against rewriting many heavy pattern records; this script
// only ever creates one small tags_v2 row at a time.
const DELAY_MS = 200;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in the environment before running this script.\n' +
      'Example:\n' +
      '  PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password node scripts/backfill-tags-v2.mjs',
  );
  process.exit(1);
}

// Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
// This plain script can't import a .ts file from src/ directly - keep this
// copy in sync if the canonical rule ever changes. (Also duplicated in
// scripts/audit-duplicate-author-names.mjs for the same reason.)
function normalizeTagName(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Turns a normalized tag into a URL-safe slug: any run of characters that
// isn't a-z/0-9 becomes a single hyphen, and leading/trailing hyphens are
// trimmed - e.g. "eye (flower)" -> "eye-flower". A tag that slugifies to
// nothing (rare - e.g. a tag made entirely of punctuation) is reported and
// skipped rather than guessed at. Collision handling, for two different
// tags that slugify to the same value, happens in main().
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

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection('admins').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const [patterns, existingTags] = await Promise.all([
    pb.collection('patterns').getFullList({
      filter: 'isDeleted = false && is_draft = false',
      fields: 'id,tags',
    }),
    pb.collection('tags_v2').getFullList({ fields: 'id,tag,slug' }),
  ]);

  const existingTagSet = new Set(existingTags.map((r) => r.tag));
  const usedSlugs = new Set(existingTags.map((r) => r.slug));

  // Collect every distinct normalized tag actually in use, remembering one
  // real raw (pre-normalization) spelling per tag for the report.
  const seen = new Map(); // normalized -> raw example
  for (const p of patterns) {
    for (const raw of p.tags || []) {
      if (!raw || !String(raw).trim()) continue;
      const norm = normalizeTagName(String(raw));
      if (!seen.has(norm)) seen.set(norm, raw);
    }
  }

  // Sorted so slug-collision suffixing (-2, -3, ...) is deterministic and
  // reproducible between a dry run and the real apply run, rather than
  // depending on whatever order patterns happened to be scanned in.
  const sortedEntries = [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const toCreate = [];
  const skippedEmpty = [];
  let skippedExistingCount = 0;

  for (const [norm, rawExample] of sortedEntries) {
    if (existingTagSet.has(norm)) {
      skippedExistingCount++;
      continue;
    }
    const slug = slugify(norm);
    if (!slug) {
      skippedEmpty.push(rawExample);
      continue;
    }
    let candidate = slug;
    let suffix = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${slug}-${suffix++}`;
    }
    usedSlugs.add(candidate);
    toCreate.push({ tag: norm, slug: candidate, rawExample });
  }

  console.log('=== tags_v2 backfill (Phase 1, tag redesign) ===');
  console.log(
    APPLY
      ? 'Mode: APPLY - this will create records.'
      : 'Mode: DRY RUN - nothing will be written. Pass --apply to create these rows.',
  );
  console.log();
  console.log(`Distinct tags found in use on published patterns: ${seen.size}`);
  console.log(`Already present in tags_v2 (skipped): ${skippedExistingCount}`);
  console.log(`Slugified to nothing (skipped - needs a manual look): ${skippedEmpty.length}`);
  for (const raw of skippedEmpty) console.log(`  - raw value: ${JSON.stringify(raw)}`);
  console.log(`To create: ${toCreate.length}`);
  console.log();

  if (toCreate.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!APPLY) {
    for (const item of toCreate) {
      const rawNote = item.rawExample !== item.tag ? `  (raw: ${JSON.stringify(item.rawExample)})` : '';
      console.log(`  would create  tag="${item.tag}"  slug="${item.slug}"${rawNote}`);
    }
    console.log();
    console.log(`Dry run complete. Re-run with --apply to create these ${toCreate.length} row(s).`);
    return;
  }

  const failures = [];
  let created = 0;
  for (let i = 0; i < toCreate.length; i++) {
    const item = toCreate[i];
    try {
      await pb.collection('tags_v2').create({ tag: item.tag, slug: item.slug, previous_slugs: [] });
      created++;
      console.log(`  [${i + 1}/${toCreate.length}] created  tag="${item.tag}"  slug="${item.slug}"`);
    } catch (err) {
      failures.push({ tag: item.tag, error: err?.message || String(err) });
      console.error(`  [${i + 1}/${toCreate.length}] FAILED   tag="${item.tag}": ${err?.message || err}`);
    }
    if (i < toCreate.length - 1) await sleep(DELAY_MS);
  }

  console.log();
  console.log(`Created ${created} of ${toCreate.length} row(s).`);
  if (failures.length > 0) {
    console.log(
      `${failures.length} failure(s) - safe to re-run this script to retry just these, since already-created rows are skipped automatically:`,
    );
    for (const f of failures) console.log(`  - "${f.tag}": ${f.error}`);
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err?.message || err);
  process.exit(1);
});
