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
      const records = $app.findRecordsByFilter('authors', "id != ''", '', 0, 0);
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        result.authors.push({
          id: r.id,
          tag: r.getString('tag'),
          count: r.getInt('count'),
          manual: r.getInt('manual'),
          user_id: r.getString('user_id'),
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
  });
});
