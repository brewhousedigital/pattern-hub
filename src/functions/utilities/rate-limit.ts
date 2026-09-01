// rate-limit.ts
// Helpers for the global 429 / CORS rate-limit handling installed on window.fetch
// in authentication-setup.ts, and consumed by RateLimitModal to tell the user how
// long the server needs.

// The PocketHost rate limiter sends 429s with no Retry-After header, only a
// plain-text body, e.g.:
//   "Too Many Requests: per-IP hourly limit of 1,000 requests/hour exceeded for
//    IP 72.182.231.209 on instance stained-glass.pockethost.io; retry after 2405
//    seconds"
// Reads a *clone* of the response so the original body is still available to
// whatever called fetch. Falls back to the standard Retry-After header (seconds,
// or an HTTP date) first, in case that ever gets added upstream.
export async function parseRetryAfterSeconds(response: Response): Promise<number | null> {
  const header = response.headers.get('Retry-After');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds);

    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) return Math.max(0, Math.round((dateMs - Date.now()) / 1000));
  }

  try {
    const text = await response.clone().text();
    const match = text.match(/retry after (\d+) seconds?/i);
    if (match) return Number(match[1]);
  } catch {
    // Body already consumed, or not readable as text - no retry time available.
  }

  return null;
}

// Renders a countdown as whole minutes, rounded, once 60 seconds or more remain.
// Below that it shows the exact seconds, so the last minute still counts down
// (59s, 58s, ...) instead of sitting on "1 minute" until it hits zero.
export function formatRetryCountdown(secondsLeft: number): string {
  const seconds = Math.max(0, Math.round(secondsLeft));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;

  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
