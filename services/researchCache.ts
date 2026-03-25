// Shared research cache and in-flight deduplication.
// Both researchService.ts and serpAnalysisService.ts import from here so
// concurrent callers across modules share the same in-flight guard.
//
// Cache layers:
//   1. sessionStorage (rc_<key>) — survives page reloads, 24-hour TTL
//   2. inFlightResearch Map      — deduplicates concurrent parallel calls within a session

export const RESEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
export const DFS_DEFAULT_LOCATION = 2356; // India

// In-flight map only needs to live for the duration of parallel calls
export const inFlightResearch = new Map<string, Promise<any[]>>();

// ─── sessionStorage helpers ────────────────────────────────────────────────────

export function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`rc_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > RESEARCH_CACHE_TTL) {
      sessionStorage.removeItem(`rc_${key}`);
      return null;
    }
    console.log('[Cache] Reading key:', `rc_${key}`, 'age:', Math.round((Date.now() - parsed.timestamp) / 60000), 'mins');
    return parsed.data as T;
  } catch (e) {
    console.error('[Cache] getCached error:', e);
    return null;
  }
}

export function setCache(key: string, data: unknown): void {
  try {
    const payload = JSON.stringify({ data, timestamp: Date.now() });
    sessionStorage.setItem(`rc_${key}`, payload);
    console.log('[Cache] Saved key:', `rc_${key}`, 'size:', payload.length, 'bytes');
  } catch (e) {
    console.error('[Cache] setCache error:', e);
    // Clear old rc_ entries and retry once
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith('rc_')) sessionStorage.removeItem(k);
    }
    try {
      sessionStorage.setItem(`rc_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* give up silently */ }
  }
}

// ─── DataForSEO SERP call ──────────────────────────────────────────────────────

export async function dfsSerpCall(
  service: 'dataforseo-serp-organic' | 'dataforseo-serp-maps' | 'dataforseo-serp-shopping',
  keyword: string,
  locationCode = DFS_DEFAULT_LOCATION,
  depth = 10,
): Promise<any[]> {
  const payload: Record<string, any> = {
    keyword,
    location_code: locationCode,
    language_code: 'en',
    depth,
  };
  if (service === 'dataforseo-serp-organic') payload.calculate_rectangles = false;

  const res = await fetch(`/api/proxy?service=${service}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([payload]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `DFS ${service} HTTP ${res.status}`);
  return data.tasks?.[0]?.result?.[0]?.items ?? [];
}

// ─── Shared item helpers — sessionStorage cache + in-flight deduplication ─────
// Keyword is normalized FIRST so "Best CMA coaching" and "best cma coaching"
// always produce the same cache key.
// Original (non-normalized) keyword is passed to the API — DataForSEO handles casing.

export async function getOrganicItems(
  keyword: string,
  locationCode = DFS_DEFAULT_LOCATION,
  depth = 10,
  caller = 'unknown',
): Promise<any[]> {
  const normalizedKw = keyword.trim().toLowerCase();
  const cacheKey = `organic_${normalizedKw}_${locationCode}`;

  const cached = getCached<any[]>(cacheKey);
  if (cached) {
    console.log('[Cache] ✅ sessionStorage HIT:', normalizedKw, '| caller:', caller);
    return cached;
  }
  if (inFlightResearch.has(cacheKey)) {
    console.log('[Cache] ✅ In-flight HIT:', normalizedKw, '| caller:', caller);
    return inFlightResearch.get(cacheKey)!;
  }

  console.log('[Cache] ❌ sessionStorage HIT: false | inFlight: false | caller:', caller, '→ FIRING NEW REQUEST for:', normalizedKw);
  const promise = (async () => {
    try {
      const items = await dfsSerpCall('dataforseo-serp-organic', keyword, locationCode, depth);
      if (items.length > 0) {
        setCache(cacheKey, items);
        console.log('[Cache] 💾 Stored in sessionStorage:', normalizedKw);
      }
      return items;
    } finally {
      inFlightResearch.delete(cacheKey);
    }
  })();

  inFlightResearch.set(cacheKey, promise);
  return promise;
}

export async function getMapsItems(
  keyword: string,
  locationCode = DFS_DEFAULT_LOCATION,
  depth = 10,
  caller = 'unknown',
): Promise<any[]> {
  const normalizedKw = keyword.trim().toLowerCase();
  const cacheKey = `maps_${normalizedKw}_${locationCode}`;

  const cached = getCached<any[]>(cacheKey);
  if (cached) {
    console.log('[Cache] ✅ sessionStorage HIT (maps):', normalizedKw, '| caller:', caller);
    return cached;
  }
  if (inFlightResearch.has(cacheKey)) {
    console.log('[Cache] ✅ In-flight HIT (maps):', normalizedKw, '| caller:', caller);
    return inFlightResearch.get(cacheKey)!;
  }

  console.log('[Cache] ❌ sessionStorage HIT: false (maps) | caller:', caller, '→ FIRING NEW REQUEST for:', normalizedKw);
  const promise = (async () => {
    try {
      const items = await dfsSerpCall('dataforseo-serp-maps', keyword, locationCode, depth);
      if (items.length > 0) setCache(cacheKey, items);
      return items;
    } finally {
      inFlightResearch.delete(cacheKey);
    }
  })();

  inFlightResearch.set(cacheKey, promise);
  return promise;
}

export async function getShoppingItems(
  keyword: string,
  locationCode = DFS_DEFAULT_LOCATION,
  depth = 10,
  caller = 'unknown',
): Promise<any[]> {
  const normalizedKw = keyword.trim().toLowerCase();
  const cacheKey = `shopping_${normalizedKw}_${locationCode}`;

  const cached = getCached<any[]>(cacheKey);
  if (cached) {
    console.log('[Cache] ✅ sessionStorage HIT (shopping):', normalizedKw, '| caller:', caller);
    return cached;
  }
  if (inFlightResearch.has(cacheKey)) {
    console.log('[Cache] ✅ In-flight HIT (shopping):', normalizedKw, '| caller:', caller);
    return inFlightResearch.get(cacheKey)!;
  }

  console.log('[Cache] ❌ sessionStorage HIT: false (shopping) | caller:', caller, '→ FIRING NEW REQUEST for:', normalizedKw);
  const promise = (async () => {
    try {
      const items = await dfsSerpCall('dataforseo-serp-shopping', keyword, locationCode, depth);
      if (items.length > 0) setCache(cacheKey, items);
      return items;
    } finally {
      inFlightResearch.delete(cacheKey);
    }
  })();

  inFlightResearch.set(cacheKey, promise);
  return promise;
}
