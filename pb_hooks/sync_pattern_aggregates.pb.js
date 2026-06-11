// An external cron service sends a POST to /api/sync-aggregates with the
// `X-Sync-Key` header to trigger the aggregate sync.

routerAdd('POST', '/api/sync-aggregates', (c) => {
  const apiKey = c.request().header.get('X-Sync-Key');
  if (apiKey !== process.env.WEBHOOK_API_KEY) {
    return c.json(401, { error: 'unauthorized' });
  }

  const startTime = Date.now();

  // --- Build ratings map: pattern_id → { avg_rating, total_ratings } ---
  const ratingsMap = {};
  $app.findAllRecords('community_ratings').forEach((r) => {
    ratingsMap[r.getString('pattern_id')] = {
      avg_rating: r.getFloat('average_rating'),
      total_ratings: r.getInt('total_ratings'),
    };
  });

  // --- Build difficulty map: pattern_id → { avg_difficulty, total_difficulty_ratings } ---
  const diffMap = {};
  $app.findAllRecords('community_difficulty_ratings').forEach((r) => {
    diffMap[r.getString('pattern_id')] = {
      avg_difficulty: r.getFloat('average_rating'),
      total_difficulty_ratings: r.getInt('total_ratings'),
    };
  });

  // --- Build favorites map: pattern_id → count ---
  const favMap = {};
  $app.findAllRecords('user_favorites').forEach((r) => {
    const pid = r.getString('pattern_id');
    favMap[pid] = (favMap[pid] || 0) + 1;
  });

  // --- Update each pattern with computed aggregates ---
  const patterns = $app.findAllRecords('patterns');
  let updated = 0;

  // Wrap all saves in a single transaction — one commit instead of N,
  // and atomic so a mid-run failure doesn't leave partial data.
  $app.runInTransaction((txApp) => {
    patterns.forEach((p) => {
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

      txApp.save(p);
      updated++;
    });
  });

  return c.json(200, { ok: true, updated, elapsed_ms: Date.now() - startTime });
});
