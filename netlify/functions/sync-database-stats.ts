const PB_URL = 'https://stained-glass.pockethost.io';

// Weekly cron: hits the PocketBase-side route that computes and saves a new
// database_stats_snapshots row. All the actual computation lives server-side
// in pb_hooks/main.pb.js (/api/sync-database-stats) - this function is just
// the trigger, same division of labor as /api/sync-aggregates already uses
// with its own (external, not-in-this-repo) cron caller.
export default async () => {
  try {
    const res = await fetch(`${PB_URL}/api/sync-database-stats`, {
      method: 'POST',
      headers: { 'X-Sync-Key': process.env.WEBHOOK_API_KEY ?? '' },
    });

    const body = await res.json().catch(() => null);
    return Response.json({ ok: res.ok, status: res.status, body });
  } catch (err) {
    console.error('[sync-database-stats] Failed:', err);
    return Response.json({ error: 'Database stats sync failed' }, { status: 500 });
  }
};

export const config = { schedule: '@weekly' };
