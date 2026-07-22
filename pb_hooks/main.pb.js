/// <reference path="./types.d.ts" />

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
  function buildPatternFilters(tokens, authorIdMap, blockedTags) {
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
        // Wrap in literal quotes so the match hits a JSON element boundary -
        // '"cat"' matches ["cat"] but not ["suncatcher"].
        const b = bind(t.value);
        if (t.exclude) {
          dslParts.push(`(tags !~ '"${escDq(t.value)}"')`);
          sqlParts.push(`tags NOT LIKE '%"' || ${b} || '"%'`);
        } else {
          dslParts.push(`(tags ~ '"${escDq(t.value)}"')`);
          sqlParts.push(`tags LIKE '%"' || ${b} || '"%'`);
        }
      } else if (t.type === 'author') {
        // Each author token is its own AND-ed clause (pushed straight into
        // dslParts/sqlParts, same as tag/title/etc.) so "author:A author:B"
        // means patterns crediting BOTH A and B (intersection) - matching how
        // tag search already works. Within a single token, matching either
        // the manual-author text OR any of that name's resolved linked-user
        // ids is still an OR, since one artist may be recorded either way.
        const ids = (authorIdMap && authorIdMap[t.value]) || [];
        const nameBind = bind(t.value);
        if (t.exclude) {
          let dsl = `(author_manual !~ "${escDq(t.value)}"`;
          let sql = `(author_manual NOT LIKE '%' || ${nameBind} || '%'`;
          for (const id of ids) {
            const idBind = bind(id);
            dsl += ` && authors !~ "${escDq(id)}"`;
            sql += ` AND authors NOT LIKE '%"' || ${idBind} || '"%'`;
          }
          dslParts.push(dsl + ')');
          sqlParts.push(sql + ')');
        } else {
          let dsl = `(author_manual ~ "${escDq(t.value)}"`;
          let sql = `(author_manual LIKE '%' || ${nameBind} || '%'`;
          for (const id of ids) {
            const idBind = bind(id);
            dsl += ` || authors ~ "${escDq(id)}"`;
            sql += ` OR authors LIKE '%"' || ${idBind} || '"%'`;
          }
          dslParts.push(dsl + ')');
          sqlParts.push(sql + ')');
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
      } else if (t.type === 'parts' || t.type === 'width' || t.type === 'height' || t.type === 'filesize') {
        const column = {
          parts: 'pieces',
          width: 'design_width',
          height: 'design_height',
          filesize: 'pattern_file_size',
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

  const { dslFilter, sqlWhere, sqlParams } = buildPatternFilters(tokens, authorIdMap, blockedTags);
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

// Consolidates the 3 sidebar-badge lookups the admin layout fires on every
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
