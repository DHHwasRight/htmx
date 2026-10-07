import type { Config } from "./types.ts";

export const config: Config = {
  fragmentSuffix: "/_fragment.html",
  fragmentMode: "suffix",
  partialHeader: "DP-Partial",
  layoutAttr: "dp-layout",
  requestClass: "dp-request",
  settlingClass: "dp-settling",
  defaultBoostTarget: "body",
  timeout: 10_000,
  prefetchLimit: 32,
  fetch: (...args) => globalThis.fetch(...args),
};

export function configure(overrides: Partial<Config>): void {
  Object.assign(config, overrides);
}

/**
 * Maps a page URL to the URL of its prerendered fragment.
 *
 * This is the whole reason dp-swap exists without a server: every route is
 * built twice, once as a full document and once as the content alone, so a
 * partial navigation is a static file read.
 */
export function fragmentUrl(url: string, base?: string): string {
  const parsed = new URL(url, base ?? "http://localhost");
  // In header mode the fragment lives at the page's own URL; the server picks
  // the representation. Nothing to rewrite.
  if (config.fragmentMode === "header") {
    return parsed.pathname + parsed.search + parsed.hash;
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") + config.fragmentSuffix;
  return parsed.pathname + parsed.search + parsed.hash;
}

/**
 * Headers for a request, including the partial marker when one is wanted.
 *
 * The marker carries a number: how many layout layers the client already has
 * and does not need sent back. The server keeps one prerendered tree per
 * depth, so asking for `3` returns what sits below the third layer rather than
 * the whole page below the root. `true` means one, for a caller that does not
 * count layers.
 */
export function requestHeaders(fragment: boolean, depth = 1): Record<string, string> {
  const headers: Record<string, string> = { "DP-Request": "true" };
  if (fragment && config.fragmentMode === "header") {
    headers[config.partialHeader] = depth > 1 ? String(depth) : "true";
  }
  return headers;
}
