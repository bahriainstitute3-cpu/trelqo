// Lightweight read-through cache used by the Firestore list helpers.
//
// Why: every time the user navigated back to Home / a category page the app
// re-downloaded the whole products + categories + banners collections from
// Firestore. That's what made the site feel slow. Now the first response is
// kept in memory (instant) and mirrored into localStorage (survives a full
// close + reopen), so the page paints immediately and only revalidates in
// the background.

const memory = new Map();
const inflight = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const PREFIX = "trelqo _cache_";

// localStorage (not sessionStorage) on purpose: the snapshot has to survive
// the user fully closing the tab/app, because that's exactly the moment
// people complain about — "jab open karta hoon to time lagta hai". With this,
// a returning visitor sees the previous screen painted instantly while the
// fresh data loads behind it.
function readStore(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(key, entry) {
  const value = entry.v;

  // Big arrays can blow the ~5 MB localStorage budget. Persist as much as
  // fits, newest first — a partial snapshot still paints instantly and the
  // full list arrives from the background revalidation a moment later.
  const attempts = Array.isArray(value)
    ? [value, value.slice(0, 200), value.slice(0, 60), value.slice(0, 20)]
    : [value];

  for (const candidate of attempts) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ t: entry.t, v: candidate }));
      return;
    } catch {
      // too big / private mode — try a smaller slice
    }
  }

  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Synchronous peek: returns cached data (even if stale) or null. */
export function peekCache(key) {
  const hit = memory.get(key) || readStore(key);
  if (hit) memory.set(key, hit);
  return hit ? hit.v : null;
}

/**
 * Read-through cache.
 *  - fresh hit  -> returned instantly, no network
 *  - stale hit  -> returned instantly, refreshed in the background
 *  - miss       -> awaits the fetcher
 * Concurrent callers for the same key share one network request.
 */
export async function cached(key, fetcher, ttl = DEFAULT_TTL) {
  const hit = memory.get(key) || readStore(key);
  const now = Date.now();

  if (hit) {
    memory.set(key, hit);
    if (now - hit.t < ttl) return hit.v;
    // Stale: return immediately, revalidate in the background.
    revalidate(key, fetcher);
    return hit.v;
  }

  return revalidate(key, fetcher);
}

function revalidate(key, fetcher) {
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await fetcher();
      const entry = { t: Date.now(), v: value };
      memory.set(key, entry);
      writeStore(key, entry);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Drop cached entries so the next read hits Firestore again. */
export function invalidateCache(prefix = "") {
  for (const key of [...memory.keys()]) {
    if (!prefix || key.startsWith(prefix)) memory.delete(key);
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + prefix)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
