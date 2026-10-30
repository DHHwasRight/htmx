import { config, fragmentUrl, requestHeaders } from "./config.ts";

/**
 * Fragments already fetched, or in flight.
 *
 * Keyed by fragment URL and bounded, so a long session hovering over a large
 * navigation cannot grow it without limit. The value is the promise rather
 * than the text, so hovering twice before the first response lands does not
 * fetch twice.
 */
const cache = new Map<string, Promise<string | null>>();

export function clear(): void {
  cache.clear();
}

export function size(): number {
  return cache.size;
}

/**
 * Starts fetching a page's fragment, unless it is already on its way.
 *
 * `depth` has to be the one the click will compute, or the click asks for a
 * different URL and the prefetch is wasted.
 */
export function prefetch(url: string, base?: string, depth = 1): void {
  const target = fragmentUrl(url, base, depth);
  if (cache.has(target)) return;

  evictOldest();
  cache.set(target, load(target, depth));
}

/**
 * The prefetched body for a fragment URL, or null if there is none and none
 * is coming. A failed prefetch resolves to null and is forgotten, so the real
 * request can report the failure itself.
 */
export function take(target: string): Promise<string | null> | null {
  return cache.get(target) ?? null;
}

async function load(target: string, depth: number): Promise<string | null> {
  try {
    const response = await config.fetch(target, { headers: requestHeaders(true, depth) });
    if (!response.ok) {
      cache.delete(target);
      return null;
    }
    return await response.text();
  } catch {
    cache.delete(target);
    return null;
  }
}

function evictOldest(): void {
  if (cache.size < config.prefetchLimit) return;

  const oldest = cache.keys().next();
  if (!oldest.done) cache.delete(oldest.value);
}
