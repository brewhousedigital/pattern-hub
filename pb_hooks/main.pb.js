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
  };

  try {
    const r = $app.findFirstRecordByFilter(
      'community_ratings',
      'pattern_id = {:pid}',
      { pid: patternId },
    );
    result.communityRating = {
      id: r.id,
      pattern_id: r.getString('pattern_id'),
      average_rating: r.getFloat('average_rating'),
      total_ratings: r.getInt('total_ratings'),
    };
  } catch (_) {}

  try {
    const r = $app.findFirstRecordByFilter(
      'community_difficulty_ratings',
      'pattern_id = {:pid}',
      { pid: patternId },
    );
    result.communityDifficulty = {
      id: r.id,
      pattern_id: r.getString('pattern_id'),
      average_rating: r.getFloat('average_rating'),
      total_ratings: r.getInt('total_ratings'),
    };
  } catch (_) {}

  if (userId) {
    try {
      const r = $app.findFirstRecordByFilter(
        'user_ratings',
        'pattern_id = {:pid} && owner_id = {:uid}',
        { pid: patternId, uid: userId },
      );
      result.userRating = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
        rating: r.getFloat('rating'),
        rating_notes: r.getString('rating_notes'),
      };
    } catch (_) {}

    try {
      const r = $app.findFirstRecordByFilter(
        'user_difficulty_ratings',
        'pattern_id = {:pid} && owner_id = {:uid}',
        { pid: patternId, uid: userId },
      );
      result.userDifficulty = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
        rating: r.getFloat('rating'),
      };
    } catch (_) {}

    try {
      const r = $app.findFirstRecordByFilter(
        'user_favorites',
        'pattern_id = {:pid} && owner_id = {:uid}',
        { pid: patternId, uid: userId },
      );
      result.userFavorite = {
        id: r.id,
        pattern_id: r.getString('pattern_id'),
        owner_id: r.getString('owner_id'),
      };
    } catch (_) {}

    try {
      const r = $app.findFirstRecordByFilter(
        'user_marked_done',
        'pattern_id = {:pid} && owner_id = {:uid}',
        { pid: patternId, uid: userId },
      );
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
