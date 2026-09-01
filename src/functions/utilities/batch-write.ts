/**
 * Processes a list of items one at a time, awaiting each before starting the
 * next, with a delay between calls. This keeps a bulk write operation from
 * sending PocketBase a burst of near-simultaneous requests from the browser.
 *
 * Extracted from the admin tag manager's rename/merge/delete flow
 * (RenameOrMergePanel in src/routes/space-command/tags.tsx), which proved
 * this shape out first. The tag-redesign backfills described in
 * TAG_REDESIGN_PROJECT_NOTES.md (Phases 1, 2, 4, and 5) reuse this same
 * function instead of each writing their own copy.
 */
export async function processSequentially<T>(
  items: T[],
  processOne: (item: T) => Promise<void>,
  onProgress?: (completed: number, total: number) => void,
  delayMs = 3000,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await processOne(items[i]);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) {
      await sleep(delayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
