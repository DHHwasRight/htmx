import type { HistoryEntry } from "./types.ts";

const KEY = "dpswap";

/**
 * Records the URL along with enough of the swap to repeat it. Without this a
 * back navigation would know where to go but not what part of the page to
 * replace.
 *
 * The History object is taken from the document rather than the global scope,
 * so a document without one - a test DOM, a server-side render - is a no-op
 * instead of a crash.
 */
export function push(doc: Document, url: string, entry: HistoryEntry): void {
  doc.defaultView?.history?.pushState({ [KEY]: entry }, "", url);
}

export function replace(doc: Document, url: string, entry: HistoryEntry): void {
  doc.defaultView?.history?.replaceState({ [KEY]: entry }, "", url);
}

export function read(state: unknown): HistoryEntry | null {
  if (!state || typeof state !== "object") return null;

  const entry = (state as Record<string, unknown>)[KEY];
  if (!entry || typeof entry !== "object") return null;

  const { target, select } = entry as Record<string, unknown>;
  if (typeof target !== "string") return null;

  return { target, select: typeof select === "string" ? select : null };
}
