// A read-only check for author-name collisions, run before
// scripts/backfill-author-tags.mjs turns author identity from a user-ID
// relation into a tag string.
//
// Finds:
//   1. Two different registered users who are both credited as an author on
//      at least one pattern and share the same name (after normalization).
//   2. Two different raw spellings of an author_manual credit that
//      normalize to the same tag (e.g. "Jane Doe" vs "Jane  Doe").
//   3. A registered, credited user whose name normalizes to the same value
//      as a manual-author credit used on patterns that don't link to that
//      user - possibly the same person recorded two different ways,
//      possibly two different people who happen to share a name.
//   4. manual_authors profile records whose `name` field doesn't exactly
//      match any author_manual string actually in use on a pattern - a
//      known gap surfaced here with real data instead of left as a
//      theoretical risk.
//
// This script makes no writes. Run it, read the report, and fix any real
// collision by hand - using the site's existing "(context)" disambiguation
// convention - before running scripts/backfill-author-tags.mjs.
//
// Usage:
//   PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password \
//     node scripts/audit-duplicate-author-names.mjs
//
// Updated method for powershell in WebStorm
// $env:PB_ADMIN_EMAIL = "email@test.com"
// $env:PB_ADMIN_PASSWORD = "test"
// npm run audit:duplicate-authors
//
// PB_URL defaults to the production instance; override it to point at
// staging instead. Credentials are read from the environment only - do not
// hardcode them here, and do not add them to a committed file.

import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'https://stained-glass.pockethost.io';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const EXAMPLE_LIMIT = 3; // how many example pattern IDs to print per finding

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in the environment before running this script.\n' +
      'Example:\n' +
      '  PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=your-password node scripts/audit-duplicate-author-names.mjs',
  );
  process.exit(1);
}

// Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
// This plain script can't import a .ts file from src/ directly - keep this
// copy in sync if the canonical rule ever changes.
function normalizeTagName(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function examples(patternIdSet) {
  const ids = [...patternIdSet];
  const shown = ids.slice(0, EXAMPLE_LIMIT).join(', ');
  const more = ids.length > EXAMPLE_LIMIT ? `, +${ids.length - EXAMPLE_LIMIT} more` : '';
  return `${ids.length} pattern${ids.length === 1 ? '' : 's'} (${shown}${more})`;
}

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection('admins').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const [users, patterns, manualAuthorProfiles] = await Promise.all([
    pb.collection('users').getFullList({ fields: 'id,name,is_artist' }),
    pb.collection('patterns').getFullList({
      filter: 'isDeleted = false && is_draft = false',
      fields: 'id,authors,author_manual',
    }),
    pb.collection('manual_authors').getFullList({ fields: 'id,name,is_published' }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));

  // normalized name -> Map<userId,     { name, patternIds: Set }>
  const registered = new Map();
  // normalized name -> Map<rawSpelling, { patternIds: Set }>
  const manual = new Map();

  for (const p of patterns) {
    for (const uid of p.authors || []) {
      const user = userById.get(uid);
      if (!user?.name) continue;
      const norm = normalizeTagName(user.name);
      if (!registered.has(norm)) registered.set(norm, new Map());
      const byUser = registered.get(norm);
      if (!byUser.has(uid)) byUser.set(uid, { name: user.name, patternIds: new Set() });
      byUser.get(uid).patternIds.add(p.id);
    }
    for (const raw of p.author_manual || []) {
      if (!raw || !raw.trim()) continue;
      const norm = normalizeTagName(raw);
      if (!manual.has(norm)) manual.set(norm, new Map());
      const byRaw = manual.get(norm);
      if (!byRaw.has(raw)) byRaw.set(raw, { patternIds: new Set() });
      byRaw.get(raw).patternIds.add(p.id);
    }
  }

  const findings = {
    registeredCollisions: [],
    manualSpellingCollisions: [],
    crossSystemCollisions: [],
    profileMismatches: [],
  };

  // 1. Two different registered user IDs sharing a normalized name.
  for (const [norm, byUser] of registered) {
    if (byUser.size > 1) {
      findings.registeredCollisions.push({
        normalized: norm,
        users: [...byUser.entries()].map(([id, v]) => ({ id, name: v.name, patternIds: v.patternIds })),
      });
    }
  }

  // 2. Two different raw spellings of a manual credit sharing a normalized name.
  for (const [norm, byRaw] of manual) {
    if (byRaw.size > 1) {
      findings.manualSpellingCollisions.push({
        normalized: norm,
        spellings: [...byRaw.entries()].map(([raw, v]) => ({ raw, patternIds: v.patternIds })),
      });
    }
  }

  // 3. A normalized name present in both systems.
  for (const [norm, byUser] of registered) {
    if (manual.has(norm)) {
      findings.crossSystemCollisions.push({
        normalized: norm,
        registeredUsers: [...byUser.entries()].map(([id, v]) => ({ id, name: v.name, patternIds: v.patternIds })),
        manualSpellings: [...manual.get(norm).entries()].map(([raw, v]) => ({ raw, patternIds: v.patternIds })),
      });
    }
  }

  // 4. manual_authors profile records that don't exactly match any raw
  //    author_manual string actually seen on a pattern.
  const rawManualStrings = new Set();
  for (const byRaw of manual.values()) {
    for (const raw of byRaw.keys()) rawManualStrings.add(raw);
  }
  for (const profile of manualAuthorProfiles) {
    if (!rawManualStrings.has(profile.name)) {
      findings.profileMismatches.push({ id: profile.id, name: profile.name, isPublished: !!profile.is_published });
    }
  }

  report(findings);
}

function report(findings) {
  const line = (s = '') => console.log(s);
  let blockingTotal = 0;

  line('=== Duplicate author-name audit ===');
  line();

  line(`1. Registered users sharing a name (${findings.registeredCollisions.length})`);
  for (const c of findings.registeredCollisions) {
    blockingTotal++;
    line(`   "${c.normalized}":`);
    for (const u of c.users) line(`     - user ${u.id}  "${u.name}"  - credited on ${examples(u.patternIds)}`);
  }
  line();

  line(`2. Manual-author spellings that normalize to the same tag (${findings.manualSpellingCollisions.length})`);
  for (const c of findings.manualSpellingCollisions) {
    blockingTotal++;
    line(`   "${c.normalized}":`);
    for (const s of c.spellings) line(`     - "${s.raw}"  - used on ${examples(s.patternIds)}`);
  }
  line();

  line(`3. Same name used by both a registered author and a manual credit (${findings.crossSystemCollisions.length})`);
  for (const c of findings.crossSystemCollisions) {
    blockingTotal++;
    line(`   "${c.normalized}":`);
    for (const u of c.registeredUsers)
      line(`     - registered: user ${u.id}  "${u.name}"  - ${examples(u.patternIds)}`);
    for (const s of c.manualSpellings) line(`     - manual: "${s.raw}"  - ${examples(s.patternIds)}`);
  }
  line();

  line(`4. manual_authors profiles that don't exactly match any in-use credit (${findings.profileMismatches.length})`);
  for (const m of findings.profileMismatches) {
    line(`   - ${m.id}  "${m.name}"  ${m.isPublished ? '(published)' : '(unpublished)'}`);
  }
  line();

  if (blockingTotal === 0) {
    line(
      'No name collisions found across sections 1-3. Section 4 items are worth a look but do not block the ' +
        'author-tags backfill.',
    );
  } else {
    line(
      `${blockingTotal} potential collision(s) found across sections 1-3. Resolve any real collision by hand, using ` +
        'the site\'s existing "(context)" disambiguation convention, before running the author-tags backfill.',
    );
  }
}

main().catch((err) => {
  console.error('Audit failed:', err?.message || err);
  process.exit(1);
});
