// The one-time migration that copies every existing `tag_hierarchy` row into
// the `implied_tags` collection, as one directional edge each: the child tag
// becomes `tag`, the parent tag becomes `implies_tag`.
//
// `tag_hierarchy` is left completely untouched - it's still what the live
// save-time hierarchy-baking logic reads. This script only adds to
// `implied_tags`, it never reads from or writes to `tag_hierarchy`.
//
// This makes writes. By default it's a DRY RUN - it prints exactly what it
// would create, without writing anything. Pass --apply to actually create
// the rows. Safe to run more than once: an edge already present in
// implied_tags (same tag + implies_tag pair) is skipped, not duplicated.
//
// Usage:
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/migrate-hierarchy-to-implied-tags.mjs            # dry run
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/migrate-hierarchy-to-implied-tags.mjs --apply    # apply
//
// PowerShell:
//   $env:PB_ADMIN_EMAIL = "you@example.com"
//   $env:PB_ADMIN_PASSWORD = "your-password"
//   npm run migrate:hierarchy-to-implied-tags              # dry run
//   npm run migrate:hierarchy-to-implied-tags -- --apply    # apply
//
// PB_URL defaults to the production instance; override it to point at
// staging instead. Credentials are read from the environment only - do not
// hardcode them here, and do not add them to a committed file.

import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'https://stained-glass.pockethost.io';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const APPLY = process.argv.includes('--apply');
// Same reasoning as backfill-tags-v2.mjs: lighter than the admin UI's 3s
// batch delay, since this only ever creates one small edge row at a time.
const DELAY_MS = 200;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in the environment before running this script.\n' +
      'Example:\n' +
      '  PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password node scripts/migrate-hierarchy-to-implied-tags.mjs',
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Composite key for the "does this edge already exist" check - implied_tags
// has no single-column unique constraint (tag alone can't be unique, that's
// the whole point of the table), so uniqueness is checked on the pair.
function edgeKey(tag, impliesTag) {
  return `${tag} ${impliesTag}`;
}

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection('admins').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const [hierarchyRows, existingEdges] = await Promise.all([
    pb.collection('tag_hierarchy').getFullList({ fields: 'tag,parent_tag' }),
    pb.collection('implied_tags').getFullList({ fields: 'tag,implies_tag' }),
  ]);

  const existingEdgeSet = new Set(existingEdges.map((e) => edgeKey(e.tag, e.implies_tag)));

  const toCreate = [];
  const seenThisRun = new Set();
  for (const h of hierarchyRows) {
    if (!h.tag || !h.parent_tag) continue; // defensive - shouldn't happen, but don't create a malformed edge
    const key = edgeKey(h.tag, h.parent_tag);
    if (existingEdgeSet.has(key) || seenThisRun.has(key)) continue;
    seenThisRun.add(key);
    toCreate.push({ tag: h.tag, implies_tag: h.parent_tag });
  }
  toCreate.sort((a, b) => a.tag.localeCompare(b.tag) || a.implies_tag.localeCompare(b.implies_tag));

  console.log('=== tag_hierarchy -> implied_tags migration ===');
  console.log(
    APPLY
      ? 'Mode: APPLY - this will create records.'
      : 'Mode: DRY RUN - nothing will be written. Pass --apply to create these rows.',
  );
  console.log();
  console.log(`tag_hierarchy rows read: ${hierarchyRows.length}`);
  console.log(`Already present in implied_tags (skipped): ${hierarchyRows.length - toCreate.length}`);
  console.log(`To create: ${toCreate.length}`);
  console.log();

  if (toCreate.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!APPLY) {
    for (const edge of toCreate) {
      console.log(`  would create  "${edge.tag}" implies "${edge.implies_tag}"`);
    }
    console.log();
    console.log(`Dry run complete. Re-run with --apply to create these ${toCreate.length} row(s).`);
    return;
  }

  const failures = [];
  let created = 0;
  for (let i = 0; i < toCreate.length; i++) {
    const edge = toCreate[i];
    try {
      await pb.collection('implied_tags').create(edge);
      created++;
      console.log(`  [${i + 1}/${toCreate.length}] created  "${edge.tag}" implies "${edge.implies_tag}"`);
    } catch (err) {
      failures.push({ edge, error: err?.message || String(err) });
      console.error(
        `  [${i + 1}/${toCreate.length}] FAILED   "${edge.tag}" implies "${edge.implies_tag}": ${err?.message || err}`,
      );
    }
    if (i < toCreate.length - 1) await sleep(DELAY_MS);
  }

  console.log();
  console.log(`Created ${created} of ${toCreate.length} row(s).`);
  if (failures.length > 0) {
    console.log(`${failures.length} failure(s) - safe to re-run this script to retry just these:`);
    for (const f of failures) console.log(`  - "${f.edge.tag}" implies "${f.edge.implies_tag}": ${f.error}`);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
