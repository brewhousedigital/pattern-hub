/**
 * Processes a list of items one at a time, awaiting each before starting the
 * next, with a delay between calls. This keeps a bulk write operation from
 * sending PocketBase a burst of near-simultaneous requests from the browser.
 *
 * Extracted from the admin tag manager's rename/merge/delete flow
 * (RenameOrMergePanel in src/routes/space-command/tags.tsx), which proved
 * this shape out first. Reused by browser-side admin code that changes
 * later in the tag redesign (see TAG_REDESIGN_PROJECT_NOTES.md).
 *
 * The standalone Node scripts under scripts/ (the Phase 1 and Phase 2
 * backfills, for example) cannot import this file - a plain .mjs script
 * can't import a .ts file from src/ directly - so each of those keeps its
 * own small inline copy of this same loop shape instead. This comment
 * previously claimed those scripts reused this function; they don't, and
 * a future change here won't reach them. Corrected via code review, see
 * TAG_REDESIGN_PROJECT_NOTES.md.
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
