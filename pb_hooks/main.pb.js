/// <reference path="./types.d.ts" />

// NOTICE: When working in this file, never add functions or variables at the root
// Always add them inside the pocketbase functions, even if it means duplicating them.
// Pocketbase does NOT support outside functions or variables.

// Combines all per-pattern drawer lookups into a single HTTP call to reduce
// request volume. Each sub-query is isolated in its own try/catch so a missing
// record in one table never blocks the others from returning.
// Uses {:param} syntax for safe parameterized filter binding (no injection risk).
routerAdd('GET', '/api/pattern-drawer-data', (c) => {
  const patternId = c.request.url.query().get('patternId') || '';
  const userId = c.request.url.query().get('userId') || '';

  if (!patternId) return c.json(400, { error: 'patternId is required' });

  const result = {
    communityRating: null,
    communityDifficulty: null,
    userRating: null,
    userDifficulty: null,
    userFavorite: null,
    userMarkedDone: null,
    sets: [],
  };

  try {
    const r = $app.findFirstRecordByFilter('community_ratings', 'pattern_id = {:pid}', { pid: patternId });
    result.communityRating = {
      id: r.id,
      pattern_id: r.getString('pattern_id'),
      average_rating: r.getFloat('average_rating'),
      total_ratings: r.getInt('total_ratings'),
    };
  } catch (_) {}

  try {
    const r = $app.findFirstRecordByFilter('community_difficulty_ratings', 'pattern_id = {:pid}', { pid: patternId });
    result.communityDifficulty = {
      id: r.id,
      pattern_id: r.getString('pattern_id'),
      average_rating: r.getFloat('average_rating'),
      total_ratings: r.getInt('total_ratings'),
    };
  } catch (_) {}

  try {
    const records = $app.findRecordsByFilter(
      'pattern_sets',
      'patterns ~ {:pid} && is_published = true',
      '-created',
      0,
      0,
      { pid: patternId },
    );
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      result.sets.push({
        id: r.id,
        title: r.getString('title'),
        description: r.getString('description'),
        color: r.getString('color'),
      });
    }
  } catch (_) {}

  if (userId) {
    try {
      const r = $app.findFirstRecordByFilter('user_ratings', 'pattern_id = {:pid} && owner_id = {:uid}', {
        pid: patternId,
        uid: userId,
      });
      result.userRating = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
        rating: r.getFloat('rating'),
        rating_notes: r.getString('rating_notes'),
      };
    } catch (_) {}

    try {
      const r = $app.findFirstRecordByFilter('user_difficulty_ratings', 'pattern_id = {:pid} && owner_id = {:uid}', {
        pid: patternId,
        uid: userId,
      });
      result.userDifficulty = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
        rating: r.getFloat('rating'),
      };
    } catch (_) {}

    try {
      const r = $app.findFirstRecordByFilter('user_favorites', 'pattern_id = {:pid} && owner_id = {:uid}', {
        pid: patternId,
        uid: userId,
      });
      result.userFavorite = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
      };
    } catch (_) {}

    try {
      const r = $app.findFirstRecordByFilter('user_marked_done', 'pattern_id = {:pid} && owner_id = {:uid}', {
        pid: patternId,
        uid: userId,
      });
      result.userMarkedDone = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
      };
    } catch (_) {}
  }

  return c.json(200, result);
});

routerAdd('GET', '/api/pattern-search', (c) => {
  // ─── Pattern search (list + accurate tag facet counts) ───────────────────────
  //
  // Powers the /pattern browse page. Replaces a client-side
  // `pocketbase.collection('patterns').getList(...)` call so that the sidebar's
  // tag counts can reflect the ENTIRE filtered result set instead of just the
  // current 20-item page (see search-v2.ts's Token type - the twin of the token
  // walk below).
  //
  // One token walk builds two representations at once so they can't drift:
  //   - a PocketBase filter-DSL string, used for the actual page of rows (via
  //     findRecordsByFilter - this gets sort/expand for free)
  //   - a parameterised raw-SQL WHERE fragment, used for the facet GROUP BY,
  //     since the filter DSL has no aggregate/GROUP BY support
  //
  // `tags` is stored as a JSON array column (no join table) - SQLite's
  // json_each() expands it so COUNT(*) ... GROUP BY counts every matching
  // pattern in the filtered set, not just one page.
  function buildPatternFilters(tokens, authorIdMap, blockedTags, aliasMap) {
    const dslParts = [];
    const sqlParts = [];
    const sqlParams = {};
    let n = 0;

    function bind(value) {
      const key = 'p' + n++;
      sqlParams[key] = value;
      return '{:' + key + '}';
    }

    function escDq(s) {
      return String(s).replace(/"/g, '\\"');
    }

    const idDslParts = [];
    const idSqlParts = [];

    for (const t of tokens || []) {
      if (t.type === 'text' || t.type === 'tag') {
        // Phase 3b (see TAG_REDESIGN_PROJECT_NOTES.md): resolve alias -> root
        // before matching, so a search for an alias finds patterns stored
        // under the root tag it points to. Falls back to the original value
        // when it isn't a known alias - safe for every text/tag token, not
        // just ones already suspected to be aliased (mirrors resolveTagAlias
        // in src/functions/database/tags.ts). text and tag tokens share this
        // branch because they already match the same `tags` field the same
        // way - both need the same resolution.
        const resolved = (aliasMap && aliasMap[String(t.value).toLowerCase()]) || t.value;
        // Wrap in literal quotes so the match hits a JSON element boundary -
        // '"cat"' matches ["cat"] but not ["suncatcher"].
        const b = bind(resolved);
        if (t.exclude) {
          dslParts.push(`(tags !~ '"${escDq(resolved)}"')`);
          sqlParts.push(`tags NOT LIKE '%"' || ${b} || '"%'`);
        } else {
          dslParts.push(`(tags ~ '"${escDq(resolved)}"')`);
          sqlParts.push(`tags LIKE '%"' || ${b} || '"%'`);
        }
      } else if (t.type === 'author') {
        // Phase 4 (see TAG_REDESIGN_PROJECT_NOTES.md): author names are now
        // baked into patterns.tags at save time (scripts/backfill-author-
        // tags.mjs, and the live-forward equivalent that keeps this true
        // for new patterns), the same as every other tag - so this matches
        // exactly like the text/tag branch above, including alias
        // resolution: a search for someone's old name, after an account
        // rename, still finds their patterns (see the account-rename hook
        // below, which adds the old name as an alias of the new one).
        //
        // This replaces the old author_manual/authors-relation matching,
        // and with it the authorIdMap name-to-id lookup that matching
        // needed - matching a name against `tags` needs no id resolution
        // at all. authorIdMap is still accepted as a parameter (the client
        // still sends it) but is no longer read here; retiring it fully is
        // a later Contract-pass cleanup, same as /api/resolve-author-ids -
        // see TAG_REDESIGN_PROJECT_NOTES.md.
        const resolved = (aliasMap && aliasMap[String(t.value).toLowerCase()]) || t.value;
        const b = bind(resolved);
        if (t.exclude) {
          dslParts.push(`(tags !~ '"${escDq(resolved)}"')`);
          sqlParts.push(`tags NOT LIKE '%"' || ${b} || '"%'`);
        } else {
          dslParts.push(`(tags ~ '"${escDq(resolved)}"')`);
          sqlParts.push(`tags LIKE '%"' || ${b} || '"%'`);
        }
      } else if (t.type === 'id') {
        const b = bind(t.value);
        // The facet query cross-joins json_each(patterns.tags), whose output
        // table has its OWN column named `id` (json_each's internal node id,
        // unrelated to the row's primary key). A bare `id` reference here is
        // ambiguous between `patterns.id` and that json_each column - SQLite
        // throws a parse error, which the facet query's try/catch swallows,
        // silently leaving tagFacets (and totalItems, via countRows) empty.
        // Qualifying with the table name resolves the ambiguity.
        if (t.exclude) {
          idDslParts.push(`(id != "${escDq(t.value)}")`);
          idSqlParts.push(`(patterns.id != ${b})`);
        } else {
          idDslParts.push(`(id = "${escDq(t.value)}")`);
          idSqlParts.push(`(patterns.id = ${b})`);
        }
      } else if (t.type === 'title') {
        const b = bind(t.value);
        if (t.exclude) {
          dslParts.push(`(name !~ "${escDq(t.value)}")`);
          sqlParts.push(`name NOT LIKE '%' || ${b} || '%'`);
        } else {
          dslParts.push(`(name ~ "${escDq(t.value)}")`);
          sqlParts.push(`name LIKE '%' || ${b} || '%'`);
        }
      } else if (t.type === 'description') {
        const b = bind(t.value);
        if (t.exclude) {
          dslParts.push(`(description !~ "${escDq(t.value)}")`);
          sqlParts.push(`description NOT LIKE '%' || ${b} || '%'`);
        } else {
          dslParts.push(`(description ~ "${escDq(t.value)}")`);
          sqlParts.push(`description LIKE '%' || ${b} || '%'`);
        }
      } else if (
        t.type === 'parts' ||
        t.type === 'width' ||
        t.type === 'height' ||
        t.type === 'filesize' ||
        t.type === 'width_in' ||
        t.type === 'height_in' ||
        t.type === 'width_cm' ||
        t.type === 'height_cm'
      ) {
        // width_in/height_in/width_cm/height_cm compare against the
        // precomputed size_width_in/size_height_in/size_width_cm/
        // size_height_cm columns instead of the native design_width/
        // design_height - these are unit-normalized at write time (see
        // convertToAllUnits below / the admin panel's save path), so the
        // filter is correct regardless of what unit the pattern was authored
        // in. Plain width/height stay pointed at the native columns - "use
        // whatever unit it was uploaded in".
        const column = {
          parts: 'pieces',
          width: 'design_width',
          height: 'design_height',
          filesize: 'pattern_file_size',
          width_in: 'size_width_in',
          height_in: 'size_height_in',
          width_cm: 'size_width_cm',
          height_cm: 'size_height_cm',
        }[t.type];
        const b = bind(t.value);
        dslParts.push(`(${column} ${t.operator} ${t.value})`);
        sqlParts.push(`${column} ${t.operator} ${b}`);
      }
    }

    if (idDslParts.length) dslParts.push(`(${idDslParts.join(' || ')})`);
    if (idSqlParts.length) sqlParts.push(`(${idSqlParts.join(' OR ')})`);

    // Silent, per-user tag exclusion - never surfaces as a visible token/chip,
    // just an invisible AND-ed constraint (mirrors the old buildBlockedTagsFilter).
    for (const tag of blockedTags || []) {
      if (!tag) continue;
      const b = bind(tag);
      dslParts.push(`(tags !~ '"${escDq(tag)}"')`);
      sqlParts.push(`tags NOT LIKE '%"' || ${b} || '"%'`);
    }

    return {
      dslFilter: dslParts.join(' && '),
      sqlWhere: sqlParts.length ? sqlParts.join(' AND ') : '1=1',
      sqlParams,
    };
  }

  const q = c.request.url.query();

  let tokens = [];
  let authorIdMap = {};
  let blockedTags = [];
  try {
    tokens = JSON.parse(q.get('tokens') || '[]');
  } catch (_) {}
  try {
    authorIdMap = JSON.parse(q.get('authorIdMap') || '{}');
  } catch (_) {}
  try {
    blockedTags = JSON.parse(q.get('blockedTags') || '[]');
  } catch (_) {}

  const sort = q.get('sort') || '-created';
  const page = Math.max(1, parseInt(q.get('pageNumber') || '1', 10));
  const perPage = 20;

  // These sort options rank "least"/"lowest"/"easiest" first (ascending) -
  // a 0 in that column means the pattern has no real data for it (never
  // rated, no difficulty votes, never favorited/completed), so it would
  // otherwise flood the front of the list ahead of patterns with actual
  // low-but-real values. Filter those out whenever sorting by one of these.
  //
  // The "no_ratings"/"unloved"/etc. sorts below are the opposite ask - show
  // ONLY the untouched patterns - so they filter to exactly 0 instead. Every
  // matching row ties at 0 on that column, so there's no meaningful order of
  // its own; dbSort supplies a real fallback field for findRecordsByFilter.
  const ZERO_FILTERED_SORTS = {
    avg_rating: { column: 'avg_rating', op: '>' },
    total_ratings: { column: 'total_ratings', op: '>' },
    avg_difficulty: { column: 'avg_difficulty', op: '>' },
    total_difficulty_ratings: { column: 'total_difficulty_ratings', op: '>' },
    favorite_count: { column: 'favorite_count', op: '>' },
    done_count: { column: 'done_count', op: '>' },
    no_ratings: { column: 'total_ratings', op: '=', dbSort: '-created' },
    no_difficulty_ratings: { column: 'total_difficulty_ratings', op: '=', dbSort: '-created' },
    unloved: { column: 'favorite_count', op: '=', dbSort: '-created' },
    never_completed: { column: 'done_count', op: '=', dbSort: '-created' },
  };
  const zeroFilter = ZERO_FILTERED_SORTS[sort];
  const dbSort = zeroFilter?.dbSort || sort;

  function countRows(table, whereSQL, params) {
    try {
      const rows = arrayOf(new DynamicModel({ count: 0 }));
      $app
        .db()
        .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
        .bind(params)
        .all(rows);
      return parseInt(rows[0]?.count || 0, 10);
    } catch (_) {
      return 0;
    }
  }

  // Reconstructs a readable label from the token walk (e.g. 'lighthouse
  // tag:ocean -author:jane width>10') for logging zero-result searches - see
  // the totalItems === 0 block below. Mirrors the prefixes parseRawInput
  // (search-v2.ts) accepts, so the label reads the same as what a user would
  // type, even though value tokens here can also arrive from UI clicks (tag
  // chips, author links) that never went through that parser.
  function formatSearchQueryLabel(tokens) {
    const parts = [];
    for (const t of tokens || []) {
      const sign = t.exclude ? '-' : '';
      if (t.type === 'text') parts.push(sign + t.value);
      else if (t.type === 'tag') parts.push(sign + 'tag:' + t.value);
      else if (t.type === 'author') parts.push(sign + 'author:' + t.value);
      else if (t.type === 'id') parts.push(sign + 'id:' + t.value);
      else if (t.type === 'title') parts.push(sign + 'title:' + t.value);
      else if (t.type === 'description') parts.push(sign + 'description:' + t.value);
      else if (t.operator) parts.push(t.type + t.operator + t.value);
    }
    return parts.join(' ').trim();
  }

  // Fire-and-forget: logs a search that matched nothing, so admins can see
  // what people want but can't find (see search_logs / search_logs_by_query
  // in pb_schema.json). Server-side, internal-access only (no public write
  // path) since this runs right where totalItems is already known - no
  // separate client call needed.
  function logZeroResultSearch(tokens) {
    try {
      console.log('>>>Zero Search Results found:', JSON.stringify(tokens));
      const label = formatSearchQueryLabel(tokens);
      if (!label) return;
      const collection = $app.findCollectionByNameOrId('search_logs');
      const record = new Record(collection, { query: label });
      $app.save(record);
    } catch (_) {}
  }

  // Phase 3b (see TAG_REDESIGN_PROJECT_NOTES.md): look up tag_aliases once
  // per request, server-side (never client-supplied), and hand the map into
  // buildPatternFilters. implied tags need no equivalent lookup here - they
  // are already baked into patterns.tags at save time (see
  // applyManualTagChange in src/functions/database/tags.ts), so search
  // never needs to know about the implied_tags graph, only aliases.
  let aliasMap = {};
  try {
    const aliasRecords = $app.findRecordsByFilter('tag_aliases', "id != ''", '', 0, 0);
    for (let i = 0; i < aliasRecords.length; i++) {
      const a = aliasRecords[i];
      aliasMap[a.getString('alias').toLowerCase()] = a.getString('target_tag');
    }
  } catch (_) {}

  const { dslFilter, sqlWhere, sqlParams } = buildPatternFilters(tokens, authorIdMap, blockedTags, aliasMap);
  const baseDsl =
    (dslFilter ? dslFilter + ' && ' : '') +
    'isDeleted = false && is_draft = false' +
    (zeroFilter ? ` && ${zeroFilter.column} ${zeroFilter.op} 0` : '');
  const baseSql =
    sqlWhere +
    ' AND isDeleted = 0 AND is_draft = 0' +
    (zeroFilter ? ` AND ${zeroFilter.column} ${zeroFilter.op} 0` : '');

  let items = [];
  try {
    const records = $app.findRecordsByFilter('patterns', baseDsl, dbSort, perPage, (page - 1) * perPage);
    $app.expandRecords(records, ['authors'], null);
    items = records;
  } catch (err) {
    return c.json(500, { error: 'search failed' });
  }

  const totalItems = countRows('patterns', baseSql, sqlParams);

  // Only an explicit search (at least one real token) that matched nothing
  // counts - the default "browse everything" view (tokens.length === 0)
  // isn't a search, and blockedTags alone silently filtering everything out
  // isn't something the searcher typed or clicked.
  if (totalItems === 0 && tokens.length > 0) {
    logZeroResultSearch(tokens);
  }

  const tagFacets = [];
  try {
    const rows = arrayOf(new DynamicModel({ tag: '', count: 0 }));
    $app
      .db()
      .newQuery(
        'SELECT je.value AS tag, COUNT(*) AS count FROM patterns, json_each(patterns.tags) je WHERE ' +
          baseSql +
          ' GROUP BY je.value ORDER BY count DESC',
      )
      .bind(sqlParams)
      .all(rows);
    for (let i = 0; i < rows.length; i++) {
      tagFacets.push({ tag: rows[i].tag, count: parseInt(rows[i].count, 10) });
    }
  } catch (_) {}

  // `items`/`totalItems` mirror the shape of a PocketBase SDK getList() response.
  // Records serialise via their own PublicExport (same fields/expand shape the
  // SDK's REST call already returns) - no manual field mapping needed here.
  return c.json(200, {
    page,
    perPage,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
    items,
    tagFacets,
  });
});

// An external cron service sends a POST to /api/sync-aggregates with the
// `X-Sync-Key` header to trigger the aggregate sync.

routerAdd('POST', '/api/sync-aggregates', (c) => {
  function r4(n) {
    return Math.round(n * 10000) / 10000;
  }

  function convertToAllUnits(value, unit) {
    const v = parseFloat(value) || 0;
    if (unit === 'cm') return { in: r4(v / 2.54), cm: r4(v), mm: r4(v * 10) };
    if (unit === 'mm') return { in: r4(v / 25.4), cm: r4(v / 10), mm: r4(v) };
    return { in: r4(v), cm: r4(v * 2.54), mm: r4(v * 25.4) };
  }

  try {
    const apiKey = c.request.header.get('X-Sync-Key');
    if (apiKey !== $os.getenv('WEBHOOK_API_KEY')) {
      return c.json(401, { error: 'unauthorized' });
    }

    const startTime = Date.now();

    // --- Build ratings map: pattern_id → { avg_rating, total_ratings } ---
    const ratingsRecords = $app.findRecordsByFilter('community_ratings', "id != ''", '', 0, 0);
    const ratingsMap = {};
    for (let i = 0; i < ratingsRecords.length; i++) {
      const r = ratingsRecords[i];
      ratingsMap[r.getString('pattern_id')] = {
        avg_rating: r.getFloat('average_rating'),
        total_ratings: r.getInt('total_ratings'),
      };
    }

    // --- Build difficulty map: pattern_id → { avg_difficulty, total_difficulty_ratings } ---
    const diffRecords = $app.findRecordsByFilter('community_difficulty_ratings', "id != ''", '', 0, 0);
    const diffMap = {};
    for (let i = 0; i < diffRecords.length; i++) {
      const r = diffRecords[i];
      diffMap[r.getString('pattern_id')] = {
        avg_difficulty: r.getFloat('average_rating'),
        total_difficulty_ratings: r.getInt('total_ratings'),
      };
    }

    // --- Build favorites map: pattern_id → count ---
    const favRecords = $app.findRecordsByFilter('user_favorites', "id != ''", '', 0, 0);
    const favMap = {};
    for (let i = 0; i < favRecords.length; i++) {
      const pid = favRecords[i].getString('pattern_id');
      favMap[pid] = (favMap[pid] || 0) + 1;
    }

    // --- Build done map: pattern_id → count ---
    const doneRecords = $app.findRecordsByFilter('user_marked_done', "id != ''", '', 0, 0);
    const doneMap = {};
    for (let i = 0; i < doneRecords.length; i++) {
      const pid = doneRecords[i].getString('pattern_id');
      doneMap[pid] = (doneMap[pid] || 0) + 1;
    }

    // --- Resolve storage path for file-size reads ---
    const patternsCollection = $app.findCollectionByNameOrId('patterns');
    const collectionId = patternsCollection.id;
    const dataDir = $app.dataDir();

    // --- Update each pattern with computed aggregates ---
    const patterns = $app.findRecordsByFilter('patterns', "id != ''", '', 0, 0);
    let updated = 0;

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < patterns.length; i++) {
        const p = patterns[i];
        const id = p.id;
        const ratingData = ratingsMap[id] || { avg_rating: 0, total_ratings: 0 };
        const diffData = diffMap[id] || { avg_difficulty: 0, total_difficulty_ratings: 0 };

        let tagCount = 0;
        try {
          const tags = JSON.parse(p.getString('tags'));
          tagCount = Array.isArray(tags) ? tags.length : 0;
        } catch (_) {}

        p.set('avg_rating', ratingData.avg_rating);
        p.set('total_ratings', ratingData.total_ratings);
        p.set('avg_difficulty', diffData.avg_difficulty);
        p.set('total_difficulty_ratings', diffData.total_difficulty_ratings);
        p.set('favorite_count', favMap[id] || 0);
        p.set('done_count', doneMap[id] || 0);
        p.set('tag_count', tagCount);

        // --- Dimension conversions ---
        // Enable this to run across the site. Otherwise this happens normally in the admin panel
        /*const wConverted = convertToAllUnits(p.getFloat('design_width'), p.getString('design_width_unit'));
        const hConverted = convertToAllUnits(p.getFloat('design_height'), p.getString('design_height_unit'));
        p.set('size_width_in', wConverted.in);
        p.set('size_width_cm', wConverted.cm);
        p.set('size_width_mm', wConverted.mm);
        p.set('size_height_in', hConverted.in);
        p.set('size_height_cm', hConverted.cm);
        p.set('size_height_mm', hConverted.mm);*/

        // --- File size (best-effort,  silently skipped if the file is missing) ---
        // Enable this to run across the site. Otherwise this happens normally in the admin panel
        /*const fileName = p.getString('pattern_file');
        if (fileName) {
          try {
            const filePath = dataDir + '/storage/' + collectionId + '/' + id + '/' + fileName;
            const stat = $os.stat(filePath);
            p.set('pattern_file_size', stat.size());
          } catch (_) {}
        }*/

        txApp.save(p);
        updated++;
      }
    });

    return c.json(200, { ok: true, updated, elapsed_ms: Date.now() - startTime });
  } catch (error) {
    console.log('>>>Error', error.message);
    return c.json(500, { error: 'something went wrong', message: error?.message });
  }
});

// An external cron service sends a POST to /api/sync-tag-catalog with the
// `X-Sync-Key` header, same mechanism as /api/sync-aggregates above (reuses
// the same WEBHOOK_API_KEY - no separate secret to provision). Point
// whatever cron service already calls /api/sync-aggregates at this endpoint
// too, on a similar schedule (e.g. daily).
//
// Phase 1 of the tag redesign (see TAG_REDESIGN_PROJECT_NOTES.md):
// scripts/backfill-tags-v2.mjs does the one-time initial population of the
// tags_v2 collection from patterns.tags; this endpoint is what keeps it
// caught up with every tag typed after that backfill ran. Finds any tag
// string in use on a published pattern that's missing from tags_v2, and
// inserts a default row for it (type left empty, meaning General). Safe to
// call again after a missed run - it only ever creates what's still
// missing. Two genuinely concurrent runs (e.g. a slow-response cron retry
// overlapping the original) both compute from the same snapshot and could
// both attempt to create a row for the same new tag - tags_v2's unique
// index on `tag` stops a duplicate row from ever actually existing, and
// each create below is individually try/caught so one such collision can't
// roll back the rest of an otherwise-successful run. Corrected via code
// review, see TAG_REDESIGN_PROJECT_NOTES.md - this used to claim
// overlapping runs "can't create duplicates" at all, which the unique
// index backstops but the snapshot-then-transact approach here doesn't
// prevent on its own.
routerAdd('POST', '/api/sync-tag-catalog', (c) => {
  // Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
  // JSVM can't import a .ts file from src/ directly - keep this copy in
  // sync if the canonical rule ever changes. (Duplicated for the same
  // reason in scripts/backfill-tags-v2.mjs and scripts/audit-duplicate-
  // author-names.mjs.)
  function normalizeTagName(raw) {
    return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Mirrors slugifyTag() in src/functions/utilities/slugify-tag.ts - same
  // cross-runtime-boundary reasoning as normalizeTagName above.
  function slugifyTag(tag) {
    return tag
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  try {
    const apiKey = c.request.header.get('X-Sync-Key');
    if (apiKey !== $os.getenv('WEBHOOK_API_KEY')) {
      return c.json(401, { error: 'unauthorized' });
    }

    const startTime = Date.now();

    const existingTagRows = $app.findRecordsByFilter('tags_v2', "id != ''", '', 0, 0);
    const existingTagSet = {};
    const usedSlugs = {};
    for (let i = 0; i < existingTagRows.length; i++) {
      existingTagSet[existingTagRows[i].getString('tag')] = true;
      usedSlugs[existingTagRows[i].getString('slug')] = true;
    }

    const patterns = $app.findRecordsByFilter('patterns', 'isDeleted = false && is_draft = false', '', 0, 0);

    // Walk every published pattern's tags once, normalizing as we go, and
    // split into "already in tags_v2" vs "needs a new row" - same
    // distinct-tag collection shape as scripts/backfill-tags-v2.mjs.
    const distinctSeen = {};
    const toCreate = [];
    for (let i = 0; i < patterns.length; i++) {
      let tags = [];
      try {
        tags = JSON.parse(patterns[i].getString('tags')) || [];
      } catch (_) {
        continue;
      }
      for (let j = 0; j < tags.length; j++) {
        const raw = tags[j];
        if (!raw || !String(raw).trim()) continue;
        const norm = normalizeTagName(raw);
        if (distinctSeen[norm]) continue;
        distinctSeen[norm] = true;
        if (!existingTagSet[norm]) toCreate.push(norm);
      }
    }
    toCreate.sort();

    const collection = $app.findCollectionByNameOrId('tags_v2');
    const skippedEmptySlug = [];
    const skippedErrors = [];
    let created = 0;

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < toCreate.length; i++) {
        const tag = toCreate[i];
        const baseSlug = slugifyTag(tag);
        if (!baseSlug) {
          // Extremely rare (a tag made entirely of punctuation, say) - skip
          // and report it rather than guessing at a slug. An admin can add
          // it by hand via the tag manager afterward.
          skippedEmptySlug.push(tag);
          continue;
        }
        // Disambiguate a slug collision the same way the backfill script
        // and syncSatelliteTablesForOp (tags.tsx) both do: append -2, -3...
        let candidate = baseSlug;
        let suffix = 2;
        while (usedSlugs[candidate]) {
          candidate = baseSlug + '-' + suffix++;
        }
        usedSlugs[candidate] = true;

        // Individually try/caught so one collision (e.g. a genuinely
        // concurrent overlapping run hitting tags_v2's unique index on
        // `tag` first) can't roll back the rest of this otherwise-valid
        // batch - see this endpoint's own top comment.
        try {
          const record = new Record(collection, { tag: tag, slug: candidate, previous_slugs: [] });
          txApp.save(record);
          created++;
        } catch (saveErr) {
          skippedErrors.push(tag);
          console.log('>>>sync-tag-catalog: failed to create row for tag', tag, saveErr.message);
        }
      }
    });

    return c.json(200, {
      ok: true,
      distinct_tags_scanned: Object.keys(distinctSeen).length,
      created,
      skipped_empty_slug: skippedEmptySlug,
      skipped_errors: skippedErrors,
      elapsed_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.log('>>>Error', error.message);
    return c.json(500, { error: 'something went wrong', message: error?.message });
  }
});

// Phase 4 (see TAG_REDESIGN_PROJECT_NOTES.md): keeps author tags current
// for a pattern saved or edited after scripts/backfill-author-tags.mjs's
// one-time run. Mirrors that script: find or create an Author-type tags_v2
// row per distinct author name, cascade the resolved name into every
// pattern that credits them. Runs as a periodic sync instead of a hook on
// the pattern-save path, the same reasoning /api/sync-tag-catalog above
// already documents for staying off that path.
//
// Unlike the one-time backfill, this endpoint never auto-resolves a name
// that collides with an existing, differently-typed tag (a brand-new
// author who happens to share a name with an existing plain tag, say) - no
// human reviews a dry run here first, so a real collision is skipped and
// reported instead of guessed at. This matches the "skip and let an admin
// resolve it" rule the account-rename hook below also follows.
routerAdd('POST', '/api/sync-author-tags', (c) => {
  // Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
  // JSVM can't import a .ts file from src/ directly - keep this copy in
  // sync if the canonical rule ever changes. (Duplicated for the same
  // reason elsewhere in this file and in scripts/backfill-author-tags.mjs.)
  function normalizeTagName(raw) {
    return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Mirrors slugifyTag() in src/functions/utilities/slugify-tag.ts.
  function slugifyTag(tag) {
    return tag
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  try {
    const apiKey = c.request.header.get('X-Sync-Key');
    if (apiKey !== $os.getenv('WEBHOOK_API_KEY')) {
      return c.json(401, { error: 'unauthorized' });
    }

    const startTime = Date.now();

    const authorTypeRows = $app.findRecordsByFilter('tag_types', "name = 'Author'", '', 1, 0);
    let authorTypeId = authorTypeRows.length ? authorTypeRows[0].id : '';

    const userRows = $app.findRecordsByFilter('users', "id != ''", '', 0, 0);
    const userNameById = {};
    for (let i = 0; i < userRows.length; i++) {
      userNameById[userRows[i].id] = userRows[i].getString('name');
    }

    const patterns = $app.findRecordsByFilter('patterns', 'isDeleted = false && is_draft = false', '', 0, 0);

    const existingTagRows = $app.findRecordsByFilter('tags_v2', "id != ''", '', 0, 0);
    const tagRowByNorm = {};
    const usedSlugs = {};
    for (let i = 0; i < existingTagRows.length; i++) {
      tagRowByNorm[existingTagRows[i].getString('tag')] = existingTagRows[i];
      usedSlugs[existingTagRows[i].getString('slug')] = true;
    }

    const manualAuthorRows = $app.findRecordsByFilter('manual_authors', "id != ''", '', 0, 0);

    // normalized -> { linkedUserId: string, patternIds: [] } - same shape as
    // scripts/backfill-author-tags.mjs's identities map, rebuilt fresh every
    // run rather than tracked incrementally, matching /api/sync-tag-catalog's
    // own "just rescan everything, it's cheap enough" approach.
    const identities = {};
    for (let i = 0; i < patterns.length; i++) {
      let authors = [];
      let authorManual = [];
      try {
        authors = JSON.parse(patterns[i].getString('authors')) || [];
      } catch (_) {}
      try {
        authorManual = JSON.parse(patterns[i].getString('author_manual')) || [];
      } catch (_) {}

      for (let j = 0; j < authors.length; j++) {
        const name = userNameById[authors[j]];
        if (!name) continue;
        const norm = normalizeTagName(name);
        if (!identities[norm]) identities[norm] = { linkedUserId: authors[j], patternIds: [] };
        identities[norm].patternIds.push(patterns[i].id);
      }
      for (let j = 0; j < authorManual.length; j++) {
        const raw = authorManual[j];
        if (!raw || !String(raw).trim()) continue;
        const norm = normalizeTagName(String(raw));
        if (!identities[norm]) identities[norm] = { linkedUserId: '', patternIds: [] };
        identities[norm].patternIds.push(patterns[i].id);
      }
    }

    const conflicted = {}; // norm -> true - a real collision, skip cascading these this run
    const toCreate = []; // { norm, slug, linkedUserId }
    const toUpdateLink = []; // { row, linkedUserId } - already Author-typed, just missing linked_user
    const tagIdByNorm = {}; // resolved id for every non-conflicted identity, new or existing

    const norms = Object.keys(identities).sort();
    for (let i = 0; i < norms.length; i++) {
      const norm = norms[i];
      const identity = identities[norm];
      const existingRow = tagRowByNorm[norm];

      if (existingRow) {
        if (authorTypeId && existingRow.getString('type') !== authorTypeId) {
          conflicted[norm] = true; // exists as some other type - a human needs to look at this one
          continue;
        }
        tagIdByNorm[norm] = existingRow.id;
        if (identity.linkedUserId && existingRow.getString('linked_user') !== identity.linkedUserId) {
          toUpdateLink.push({ row: existingRow, linkedUserId: identity.linkedUserId });
        }
        continue;
      }

      const baseSlug = slugifyTag(norm);
      if (!baseSlug) {
        conflicted[norm] = true; // no safe slug - same "skip, let an admin handle it" rule
        continue;
      }
      let candidate = baseSlug;
      let suffix = 2;
      while (usedSlugs[candidate]) candidate = baseSlug + '-' + suffix++;
      usedSlugs[candidate] = true;
      toCreate.push({ norm: norm, slug: candidate, linkedUserId: identity.linkedUserId });
    }

    // manual_authors profiles not yet linked, whose name matches a
    // (non-conflicted) identity found above.
    const profilesToLink = [];
    for (let i = 0; i < manualAuthorRows.length; i++) {
      const row = manualAuthorRows[i];
      if (row.getString('linked_tag')) continue;
      const norm = normalizeTagName(row.getString('name') || '');
      if (!norm || conflicted[norm] || !identities[norm]) continue;
      profilesToLink.push({ row: row, norm: norm });
    }

    const skippedErrors = [];
    let tagsCreated = 0;
    let tagsUpdated = 0;
    let profilesLinked = 0;
    let patternsUpdated = 0;

    $app.runInTransaction((txApp) => {
      if (!authorTypeId) {
        try {
          const typeCollection = $app.findCollectionByNameOrId('tag_types');
          const typeRecord = new Record(typeCollection, { name: 'Author', display_mode: 'author' });
          txApp.save(typeRecord);
          authorTypeId = typeRecord.id;
        } catch (saveErr) {
          skippedErrors.push('create tag_types "Author": ' + saveErr.message);
          console.log('>>>sync-author-tags: failed to create Author tag type', saveErr.message);
        }
      }

      if (authorTypeId) {
        const tagsCollection = $app.findCollectionByNameOrId('tags_v2');
        for (let i = 0; i < toCreate.length; i++) {
          const t = toCreate[i];
          try {
            const record = new Record(tagsCollection, {
              tag: t.norm,
              slug: t.slug,
              previous_slugs: [],
              type: authorTypeId,
              linked_user: t.linkedUserId || '',
            });
            txApp.save(record);
            tagIdByNorm[t.norm] = record.id;
            tagsCreated++;
          } catch (saveErr) {
            conflicted[t.norm] = true; // couldn't create it - don't cascade it this run either
            skippedErrors.push('create tag "' + t.norm + '": ' + saveErr.message);
            console.log('>>>sync-author-tags: failed to create tag', t.norm, saveErr.message);
          }
        }

        for (let i = 0; i < toUpdateLink.length; i++) {
          const u = toUpdateLink[i];
          try {
            u.row.set('linked_user', u.linkedUserId);
            txApp.save(u.row);
            tagsUpdated++;
          } catch (saveErr) {
            skippedErrors.push('link user on tag "' + u.row.getString('tag') + '": ' + saveErr.message);
            console.log('>>>sync-author-tags: failed to set linked_user', u.row.getString('tag'), saveErr.message);
          }
        }
      }

      for (let i = 0; i < profilesToLink.length; i++) {
        const p = profilesToLink[i];
        const tagId = tagIdByNorm[p.norm];
        if (!tagId) continue;
        try {
          p.row.set('linked_tag', tagId);
          txApp.save(p.row);
          profilesLinked++;
        } catch (saveErr) {
          skippedErrors.push('link manual_authors "' + p.row.getString('name') + '": ' + saveErr.message);
          console.log('>>>sync-author-tags: failed to link manual_authors', p.row.getString('name'), saveErr.message);
        }
      }

      // Cascade every non-conflicted identity's resolved tag onto every
      // pattern that credits it - "add, never remove," same rule the
      // backfill script uses.
      const patternById = {};
      for (let i = 0; i < patterns.length; i++) patternById[patterns[i].id] = patterns[i];

      const missingByPattern = {}; // patternId -> [] of tag strings to add
      for (let i = 0; i < norms.length; i++) {
        const norm = norms[i];
        if (conflicted[norm]) continue;
        const tagId = tagIdByNorm[norm];
        if (!tagId) continue; // creation failed above, or never resolved
        const identity = identities[norm];
        for (let j = 0; j < identity.patternIds.length; j++) {
          const pid = identity.patternIds[j];
          if (!missingByPattern[pid]) missingByPattern[pid] = [];
          missingByPattern[pid].push(norm);
        }
      }

      const patternIds = Object.keys(missingByPattern);
      for (let i = 0; i < patternIds.length; i++) {
        const pid = patternIds[i];
        const record = patternById[pid];
        if (!record) continue;
        let currentTags = [];
        try {
          currentTags = JSON.parse(record.getString('tags')) || [];
        } catch (_) {}
        const currentTagSet = {};
        for (let j = 0; j < currentTags.length; j++) currentTagSet[currentTags[j]] = true;
        const toAdd = missingByPattern[pid].filter(function (n) {
          return !currentTagSet[n];
        });
        if (toAdd.length === 0) continue;
        try {
          record.set('tags', currentTags.concat(toAdd));
          txApp.save(record);
          patternsUpdated++;
        } catch (saveErr) {
          skippedErrors.push('update pattern ' + pid + ': ' + saveErr.message);
          console.log('>>>sync-author-tags: failed to update pattern', pid, saveErr.message);
        }
      }
    });

    return c.json(200, {
      ok: true,
      distinct_authors_scanned: norms.length,
      tags_created: tagsCreated,
      tags_updated: tagsUpdated,
      profiles_linked: profilesLinked,
      patterns_updated: patternsUpdated,
      skipped_type_conflicts: Object.keys(conflicted),
      skipped_errors: skippedErrors,
      elapsed_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.log('>>>Error', error.message);
    return c.json(500, { error: 'something went wrong', message: error?.message });
  }
});

// Consolidates all profile-page data fetches into a single HTTP call.
// Each section is independently try/caught so one failure doesn't block others.
routerAdd('GET', '/api/profile-data', (c) => {
  const q = c.request.url.query();
  const userId = q.get('userId') || '';
  if (!userId) return c.json(400, { error: 'userId is required' });

  // Banned accounts have no public profile - this hides their gallery and all
  // activity in one place. Unknown ids fall through to the same 404.
  try {
    const profileUser = $app.findRecordById('users', userId);
    if (profileUser.getBool('banned')) return c.json(404, { error: 'not found' });
  } catch (_) {
    return c.json(404, { error: 'not found' });
  }

  const PER_PAGE = 10;
  const PER_PAGE_ARTIST = 8;
  const favPage = Math.max(1, parseInt(q.get('favPage') || '1', 10));
  const donePage = Math.max(1, parseInt(q.get('donePage') || '1', 10));
  const ratingPage = Math.max(1, parseInt(q.get('ratingPage') || '1', 10));
  const diffPage = Math.max(1, parseInt(q.get('diffPage') || '1', 10));
  const galleryPage = Math.max(1, parseInt(q.get('galleryPage') || '1', 10));
  const colsPage = Math.max(1, parseInt(q.get('colsPage') || '1', 10));
  const artistPage = Math.max(1, parseInt(q.get('artistPage') || '1', 10));
  const isOwner = q.get('isOwner') === 'true';
  const isArtist = q.get('isArtist') === 'true';

  // Patterns collection ID is needed by the client to build image URLs
  let patternsColId = '';
  try {
    patternsColId = $app.findCollectionByNameOrId('patterns').id;
  } catch (_) {}

  // Parameterised COUNT using raw SQL (safe — table names are hardcoded, only userId is bound)
  function countRows(table, whereSQL, params) {
    try {
      const rows = arrayOf(new DynamicModel({ count: 0 }));
      $app
        .db()
        .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
        .bind(params)
        .all(rows);
      return parseInt(rows[0]?.count || 0, 10);
    } catch (_) {
      return 0;
    }
  }

  function buildPaged(totalItems, page, perPage, items) {
    return { page, perPage, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)), items };
  }

  function serializePatternExpand(r) {
    if (!r) return null;
    return {
      id: r.id,
      collectionId: patternsColId,
      name: r.getString('name'),
      pattern_file: r.getString('pattern_file'),
      pattern_file_external: r.getBool('pattern_file_external'),
      description: r.getString('description'),
    };
  }

  // Favorites / Done / Ratings / Difficulty all share the same shape
  function fetchActivity(table, page) {
    const where = "owner_id = {:uid} AND pattern_id != ''";
    const filter = "owner_id = {:uid} && pattern_id != ''";
    const params = { uid: userId };
    const total = countRows(table, where, params);
    const offset = (page - 1) * PER_PAGE;
    const items = [];
    try {
      const records = $app.findRecordsByFilter(table, filter, '-created', PER_PAGE, offset, params);
      $app.expandRecords(records, ['pattern_id'], null);
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const exp = r.expandedOne('pattern_id');
        items.push({
          id: r.id,
          collectionId: '',
          owner_id: r.getString('owner_id'),
          pattern_id: r.getString('pattern_id'),
          rating: r.getFloat('rating'),
          rating_notes: r.getString('rating_notes'),
          created: r.getString('created'),
          updated: r.getString('updated'),
          expand: { pattern_id: serializePatternExpand(exp) },
        });
      }
    } catch (_) {}
    return buildPaged(total, page, PER_PAGE, items);
  }

  function fetchGallery(page) {
    const total = countRows('gallery', 'owner_id = {:uid}', { uid: userId });
    const offset = (page - 1) * PER_PAGE;
    const items = [];
    try {
      const records = $app.findRecordsByFilter('gallery', 'owner_id = {:uid}', '-created', PER_PAGE, offset, {
        uid: userId,
      });
      $app.expandRecords(records, ['pattern_id'], null);
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const exp = r.expandedOne('pattern_id');
        items.push({
          id: r.id,
          collectionId: '',
          collectionName: 'gallery',
          title: r.getString('title'),
          description: r.getString('description'),
          src: r.getString('src'),
          imagekit_file_id: r.getString('imagekit_file_id'),
          owner_id: r.getString('owner_id'),
          pattern_id: r.getString('pattern_id'),
          created: r.getString('created'),
          updated: r.getString('updated'),
          expand: { pattern_id: serializePatternExpand(exp) },
        });
      }
    } catch (_) {}
    return buildPaged(total, page, PER_PAGE, items);
  }

  function fetchCollections(page) {
    const total = countRows('user_collections', 'owner_id = {:uid}', { uid: userId });
    const offset = (page - 1) * PER_PAGE;
    const items = [];
    try {
      const records = $app.findRecordsByFilter('user_collections', 'owner_id = {:uid}', '-created', PER_PAGE, offset, {
        uid: userId,
      });
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        items.push({
          id: r.id,
          collectionId: '',
          collectionName: 'user_collections',
          name: r.getString('name'),
          description: r.getString('description'),
          owner_id: r.getString('owner_id'),
          patterns: Array.isArray(r.get('patterns')) ? r.get('patterns') : [],
          created: r.getString('created'),
          updated: r.getString('updated'),
        });
      }
    } catch (_) {}
    return buildPaged(total, page, PER_PAGE, items);
  }

  function fetchFollowedCollections() {
    if (!isOwner) return null;
    const items = [];
    try {
      const records = $app.findRecordsByFilter('user_followed_collections', 'owner_id = {:uid}', '-created', 0, 0, {
        uid: userId,
      });
      $app.expandRecords(records, ['collection_id'], null);
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const col = r.expandedOne('collection_id');
        items.push({
          id: r.id,
          collectionId: '',
          collectionName: 'user_followed_collections',
          owner_id: r.getString('owner_id'),
          collection_id: r.getString('collection_id'),
          last_checked_updated: r.getString('last_checked_updated'),
          created: r.getString('created'),
          updated: r.getString('updated'),
          expand: col
            ? {
                collection_id: {
                  id: col.id,
                  collectionId: '',
                  collectionName: 'user_collections',
                  name: col.getString('name'),
                  description: col.getString('description'),
                  owner_id: col.getString('owner_id'),
                  patterns: Array.isArray(col.get('patterns')) ? col.get('patterns') : [],
                  created: col.getString('created'),
                  updated: col.getString('updated'),
                },
              }
            : null,
        });
      }
    } catch (_) {}
    return items;
  }

  function fetchArtistPatterns(page) {
    if (!isArtist) return null;
    // Count patterns where userId appears in the JSON authors array
    const total = countRows('patterns', 'authors LIKE {:likeUid} AND isDeleted = 0 AND is_draft = 0', {
      likeUid: '%"' + userId + '"%',
    });
    const offset = (page - 1) * PER_PAGE_ARTIST;
    const items = [];
    try {
      const records = $app.findRecordsByFilter(
        'patterns',
        'authors ~ {:uid} && isDeleted = false && is_draft = false',
        '-created',
        PER_PAGE_ARTIST,
        offset,
        { uid: userId },
      );
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        items.push({
          id: r.id,
          collectionId: patternsColId,
          name: r.getString('name'),
          pattern_file: r.getString('pattern_file'),
          pattern_file_external: r.getBool('pattern_file_external'),
          pieces: r.getInt('pieces'),
        });
      }
    } catch (_) {}
    return buildPaged(total, page, PER_PAGE_ARTIST, items);
  }

  try {
    return c.json(200, {
      favorites: fetchActivity('user_favorites', favPage),
      done: fetchActivity('user_marked_done', donePage),
      ratings: fetchActivity('user_ratings', ratingPage),
      difficulty: fetchActivity('user_difficulty_ratings', diffPage),
      gallery: fetchGallery(galleryPage),
      collections: fetchCollections(colsPage),
      followedCollections: fetchFollowedCollections(),
      artistPatterns: fetchArtistPatterns(artistPage),
    });
  } catch (err) {
    console.log('>>>profile-data error', err?.message);
    return c.json(500, { error: 'internal error' });
  }
});

// Consolidates the 4 sidebar-badge lookups the admin layout fires on every
// single space-command page into one call.
routerAdd(
  'GET',
  '/api/admin-nav-badges',
  (c) => {
    function countRows(table, whereSQL, params) {
      try {
        const rows = arrayOf(new DynamicModel({ count: 0 }));
        $app
          .db()
          .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
          .bind(params || {})
          .all(rows);
        return parseInt(rows[0]?.count || 0, 10);
      } catch (_) {
        return 0;
      }
    }

    return c.json(200, {
      complaints: countRows('complaints', "reviewed = 0 AND pattern_id != ''"),
      contentReports: countRows('content_reports', 'reviewed = 0'),
      contactSubmissions: countRows('contact_submissions', 'reviewed = 0'),
      userSubmissions: countRows('user_submitted_patterns', 'hidden = 0'),
    });
  },
  $apis.requireAuth('admins'),
);

// Consolidates the 8 dashboard summary cards + the authors table on the
// space-command home page into one call. Each section is independently
// try/caught so one failure doesn't block the others from returning.
routerAdd(
  'GET',
  '/api/space-command-dashboard',
  (c) => {
    function countRows(table, whereSQL, params) {
      try {
        const rows = arrayOf(new DynamicModel({ count: 0 }));
        $app
          .db()
          .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
          .bind(params || {})
          .all(rows);
        return parseInt(rows[0]?.count || 0, 10);
      } catch (_) {
        return 0;
      }
    }

    const result = {
      users: { totalItems: 0, newestCreated: null },
      patterns: { totalItems: 0, newestCreated: null },
      tags: { totalItems: 0, topTag: null },
      complaints: { totalItems: 0, latestCreated: null },
      faq: { totalItems: 0, lastUpdated: null },
      wiki: { categoryCount: 0, pageCount: 0, lastUpdated: null },
      storeLocations: { totalItems: 0 },
      sets: { totalItems: 0, published: 0, draft: 0 },
      authors: [],
    };

    try {
      result.users.totalItems = countRows('users', "id != ''");
      const newest = $app.findRecordsByFilter('users', "id != ''", '-created', 1, 0);
      if (newest.length > 0) result.users.newestCreated = newest[0].getString('created');
    } catch (_) {}

    try {
      result.complaints.totalItems = countRows('complaints', "reviewed = 0 AND pattern_id != ''");
      const latest = $app.findRecordsByFilter('complaints', "reviewed = false && pattern_id != ''", '-created', 1, 0);
      if (latest.length > 0) result.complaints.latestCreated = latest[0].getString('created');
    } catch (_) {}

    try {
      result.patterns.totalItems = countRows('patterns', 'isDeleted = 0');
      const newest = $app.findRecordsByFilter('patterns', 'isDeleted = false', '-created', 1, 0);
      if (newest.length > 0) result.patterns.newestCreated = newest[0].getString('created');
    } catch (_) {}

    try {
      result.tags.totalItems = countRows('tags', "id != ''");
      const top = $app.findRecordsByFilter('tags', "id != ''", '-count', 1, 0);
      if (top.length > 0) result.tags.topTag = { tag: top[0].getString('tag'), count: top[0].getInt('count') };
    } catch (_) {}

    try {
      result.faq.totalItems = countRows('faq', "id != ''");
      const latest = $app.findRecordsByFilter('faq', "id != ''", '-updated', 1, 0);
      if (latest.length > 0) result.faq.lastUpdated = latest[0].getString('updated');
    } catch (_) {}

    try {
      result.wiki.categoryCount = countRows('wiki_categories', "id != ''");
      result.wiki.pageCount = countRows('wiki_pages', "id != ''");
      const latest = $app.findRecordsByFilter('wiki_pages', "id != ''", '-updated', 1, 0);
      if (latest.length > 0) result.wiki.lastUpdated = latest[0].getString('updated');
    } catch (_) {}

    try {
      result.storeLocations.totalItems = countRows('store_locations', "id != ''");
    } catch (_) {}

    try {
      result.sets.totalItems = countRows('pattern_sets', "id != ''");
      result.sets.published = countRows('pattern_sets', 'is_published = 1');
      result.sets.draft = result.sets.totalItems - result.sets.published;
    } catch (_) {}

    try {
      // The `authors` view derives its columns from JSON expressions, so the
      // hooks API reads them as raw JSON-encoded text: getString('tag') returns
      // '"WarlordAxin"' (quotes included), a NULL user_id comes back as the
      // string 'null', and getInt() on those columns returns 0. The records
      // REST API deserialises these properly; mirror that here so the client
      // sees plain values (and manual authors keep an empty user_id).
      function fromJsonText(s) {
        if (!s || s === 'null') return '';
        if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
          try {
            return JSON.parse(s);
          } catch (_) {
            return s.slice(1, -1);
          }
        }
        return s;
      }
      function jsonInt(s) {
        const n = parseInt(fromJsonText(s), 10);
        return isNaN(n) ? 0 : n;
      }

      const records = $app.findRecordsByFilter('authors', "id != ''", '', 0, 0);
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        result.authors.push({
          id: r.id,
          tag: fromJsonText(r.getString('tag')),
          count: jsonInt(r.getString('count')),
          manual: jsonInt(r.getString('manual')),
          user_id: fromJsonText(r.getString('user_id')),
        });
      }
    } catch (_) {}

    return c.json(200, result);
  },
  $apis.requireAuth('admins'),
);

// ─── Database stats snapshots ──────────────────────────────────────────────
//
// Daily historical record of site-wide metrics for the admin "Database
// Stats" page and a curated public subset on /community. computeDatabaseStats-
// Snapshot/saveDatabaseStatsSnapshot are intentionally duplicated in full
// across both routes below (per the file NOTICE at the top: no root-level
// functions/variables - PocketBase doesn't support them, so every helper has
// to live inside the routerAdd callback that uses it). If you change one
// copy, change both - they must stay byte-identical.

// A cloud-hosted cron tool sends a POST to /api/sync-database-stats with the
// X-Sync-Key header once a day, plus a backup run a bit later the same day in
// case the first one is missed (e.g. the PocketBase host being briefly
// offline) - there's no retry once that window passes, so the backup is the
// retry. A day with both runs ends up with 2 rows; the frontend (see
// dedupeSnapshotsByDay in src/functions/database/database-stats.ts) collapses
// same-day duplicates down to the later one before charting, so a duplicate
// here is harmless. Mirrors /api/sync-aggregates' auth exactly.
routerAdd('POST', '/api/sync-database-stats', (c) => {
  function computeDatabaseStatsSnapshot() {
    function countRows(table, whereSQL, params) {
      try {
        const rows = arrayOf(new DynamicModel({ count: 0 }));
        $app
          .db()
          .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
          .bind(params || {})
          .all(rows);
        return parseInt(rows[0]?.count || 0, 10);
      } catch (_) {
        return 0;
      }
    }

    function avgField(table, field, whereSQL, params) {
      try {
        const rows = arrayOf(new DynamicModel({ avg: 0 }));
        $app
          .db()
          .newQuery('SELECT AVG(' + field + ') as avg FROM ' + table + ' WHERE ' + whereSQL)
          .bind(params || {})
          .all(rows);
        return parseFloat(rows[0]?.avg || 0);
      } catch (_) {
        return 0;
      }
    }

    // Matches PocketBase's own stored `created` format ("YYYY-MM-DD HH:mm:ss.SSSZ")
    // so the trailing-7-day filters below compare like-for-like.
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');

    const exportsByHour = new Array(24).fill(0);
    try {
      const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
      $app
        .db()
        .newQuery(
          "SELECT strftime('%H', created) AS bucket, COUNT(*) AS count FROM analytics_exports " +
            'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
        )
        .bind({ cutoff })
        .all(rows);
      for (let i = 0; i < rows.length; i++) {
        const idx = parseInt(rows[i].bucket, 10);
        if (idx >= 0 && idx < 24) exportsByHour[idx] = parseInt(rows[i].count, 10) || 0;
      }
    } catch (_) {}

    const exportsByWeekday = new Array(7).fill(0);
    try {
      const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
      $app
        .db()
        .newQuery(
          "SELECT strftime('%w', created) AS bucket, COUNT(*) AS count FROM analytics_exports " +
            'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
        )
        .bind({ cutoff })
        .all(rows);
      for (let i = 0; i < rows.length; i++) {
        const idx = parseInt(rows[i].bucket, 10);
        if (idx >= 0 && idx < 7) exportsByWeekday[idx] = parseInt(rows[i].count, 10) || 0;
      }
    } catch (_) {}

    const exportsByFileType = { pdf: 0, png: 0, jpg: 0, webp: 0, svg: 0 };
    try {
      const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
      $app
        .db()
        .newQuery(
          'SELECT file_type AS bucket, COUNT(*) AS count FROM analytics_exports ' +
            'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
        )
        .bind({ cutoff })
        .all(rows);
      for (let i = 0; i < rows.length; i++) {
        const key = rows[i].bucket;
        if (Object.prototype.hasOwnProperty.call(exportsByFileType, key)) {
          exportsByFileType[key] = parseInt(rows[i].count, 10) || 0;
        }
      }
    } catch (_) {}

    const exportsByFlow = {
      cricut: 0,
      'craft cutter': 0,
      printing: 0,
      'saving for later': 0,
      editing: 0,
      generic: 0,
    };
    try {
      const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
      $app
        .db()
        .newQuery(
          'SELECT flow AS bucket, COUNT(*) AS count FROM analytics_exports ' +
            'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
        )
        .bind({ cutoff })
        .all(rows);
      for (let i = 0; i < rows.length; i++) {
        const key = rows[i].bucket;
        if (Object.prototype.hasOwnProperty.call(exportsByFlow, key)) {
          exportsByFlow[key] = parseInt(rows[i].count, 10) || 0;
        }
      }
    } catch (_) {}

    // Backs the retro footer visitor counter (see /api/count-visit below) - one
    // row, one running total, incremented once per browser session.
    let totalSiteVisits = 0;
    try {
      const rows = arrayOf(new DynamicModel({ count: 0 }));
      $app.db().newQuery("SELECT count FROM counters WHERE key = 'visits' LIMIT 1").all(rows);
      totalSiteVisits = parseInt(rows[0]?.count || 0, 10);
    } catch (_) {}

    // Trailing 30 days (not all-time) so this actually moves over time - an
    // all-time leaderboard would be frozen solid with the same handful of
    // long-popular patterns forever. Kept alongside monthly_top_exports (see
    // captureMonthlyTopExportsIfNeeded below): this is the always-fresh
    // "right now" view, that's the exact-calendar-month historical record -
    // different jobs, both worth keeping. Name is denormalized at snapshot
    // time so a later rename/deletion doesn't corrupt the historical record.
    const topExportedPatterns = [];
    try {
      const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');
      const rows = arrayOf(new DynamicModel({ pattern_id: '', name: '', count: 0 }));
      $app
        .db()
        .newQuery(
          'SELECT ae.pattern_id AS pattern_id, p.name AS name, COUNT(*) AS count ' +
            'FROM analytics_exports ae JOIN patterns p ON p.id = ae.pattern_id ' +
            'WHERE datetime(ae.created) >= datetime({:cutoff30}) ' +
            'GROUP BY ae.pattern_id ' +
            'ORDER BY count DESC ' +
            'LIMIT 10',
        )
        .bind({ cutoff30 })
        .all(rows);
      for (let i = 0; i < rows.length; i++) {
        topExportedPatterns.push({
          pattern_id: rows[i].pattern_id,
          name: rows[i].name,
          count: parseInt(rows[i].count, 10) || 0,
        });
      }
    } catch (_) {}

    return {
      total_patterns: countRows('patterns', 'isDeleted = 0'),
      published_patterns: countRows('patterns', 'isDeleted = 0 AND is_draft = 0'),
      draft_patterns: countRows('patterns', 'isDeleted = 0 AND is_draft = 1'),
      total_tags: countRows('tags', "id != ''"),
      total_users: countRows('users', "id != ''"),
      verified_users: countRows('users', 'verified = 1'),
      artist_users: countRows('users', 'is_artist = 1'),
      total_marked_done: countRows('user_marked_done', "id != ''"),
      total_exports: countRows('analytics_exports', "id != ''"),
      total_user_submissions: countRows('user_submitted_patterns', "id != ''"),
      total_pattern_sets: countRows('pattern_sets', "id != ''"),
      total_store_locations: countRows('store_locations', "id != ''"),
      total_site_visits: totalSiteVisits,
      top_exported_patterns_30d: topExportedPatterns,
      new_users_7d: countRows('users', 'datetime(created) >= datetime({:cutoff})', { cutoff }),
      new_patterns_7d: countRows('patterns', 'isDeleted = 0 AND datetime(created) >= datetime({:cutoff})', {
        cutoff,
      }),
      new_exports_7d: countRows('analytics_exports', 'datetime(created) >= datetime({:cutoff})', { cutoff }),
      new_marked_done_7d: countRows('user_marked_done', 'datetime(created) >= datetime({:cutoff})', { cutoff }),
      new_user_submissions_7d: countRows('user_submitted_patterns', 'datetime(created) >= datetime({:cutoff})', {
        cutoff,
      }),
      // Never-rated patterns store avg_rating/avg_difficulty as 0 (see
      // /api/sync-aggregates above) - excluding them keeps the average honest
      // instead of dragging it toward 0 as the unrated backlog grows.
      avg_pattern_rating: avgField('patterns', 'avg_rating', 'isDeleted = 0 AND avg_rating > 0'),
      avg_pattern_difficulty: avgField('patterns', 'avg_difficulty', 'isDeleted = 0 AND avg_difficulty > 0'),
      // Trailing-7-day windows (not all-time cumulative) so each snapshot is a
      // genuine week-over-week comparison instead of a slow-moving average
      // diluted by months of history.
      exports_by_hour_7d: exportsByHour,
      exports_by_weekday_7d: exportsByWeekday,
      exports_by_file_type_7d: exportsByFileType,
      exports_by_flow_7d: exportsByFlow,
    };
  }

  function saveDatabaseStatsSnapshot() {
    const collection = $app.findCollectionByNameOrId('database_stats_snapshots');
    const record = new Record(collection, computeDatabaseStatsSnapshot());
    $app.save(record);
    return record;
  }

  // Captures an exact, immutable top-10 for the most recently CONCLUDED
  // calendar month (not a rolling window) into the monthly_top_exports
  // collection - one row per month, computed once. Re-derives "last month"
  // from today's date on every run instead of only firing "if today is the
  // 1st", so a run that's missed on the 1st still self-heals: whichever run
  // succeeds next finds last month has no row yet and backfills it. The
  // existence check makes this safe to call from both the daily cron and the
  // backup/manual-trigger runs without creating duplicate months.
  function captureMonthlyTopExportsIfNeeded() {
    try {
      const now = new Date();
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const monthKey = prevMonth.getUTCFullYear() + '-' + String(prevMonth.getUTCMonth() + 1).padStart(2, '0');

      const existingRows = arrayOf(new DynamicModel({ count: 0 }));
      $app
        .db()
        .newQuery('SELECT COUNT(*) as count FROM monthly_top_exports WHERE month = {:monthKey}')
        .bind({ monthKey })
        .all(existingRows);
      if ((parseInt(existingRows[0]?.count || 0, 10) || 0) > 0) return;

      const nextMonth = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1, 1));
      const monthStart = monthKey + '-01 00:00:00.000Z';
      const monthEnd =
        nextMonth.getUTCFullYear() + '-' + String(nextMonth.getUTCMonth() + 1).padStart(2, '0') + '-01 00:00:00.000Z';

      const topRows = arrayOf(new DynamicModel({ pattern_id: '', name: '', count: 0 }));
      $app
        .db()
        .newQuery(
          'SELECT ae.pattern_id AS pattern_id, p.name AS name, COUNT(*) AS count ' +
            'FROM analytics_exports ae JOIN patterns p ON p.id = ae.pattern_id ' +
            'WHERE datetime(ae.created) >= datetime({:monthStart}) AND datetime(ae.created) < datetime({:monthEnd}) ' +
            'GROUP BY ae.pattern_id ORDER BY count DESC LIMIT 10',
        )
        .bind({ monthStart, monthEnd })
        .all(topRows);

      const topPatterns = [];
      for (let i = 0; i < topRows.length; i++) {
        topPatterns.push({
          pattern_id: topRows[i].pattern_id,
          name: topRows[i].name,
          count: parseInt(topRows[i].count, 10) || 0,
        });
      }

      const totalRows = arrayOf(new DynamicModel({ count: 0 }));
      $app
        .db()
        .newQuery(
          'SELECT COUNT(*) as count FROM analytics_exports ' +
            'WHERE datetime(created) >= datetime({:monthStart}) AND datetime(created) < datetime({:monthEnd})',
        )
        .bind({ monthStart, monthEnd })
        .all(totalRows);

      const collection = $app.findCollectionByNameOrId('monthly_top_exports');
      const record = new Record(collection, {
        month: monthKey,
        top_patterns: topPatterns,
        total_exports_in_month: parseInt(totalRows[0]?.count || 0, 10) || 0,
      });
      $app.save(record);
    } catch (_) {
      // Never let this block the daily snapshot save below.
    }
  }

  try {
    const apiKey = c.request.header.get('X-Sync-Key');
    if (apiKey !== $os.getenv('WEBHOOK_API_KEY')) {
      return c.json(401, { error: 'unauthorized' });
    }
    const record = saveDatabaseStatsSnapshot();
    captureMonthlyTopExportsIfNeeded();
    return c.json(200, { ok: true, id: record.id });
  } catch (error) {
    console.log('>>>sync-database-stats error', error?.message);
    return c.json(500, { error: 'something went wrong', message: error?.message });
  }
});

// Admin-triggered "Run snapshot now" button (DB_STATS_AC-gated client-side).
// Duplicates computeDatabaseStatsSnapshot/saveDatabaseStatsSnapshot from
// /api/sync-database-stats above - see the NOTICE at the top of this file.
routerAdd(
  'POST',
  '/api/admin-run-database-stats-snapshot',
  (c) => {
    function computeDatabaseStatsSnapshot() {
      function countRows(table, whereSQL, params) {
        try {
          const rows = arrayOf(new DynamicModel({ count: 0 }));
          $app
            .db()
            .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
            .bind(params || {})
            .all(rows);
          return parseInt(rows[0]?.count || 0, 10);
        } catch (_) {
          return 0;
        }
      }

      function avgField(table, field, whereSQL, params) {
        try {
          const rows = arrayOf(new DynamicModel({ avg: 0 }));
          $app
            .db()
            .newQuery('SELECT AVG(' + field + ') as avg FROM ' + table + ' WHERE ' + whereSQL)
            .bind(params || {})
            .all(rows);
          return parseFloat(rows[0]?.avg || 0);
        } catch (_) {
          return 0;
        }
      }

      // Matches PocketBase's own stored `created` format ("YYYY-MM-DD HH:mm:ss.SSSZ")
      // so the trailing-7-day filters below compare like-for-like.
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');

      const exportsByHour = new Array(24).fill(0);
      try {
        const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
        $app
          .db()
          .newQuery(
            "SELECT strftime('%H', created) AS bucket, COUNT(*) AS count FROM analytics_exports " +
              'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
          )
          .bind({ cutoff })
          .all(rows);
        for (let i = 0; i < rows.length; i++) {
          const idx = parseInt(rows[i].bucket, 10);
          if (idx >= 0 && idx < 24) exportsByHour[idx] = parseInt(rows[i].count, 10) || 0;
        }
      } catch (_) {}

      const exportsByWeekday = new Array(7).fill(0);
      try {
        const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
        $app
          .db()
          .newQuery(
            "SELECT strftime('%w', created) AS bucket, COUNT(*) AS count FROM analytics_exports " +
              'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
          )
          .bind({ cutoff })
          .all(rows);
        for (let i = 0; i < rows.length; i++) {
          const idx = parseInt(rows[i].bucket, 10);
          if (idx >= 0 && idx < 7) exportsByWeekday[idx] = parseInt(rows[i].count, 10) || 0;
        }
      } catch (_) {}

      const exportsByFileType = { pdf: 0, png: 0, jpg: 0, webp: 0, svg: 0 };
      try {
        const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
        $app
          .db()
          .newQuery(
            'SELECT file_type AS bucket, COUNT(*) AS count FROM analytics_exports ' +
              'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
          )
          .bind({ cutoff })
          .all(rows);
        for (let i = 0; i < rows.length; i++) {
          const key = rows[i].bucket;
          if (Object.prototype.hasOwnProperty.call(exportsByFileType, key)) {
            exportsByFileType[key] = parseInt(rows[i].count, 10) || 0;
          }
        }
      } catch (_) {}

      const exportsByFlow = {
        cricut: 0,
        'craft cutter': 0,
        printing: 0,
        'saving for later': 0,
        editing: 0,
        generic: 0,
      };
      try {
        const rows = arrayOf(new DynamicModel({ bucket: '', count: 0 }));
        $app
          .db()
          .newQuery(
            'SELECT flow AS bucket, COUNT(*) AS count FROM analytics_exports ' +
              'WHERE datetime(created) >= datetime({:cutoff}) GROUP BY bucket',
          )
          .bind({ cutoff })
          .all(rows);
        for (let i = 0; i < rows.length; i++) {
          const key = rows[i].bucket;
          if (Object.prototype.hasOwnProperty.call(exportsByFlow, key)) {
            exportsByFlow[key] = parseInt(rows[i].count, 10) || 0;
          }
        }
      } catch (_) {}

      // Backs the retro footer visitor counter (see /api/count-visit below) - one
      // row, one running total, incremented once per browser session.
      let totalSiteVisits = 0;
      try {
        const rows = arrayOf(new DynamicModel({ count: 0 }));
        $app.db().newQuery("SELECT count FROM counters WHERE key = 'visits' LIMIT 1").all(rows);
        totalSiteVisits = parseInt(rows[0]?.count || 0, 10);
      } catch (_) {}

      // Trailing 30 days (not all-time) so this actually moves over time - an
      // all-time leaderboard would be frozen solid with the same handful of
      // long-popular patterns forever. Kept alongside monthly_top_exports (see
      // captureMonthlyTopExportsIfNeeded below): this is the always-fresh
      // "right now" view, that's the exact-calendar-month historical record -
      // different jobs, both worth keeping. Name is denormalized at snapshot
      // time so a later rename/deletion doesn't corrupt the historical record.
      const topExportedPatterns = [];
      try {
        const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');
        const rows = arrayOf(new DynamicModel({ pattern_id: '', name: '', count: 0 }));
        $app
          .db()
          .newQuery(
            'SELECT ae.pattern_id AS pattern_id, p.name AS name, COUNT(*) AS count ' +
              'FROM analytics_exports ae JOIN patterns p ON p.id = ae.pattern_id ' +
              'WHERE datetime(ae.created) >= datetime({:cutoff30}) ' +
              'GROUP BY ae.pattern_id ' +
              'ORDER BY count DESC ' +
              'LIMIT 10',
          )
          .bind({ cutoff30 })
          .all(rows);
        for (let i = 0; i < rows.length; i++) {
          topExportedPatterns.push({
            pattern_id: rows[i].pattern_id,
            name: rows[i].name,
            count: parseInt(rows[i].count, 10) || 0,
          });
        }
      } catch (_) {}

      return {
        total_patterns: countRows('patterns', 'isDeleted = 0'),
        published_patterns: countRows('patterns', 'isDeleted = 0 AND is_draft = 0'),
        draft_patterns: countRows('patterns', 'isDeleted = 0 AND is_draft = 1'),
        total_tags: countRows('tags', "id != ''"),
        total_users: countRows('users', "id != ''"),
        verified_users: countRows('users', 'verified = 1'),
        artist_users: countRows('users', 'is_artist = 1'),
        total_marked_done: countRows('user_marked_done', "id != ''"),
        total_exports: countRows('analytics_exports', "id != ''"),
        total_user_submissions: countRows('user_submitted_patterns', "id != ''"),
        total_pattern_sets: countRows('pattern_sets', "id != ''"),
        total_store_locations: countRows('store_locations', "id != ''"),
        total_site_visits: totalSiteVisits,
        top_exported_patterns_30d: topExportedPatterns,
        new_users_7d: countRows('users', 'datetime(created) >= datetime({:cutoff})', { cutoff }),
        new_patterns_7d: countRows('patterns', 'isDeleted = 0 AND datetime(created) >= datetime({:cutoff})', {
          cutoff,
        }),
        new_exports_7d: countRows('analytics_exports', 'datetime(created) >= datetime({:cutoff})', { cutoff }),
        new_marked_done_7d: countRows('user_marked_done', 'datetime(created) >= datetime({:cutoff})', { cutoff }),
        new_user_submissions_7d: countRows('user_submitted_patterns', 'datetime(created) >= datetime({:cutoff})', {
          cutoff,
        }),
        // Never-rated patterns store avg_rating/avg_difficulty as 0 (see
        // /api/sync-aggregates above) - excluding them keeps the average honest
        // instead of dragging it toward 0 as the unrated backlog grows.
        avg_pattern_rating: avgField('patterns', 'avg_rating', 'isDeleted = 0 AND avg_rating > 0'),
        avg_pattern_difficulty: avgField('patterns', 'avg_difficulty', 'isDeleted = 0 AND avg_difficulty > 0'),
        // Trailing-7-day windows (not all-time cumulative) so each snapshot is a
        // genuine week-over-week comparison instead of a slow-moving average
        // diluted by months of history.
        exports_by_hour_7d: exportsByHour,
        exports_by_weekday_7d: exportsByWeekday,
        exports_by_file_type_7d: exportsByFileType,
        exports_by_flow_7d: exportsByFlow,
      };
    }

    function saveDatabaseStatsSnapshot() {
      const collection = $app.findCollectionByNameOrId('database_stats_snapshots');
      const record = new Record(collection, computeDatabaseStatsSnapshot());
      $app.save(record);
      return record;
    }

    // Captures an exact, immutable top-10 for the most recently CONCLUDED
    // calendar month (not a rolling window) into the monthly_top_exports
    // collection - one row per month, computed once. Re-derives "last month"
    // from today's date on every run instead of only firing "if today is the
    // 1st", so a run that's missed on the 1st still self-heals: whichever run
    // succeeds next finds last month has no row yet and backfills it. The
    // existence check makes this safe to call from both the daily cron and the
    // backup/manual-trigger runs without creating duplicate months.
    function captureMonthlyTopExportsIfNeeded() {
      try {
        const now = new Date();
        const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const monthKey = prevMonth.getUTCFullYear() + '-' + String(prevMonth.getUTCMonth() + 1).padStart(2, '0');

        const existingRows = arrayOf(new DynamicModel({ count: 0 }));
        $app
          .db()
          .newQuery('SELECT COUNT(*) as count FROM monthly_top_exports WHERE month = {:monthKey}')
          .bind({ monthKey })
          .all(existingRows);
        if ((parseInt(existingRows[0]?.count || 0, 10) || 0) > 0) return;

        const nextMonth = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1, 1));
        const monthStart = monthKey + '-01 00:00:00.000Z';
        const monthEnd =
          nextMonth.getUTCFullYear() + '-' + String(nextMonth.getUTCMonth() + 1).padStart(2, '0') + '-01 00:00:00.000Z';

        const topRows = arrayOf(new DynamicModel({ pattern_id: '', name: '', count: 0 }));
        $app
          .db()
          .newQuery(
            'SELECT ae.pattern_id AS pattern_id, p.name AS name, COUNT(*) AS count ' +
              'FROM analytics_exports ae JOIN patterns p ON p.id = ae.pattern_id ' +
              'WHERE datetime(ae.created) >= datetime({:monthStart}) AND datetime(ae.created) < datetime({:monthEnd}) ' +
              'GROUP BY ae.pattern_id ORDER BY count DESC LIMIT 10',
          )
          .bind({ monthStart, monthEnd })
          .all(topRows);

        const topPatterns = [];
        for (let i = 0; i < topRows.length; i++) {
          topPatterns.push({
            pattern_id: topRows[i].pattern_id,
            name: topRows[i].name,
            count: parseInt(topRows[i].count, 10) || 0,
          });
        }

        const totalRows = arrayOf(new DynamicModel({ count: 0 }));
        $app
          .db()
          .newQuery(
            'SELECT COUNT(*) as count FROM analytics_exports ' +
              'WHERE datetime(created) >= datetime({:monthStart}) AND datetime(created) < datetime({:monthEnd})',
          )
          .bind({ monthStart, monthEnd })
          .all(totalRows);

        const collection = $app.findCollectionByNameOrId('monthly_top_exports');
        const record = new Record(collection, {
          month: monthKey,
          top_patterns: topPatterns,
          total_exports_in_month: parseInt(totalRows[0]?.count || 0, 10) || 0,
        });
        $app.save(record);
      } catch (_) {
        // Never let this block the daily snapshot save below.
      }
    }

    try {
      const record = saveDatabaseStatsSnapshot();
      captureMonthlyTopExportsIfNeeded();
      return c.json(200, { ok: true, id: record.id });
    } catch (error) {
      console.log('>>>admin-run-database-stats-snapshot error', error?.message);
      return c.json(500, { error: 'something went wrong', message: error?.message });
    }
  },
  $apis.requireAuth('admins'),
);

// Public, unauthenticated aggregate counts for the /community page's stats strip.
// Intentionally minimal - just enough for a "join N members, browse M patterns"
// blurb, nothing sensitive.
routerAdd('GET', '/api/public-site-stats', (c) => {
  function countRows(table, whereSQL) {
    try {
      const rows = arrayOf(new DynamicModel({ count: 0 }));
      $app
        .db()
        .newQuery('SELECT COUNT(*) as count FROM ' + table + ' WHERE ' + whereSQL)
        .all(rows);
      return parseInt(rows[0]?.count || 0, 10);
    } catch (_) {
      return 0;
    }
  }

  return c.json(200, {
    patterns: countRows('patterns', 'isDeleted = 0 AND is_draft = 0'),
    members: countRows('users', "id != ''"),
    tags: countRows('tags', "id != ''"),
  });
});

// Public, unauthenticated curated history for the /community page's growth
// charts - same "hand-picked non-sensitive projection" shape as
// /api/public-site-stats just above. The full snapshot (export breakdowns,
// ratings, etc.) stays admin-only behind database_stats_snapshots' List rule.
routerAdd('GET', '/api/public-database-stats-history', (c) => {
  try {
    const records = $app.findRecordsByFilter('database_stats_snapshots', "id != ''", 'created', 0, 0);
    const items = records.map((r) => ({
      created: r.getString('created'),
      total_patterns: r.getInt('total_patterns'),
      total_users: r.getInt('total_users'),
      total_tags: r.getInt('total_tags'),
    }));
    return c.json(200, { items });
  } catch (error) {
    return c.json(500, { error: 'failed to load stats history' });
  }
});

onRecordAfterCreateSuccess((e) => {
  // ─── Discord "new pattern" notifications ─────────────────────────────────
  // Fires the instant a pattern becomes publicly visible - either published
  // straight away on create, or a draft that gets published later on update.
  // This is a native PocketBase event hook, not PocketHost's cron-based
  // webhooks (those only fire on a schedule, not on record events). Set
  // DISCORD_PATTERN_WEBHOOK_URL in the PocketHost environment variables to
  // enable. Never throws - a Discord outage or missing webhook must never
  // block a pattern save.
  // Same logic as src/functions/utilities/strip-markdown.ts (kept as a
  // separate copy since pb_hooks runs in Goja, not Node/the browser) - avoids
  // dumping raw "**bold**"/"[link](url)" syntax into the Discord embed.
  // Uses [\s\S] instead of the "s" (dotAll) regex flag for Goja compatibility.
  function stripMarkdown(text) {
    return text
      .replace(/^#+\s.*$/gm, '')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      .replace(/\*([\s\S]+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();
  }

  function notifyDiscordNewPattern(record) {
    try {
      const webhookUrl = $os.getenv('DISCORD_PATTERN_WEBHOOK_URL');
      if (!webhookUrl) return;

      const name = record.getString('name') || 'Untitled pattern';
      const description = stripMarkdown(record.getString('description') || '');
      // JSON-field values come back from .get() as raw bytes, not a parsed
      // array/string - .getString() + JSON.parse() is this file's existing
      // convention for reading them (see the `tags` field above).
      let authorManual = [];
      try {
        authorManual = JSON.parse(record.getString('author_manual') || '[]');
      } catch (_) {}
      const authorLine =
        Array.isArray(authorManual) && authorManual.length > 0 ? authorManual.join(', ') : 'the community';
      const ogImage = record.getString('opengraph_image');
      const imageUrl = ogImage
        ? `https://stained-glass.pockethost.io/api/files/${record.collection().id}/${record.id}/${ogImage}`
        : null;
      const patternUrl = `https://patternarchive.net/pattern/${record.id}`;

      const embed = {
        title: name,
        url: patternUrl,
        description: description.length > 300 ? description.slice(0, 297) + '...' : description,
        color: 0xc8a96e,
        //footer: { text: `By ${authorLine}` },
      };
      if (imageUrl) embed.image = { url: imageUrl };

      $http.send({
        method: 'POST',
        url: webhookUrl,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🪟 New pattern: **${name}**`,
          embeds: [embed],
        }),
      });
    } catch (err) {
      console.log('Discord pattern notify error:', err);
    }
  }

  if (!e.record.getBool('isDeleted') && !e.record.getBool('is_draft')) {
    notifyDiscordNewPattern(e.record);
  }
  e.next();
}, 'patterns');

// Called explicitly by AdminEditPatternModal.tsx right after a brand-new,
// immediately-published pattern finishes its opengraph_image update (see the
// comment above notifyDiscordNewPattern for why this can't just be a create
// hook). Admin-gated since it's only ever called from the admin save flow.
routerAdd(
  'POST',
  '/api/notify-discord-pattern',
  (c) => {
    // Same logic as src/functions/utilities/strip-markdown.ts (kept as a
    // separate copy since pb_hooks runs in Goja, not Node/the browser) - avoids
    // dumping raw "**bold**"/"[link](url)" syntax into the Discord embed.
    // Uses [\s\S] instead of the "s" (dotAll) regex flag for Goja compatibility.
    function stripMarkdown(text) {
      return text
        .replace(/^#+\s.*$/gm, '')
        .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
        .replace(/\*([\s\S]+?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim();
    }

    function notifyDiscordNewPattern(record) {
      try {
        const webhookUrl = $os.getenv('DISCORD_PATTERN_WEBHOOK_URL');
        if (!webhookUrl) return;

        const name = record.getString('name') || 'Untitled pattern';
        const description = stripMarkdown(record.getString('description') || '');
        // JSON-field values come back from .get() as raw bytes, not a parsed
        // array/string - .getString() + JSON.parse() is this file's existing
        // convention for reading them (see the `tags` field above).
        let authorManual = [];
        try {
          authorManual = JSON.parse(record.getString('author_manual') || '[]');
        } catch (_) {}
        const authorLine =
          Array.isArray(authorManual) && authorManual.length > 0 ? authorManual.join(', ') : 'the community';
        const ogImage = record.getString('opengraph_image');
        const imageUrl = ogImage
          ? `https://stained-glass.pockethost.io/api/files/${record.collection().id}/${record.id}/${ogImage}`
          : null;
        const patternUrl = `https://patternarchive.net/pattern/${record.id}`;

        const embed = {
          title: name,
          url: patternUrl,
          description: description.length > 300 ? description.slice(0, 297) + '...' : description,
          color: 0xc8a96e,
          footer: { text: `By ${authorLine}` },
        };
        if (imageUrl) embed.image = { url: imageUrl };

        $http.send({
          method: 'POST',
          url: webhookUrl,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🪟 New pattern: **${name}**`,
            embeds: [embed],
          }),
        });
      } catch (err) {
        console.log('Discord pattern notify error:', err);
      }
    }

    const patternId = c.request.url.query().get('patternId') || '';
    if (!patternId) return c.json(400, { error: 'patternId is required' });

    try {
      const record = $app.findRecordById('patterns', patternId);
      if (!record.getBool('isDeleted') && !record.getBool('is_draft')) {
        notifyDiscordNewPattern(record);
      }
      return c.json(200, { ok: true });
    } catch (_) {
      return c.json(404, { error: 'Pattern not found' });
    }
  },
  $apis.requireAuth('admins'),
);

// Public, narrow name -> user-id lookup for the homepage author search.
// Filtering patterns by "authors.name" would join into the `users` collection,
// which is subject to that collection's own List rule - now admin-only, so the
// join silently returns nothing for everyone else. This runs the lookup
// server-side via $app, which isn't subject to API-level collection rules
// (those only gate the public REST API, not internal Go/JSVM db access), then
// hands back just the matching ids so the frontend can filter the `authors`
// relation directly (authors ~ "id") with no join at all. Only returns ids for
// names you already supply - can't be used to enumerate the whole users table.
routerAdd('GET', '/api/resolve-author-ids', (c) => {
  const namesParam = c.request.url.query().get('names') || '';
  const names = namesParam
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  const result = {};
  for (const name of names) {
    try {
      const records = $app.findRecordsByFilter('users', 'name ~ {:name}', '', 50, 0, { name });
      result[name] = records.map((r) => r.id);
    } catch (_) {
      result[name] = [];
    }
  }

  return c.json(200, result);
});

// Public list of artist profile ids, for sitemap generation. Same rationale as
// resolve-author-ids above: the `users` List rule is admin-only so bulk
// enumeration of the whole table stays blocked, but an artist's profile page
// and pattern list are already fully public - this just indexes pages that
// are already public, scoped strictly to is_artist=true (never plain users).
// Raw SQL rather than findRecordsByFilter so every match comes back in one
// query - no row cap to remember to raise as the artist count grows.
routerAdd('GET', '/api/public-artist-ids', (c) => {
  const rows = arrayOf(new DynamicModel({ id: '', updated: '' }));
  try {
    $app
      .db()
      .newQuery(
        'SELECT id, updated FROM users WHERE is_artist = 1 AND (banned IS NULL OR banned = 0) ORDER BY updated DESC',
      )
      .all(rows);
  } catch (_) {
    // fall through with whatever rows were populated (likely none)
  }

  const items = rows.map((r) => ({ id: r.id, updated: r.updated }));
  return c.json(200, { page: 1, perPage: items.length, totalItems: items.length, totalPages: 1, items });
});

// ─── Retro visitor counter ────────────────────────────────────────────────────
// A single integer in the `counters` collection (record key = 'visits') backs
// the footer's old-school hit counter. No per-visitor data of any kind is
// stored - the only thing that ever changes is the number. The collection's
// API rules stay fully locked; these endpoints are the only access path.
//
// GET  /api/count-visit → read the current count
// POST /api/count-visit → increment (atomic SQL update, safe under concurrent
//                         visitors) and return the new count

routerAdd('GET', '/api/count-visit', (c) => {
  try {
    const rows = arrayOf(new DynamicModel({ count: 0 }));
    $app.db().newQuery("SELECT count FROM counters WHERE key = 'visits' LIMIT 1").all(rows);
    return c.json(200, { count: parseInt(rows[0]?.count || 0, 10) });
  } catch (_) {
    return c.json(200, { count: 0 });
  }
});

routerAdd('POST', '/api/count-visit', (c) => {
  try {
    $app.db().newQuery("UPDATE counters SET count = count + 1 WHERE key = 'visits'").execute();
  } catch (_) {
    // Missing collection/record - fall through and report whatever we can read
  }

  try {
    const rows = arrayOf(new DynamicModel({ count: 0 }));
    $app.db().newQuery("SELECT count FROM counters WHERE key = 'visits' LIMIT 1").all(rows);
    return c.json(200, { count: parseInt(rows[0]?.count || 0, 10) });
  } catch (_) {
    return c.json(200, { count: 0 });
  }
});

// ─── Turnstile-gated user registration ────────────────────────────────────────
// Blocks bot signups at the API level: creating a `users` record requires a
// valid Cloudflare Turnstile token in the X-Turnstile-Token header, verified
// server-side against Cloudflare. A widget alone wouldn't help - bots hit the
// PocketBase REST API directly, so the collection itself must enforce it.
//
// Requires the TURNSTILE_SECRET_KEY env var on the PocketBase host. Until it
// is set, the hook fails open (registration works, unverified) so deploy
// order can't brick signups.
onRecordCreateRequest((e) => {
  // The PocketBase admin UI / superuser API skips the challenge
  if (e.hasSuperuserAuth()) {
    return e.next();
  }

  const secret = $os.getenv('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.log('TURNSTILE_SECRET_KEY not set - skipping captcha verification for user registration');
    return e.next();
  }

  // NOTE: record request events don't expose `e.request` in the JSVM (unlike
  // routerAdd handlers) - headers must come from requestInfo(), which
  // normalizes names to lowercase_with_underscores.
  const token = e.requestInfo().headers?.x_turnstile_token || '';
  if (!token) {
    throw new BadRequestError('Captcha verification required.');
  }

  let verified = false;
  try {
    const res = $http.send({
      url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      method: 'POST',
      body: JSON.stringify({ secret: secret, response: token }),
      headers: { 'Content-Type': 'application/json' },
      timeout: 10,
    });
    verified = !!res.json?.success;
  } catch (_) {
    verified = false;
  }

  if (!verified) {
    throw new BadRequestError('Captcha verification failed. Please try again.');
  }

  e.next();
}, 'users');

// ─── User ban system ──────────────────────────────────────────────────────────
// Soft ban: `banned` (bool) + `banned_reason` (text) on the users collection.
// Content stays in the database (reversible, keeps evidence); enforcement
// happens at the API level below. Admin UI lives at /space-command/users.

// Block banned accounts from authenticating. Fires for password login AND
// token refresh - the app refreshes auth once per visit, so a banned user's
// existing session ends the next time they load the site.
onRecordAuthRequest((e) => {
  if (e.record?.getBool('banned')) {
    const reason = e.record.getString('banned_reason');
    throw new ForbiddenError(
      reason ? 'This account has been suspended. Reason: ' + reason : 'This account has been suspended.',
    );
  }
  e.next();
}, 'users');

// Warm-token guard: bans don't expire already-issued JWTs, so until the next
// auth refresh a banned user still holds a technically-valid token. Reject
// their content writes directly. (Admin panel auth lives in the separate
// `admins` collection, so admin requests pass through untouched.)
onRecordCreateRequest(
  (e) => {
    if (e.auth?.collection()?.name === 'users' && e.auth.getBool('banned')) {
      throw new ForbiddenError('This account has been suspended.');
    }
    e.next();
  },
  'gallery',
  'user_ratings',
  'user_difficulty_ratings',
  'user_favorites',
  'user_marked_done',
  'user_collections',
);

onRecordUpdateRequest(
  (e) => {
    if (e.auth?.collection()?.name === 'users' && e.auth.getBool('banned')) {
      throw new ForbiddenError('This account has been suspended.');
    }
    e.next();
  },
  'gallery',
  'user_ratings',
  'user_difficulty_ratings',
  'user_collections',
  'users',
);

// Admin action: ban or unban a user. Uses $app.save (internal access) so it
// works regardless of the users collection's API rules.
routerAdd(
  'POST',
  '/api/admin-ban-user',
  (c) => {
    const body = c.requestInfo().body || {};
    const userId = String(body.userId || '');
    const banned = !!body.banned;
    const reason = String(body.reason || '');

    if (!userId) return c.json(400, { error: 'userId is required' });

    try {
      const user = $app.findRecordById('users', userId);
      user.set('banned', banned);
      user.set('banned_reason', banned ? reason : '');
      $app.save(user);
      return c.json(200, { success: true, banned });
    } catch (_) {
      return c.json(400, { error: 'Unable to update user' });
    }
  },
  $apis.requireAuth('admins'),
);

// Admin action: force-reset an impersonating/inappropriate display name to a
// neutral placeholder. Deterministic per user so repeat clicks are harmless.
routerAdd(
  'POST',
  '/api/admin-reset-user-name',
  (c) => {
    const body = c.requestInfo().body || {};
    const userId = String(body.userId || '');

    if (!userId) return c.json(400, { error: 'userId is required' });

    try {
      const user = $app.findRecordById('users', userId);
      const newName = 'User_' + userId.slice(0, 8);
      user.set('name', newName);
      $app.save(user);
      return c.json(200, { success: true, name: newName });
    } catch (_) {
      return c.json(400, { error: 'Unable to update user' });
    }
  },
  $apis.requireAuth('admins'),
);

// Phase 4 (see TAG_REDESIGN_PROJECT_NOTES.md): keeps an author's tag
// identity in sync with their account name. Without this, renaming an
// account would stop automatically updating that person's credit on every
// pattern - today it is instant, because patterns.authors is a live
// relation; once an author is a tag string baked into patterns.tags,
// nothing keeps it current unless something does this on purpose. This
// hook restores that behavior, and goes one better: the old name becomes a
// search alias, so a bookmark or a typed search for someone's old name
// still finds their patterns.
//
// Fires after the account save has already succeeded - a rename must
// always go through, even when the tag-sync step below cannot complete
// (see the collision case). Catches every path that changes users.name,
// not just the self-service profile editor - /api/admin-reset-user-name
// above goes through $app.save() too, which still triggers this hook.
//
// onRecordAfterUpdateSuccess and record.original() verified against
// PocketBase's own JSVM reference before writing this, rather than
// guessed at - see https://pocketbase.io/jsvm/interfaces/core.Record.html
// and TAG_REDESIGN_PROJECT_NOTES.md, Phase 4.
onRecordAfterUpdateSuccess((e) => {
  // Mirrors normalizeTagName() in src/functions/utilities/normalize-tag.ts.
  // JSVM can't import a .ts file from src/ directly - keep this copy in
  // sync if the canonical rule ever changes.
  function normalizeTagName(raw) {
    return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Mirrors slugifyTag() in src/functions/utilities/slugify-tag.ts.
  function slugifyTag(tag) {
    return tag
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function escDq(s) {
    return String(s).replace(/"/g, '\\"');
  }

  function escSq(s) {
    return String(s).replace(/'/g, "\\'");
  }

  try {
    const oldName = e.record.original().getString('name');
    const newName = e.record.getString('name');
    const normalizedOldName = normalizeTagName(oldName || '');
    const normalizedNewName = normalizeTagName(newName || '');
    // Nothing to propagate - either name wasn't touched by this save, or it
    // changed only in casing/whitespace, which isn't a different tag
    // identity (same normalized-comparison rule the admin tag manager's own
    // rename check already applies, for the same reason).
    if (!normalizedNewName || normalizedOldName === normalizedNewName) return;

    const linkedRows = $app.findRecordsByFilter('tags_v2', "linked_user = '" + escSq(e.record.id) + "'", '', 1, 0);
    if (!linkedRows.length) return; // this account has no linked author tag - nothing to do

    const authorTag = linkedRows[0];

    // One edge case to handle, from the plan: does a different tag already
    // own the new name? Never merge automatically - skip, log it, and leave
    // it for an admin. The account rename itself has already succeeded and
    // is not undone here either way.
    const collisionRows = $app.findRecordsByFilter(
      'tags_v2',
      "tag = '" + escSq(normalizedNewName) + "'",
      '',
      1,
      0,
    );
    if (collisionRows.length && collisionRows[0].id !== authorTag.id) {
      try {
        const logsCollection = $app.findCollectionByNameOrId('admin_logs');
        const logRecord = new Record(logsCollection, {
          admin_id: '',
          admin_name: 'System (account rename)',
          action: 'Author Tag Rename Skipped - Name Collision',
          entity_type: 'Tag',
          entity_id: authorTag.id,
          entity_name: authorTag.getString('tag'),
          changes: {},
          metadata: {
            user_id: e.record.id,
            old_tag: normalizedOldName,
            new_tag: normalizedNewName,
            colliding_tag_id: collisionRows[0].id,
            reason:
              'A different tag already exists with this name. The account rename succeeded; the author tag was left as-is for an admin to resolve by hand.',
          },
        });
        $app.save(logRecord);
      } catch (logErr) {
        console.log('>>>account-rename-sync: failed to write audit log', logErr.message);
      }
      return;
    }

    const oldSlug = authorTag.getString('slug');
    let oldPreviousSlugs = [];
    try {
      oldPreviousSlugs = JSON.parse(authorTag.getString('previous_slugs')) || [];
    } catch (_) {}

    const baseSlug = slugifyTag(normalizedNewName) || 'author';
    const otherTagRows = $app.findRecordsByFilter('tags_v2', "id != '" + escSq(authorTag.id) + "'", '', 0, 0);
    const usedSlugs = {};
    for (let i = 0; i < otherTagRows.length; i++) {
      usedSlugs[otherTagRows[i].getString('slug')] = true;
    }
    let newSlug = baseSlug;
    let suffix = 2;
    while (usedSlugs[newSlug]) newSlug = baseSlug + '-' + suffix++;

    $app.runInTransaction((txApp) => {
      // 1. Rename the tag itself, keeping the old slug reachable (mirrors
      // syncSatelliteTablesForOp's rename behavior in space-command/tags.tsx).
      authorTag.set('tag', normalizedNewName);
      authorTag.set('slug', newSlug);
      authorTag.set('previous_slugs', [oldSlug].concat(oldPreviousSlugs));
      txApp.save(authorTag);

      // 2. Rewrite every pattern crediting the old name to credit the new
      // one - the same "instant credit update" the old patterns.authors
      // relation gave for free.
      const affectedPatterns = $app.findRecordsByFilter(
        'patterns',
        "tags ~ '\"" + escDq(normalizedOldName) + "\"'",
        '',
        0,
        0,
      );
      for (let i = 0; i < affectedPatterns.length; i++) {
        const pattern = affectedPatterns[i];
        let tags = [];
        try {
          tags = JSON.parse(pattern.getString('tags')) || [];
        } catch (_) {
          continue;
        }
        const rewritten = tags.map(function (t) {
          return t === normalizedOldName ? normalizedNewName : t;
        });
        try {
          pattern.set('tags', rewritten);
          txApp.save(pattern);
        } catch (saveErr) {
          console.log('>>>account-rename-sync: failed to update pattern', pattern.id, saveErr.message);
        }
      }

      // 3. Retarget any existing alias that pointed at the old name, so a
      // chain of renames (Jane Doe -> Jane Smith -> Jane Johnson) keeps
      // every earlier name resolving to the current one, not a stale middle
      // name. Alias resolution is single-hop by design (see
      // resolveTagAlias in src/functions/database/tags.ts), so this matters:
      // without it, an alias from two renames ago would point at a name
      // that no longer exists as a tag at all.
      const staleAliasRows = $app.findRecordsByFilter(
        'tag_aliases',
        "target_tag = '" + escSq(normalizedOldName) + "'",
        '',
        0,
        0,
      );
      for (let i = 0; i < staleAliasRows.length; i++) {
        try {
          staleAliasRows[i].set('target_tag', normalizedNewName);
          txApp.save(staleAliasRows[i]);
        } catch (saveErr) {
          console.log('>>>account-rename-sync: failed to retarget alias', staleAliasRows[i].id, saveErr.message);
        }
      }

      // 4. Add the old name itself as a new alias of the new one, so a
      // bookmark or a typed search for it still finds these patterns.
      const existingAliasForOldName = $app.findRecordsByFilter(
        'tag_aliases',
        "alias = '" + escSq(normalizedOldName) + "'",
        '',
        1,
        0,
      );
      try {
        if (existingAliasForOldName.length) {
          existingAliasForOldName[0].set('target_tag', normalizedNewName);
          txApp.save(existingAliasForOldName[0]);
        } else {
          const aliasCollection = $app.findCollectionByNameOrId('tag_aliases');
          const aliasRecord = new Record(aliasCollection, {
            alias: normalizedOldName,
            target_tag: normalizedNewName,
          });
          txApp.save(aliasRecord);
        }
      } catch (saveErr) {
        console.log('>>>account-rename-sync: failed to add alias for old name', saveErr.message);
      }
    });
  } catch (error) {
    console.log('>>>account-rename-sync: error', error.message);
  }
}, 'users');

// Not replicated here, on purpose: implied_tags edges pointing at or from
// the renamed tag are not retargeted. That mirrors the full breadth of
// retargetImpliedTagEdges/retargetTagAliases in space-command/tags.tsx,
// which needed a full code review to get right (self-loop dedup, symmetric
// guards) - out of scope for a first version of this hook, and a
// personal-name tag having a pre-existing implied-tag edge is a much rarer
// case than the alias-chain problem #3 above handles. If this ever proves
// to matter in practice, extend this hook the same way, or point back at
// that reviewed logic as a reference.

// ─── Submission review notifications ──────────────────────────────────────────
// Fires whenever a user's pattern submission is approved (published) or
// rejected by an admin - writes a row to user_submission_notifications so the
// submitter sees it in their notification bell (see NotificationBell.tsx).
// Requires that collection to exist (submitter/submission/status/reason
// fields) - see the schema notes shared alongside this change.
//
// Uses $app.save/$app.delete (internal access, bypasses collection API
// rules) since submitters never write these rows directly - only this hook
// does, and its own create/update rules stay locked accordingly.
onRecordAfterUpdateSuccess((e) => {
  try {
    const prevStatus = e.record.original().getString('status');
    const newStatus = e.record.getString('status');

    if (prevStatus !== newStatus) {
      if (newStatus === 'published' || newStatus === 'rejected') {
        const collection = $app.findCollectionByNameOrId('user_submission_notifications');
        const notification = new Record(collection, {
          submitter: e.record.getString('submitter'),
          submission: e.record.id,
          status: newStatus,
          reason: newStatus === 'rejected' ? e.record.getString('rejection_reason') : '',
        });
        $app.save(notification);
      } else if (newStatus === 'pending') {
        // An admin reversed their decision ("send back to queue") before the
        // submitter ever saw the notification - drop the stale row instead
        // of leaving a "rejected"/"published" ping next to a submission
        // that's actually back in the working queue.
        const stale = $app.findRecordsByFilter('user_submission_notifications', 'submission = {:id}', '', 0, 0, {
          id: e.record.id,
        });
        for (let i = 0; i < stale.length; i++) {
          $app.delete(stale[i]);
        }
      }
    }
  } catch (err) {
    console.log('Submission notification hook error:', err);
  }

  e.next();
}, 'user_submitted_patterns');

// ─── Complaint resolution notifications ────────────────────────────────────────
// Fires when an admin marks a pattern report/complaint as reviewed - writes a
// row to complaint_notifications so the reporter sees it in their notification
// bell (see NotificationBell.tsx), carrying over the admin's review_notes as
// the reason. Only signed-in reporters have an owner_id to notify - anonymous
// reports (owner_id empty) have no account to write a notification against, so
// those are silently skipped. Requires the complaint_notifications collection
// to exist (owner_id/complaint/reason fields) - see pb_schema.json.
//
// Uses $app.save (internal access, bypasses collection API rules) since
// reporters never write these rows directly - only this hook does, and its
// own create/update rules stay locked accordingly.
onRecordAfterUpdateSuccess((e) => {
  try {
    const wasReviewed = e.record.original().getBool('reviewed');
    const isReviewed = e.record.getBool('reviewed');
    const ownerId = e.record.getString('owner_id');

    if (!wasReviewed && isReviewed && ownerId) {
      const collection = $app.findCollectionByNameOrId('complaint_notifications');
      const notification = new Record(collection, {
        owner_id: ownerId,
        complaint: e.record.id,
        reason: e.record.getString('review_notes'),
      });
      $app.save(notification);
    }
  } catch (err) {
    console.log('Complaint notification hook error:', err);
  }

  e.next();
}, 'complaints');
