import type { Config } from "./types.ts";

export const config: Config = {
  fragmentSuffix: "/_fragment.html",
  fragmentMode: "suffix",
  partialHeader: "DP-Partial",
  partialDir: null,
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
export function fragmentUrl(url: string, base?: string, depth = 1): string {
  const parsed = new URL(url, base ?? "http://localhost");
  // A static host cannot read a header, so the depth goes into the path: one
  // directory per prerendered tree, each a mirror of the site's routes.
  if (config.partialDir !== null) {
    const dir = config.partialDir.replace(/^\/+|\/+$/g, "");
    return `/${dir}/${Math.max(1, depth)}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  // In header mode the fragment lives at the page's own URL; the server picks
  // the representation. Nothing to rewrite.
  if (config.fragmentMode === "header") {
    return parsed.pathname + parsed.search + parsed.hash;
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") + config.fragmentSuffix;
  return parsed.pathname + parsed.search + parsed.hash;
}

/**
 * Whether a fragment request tells the server how many layers to skip.
 *
 * Only then is the response trimmed. In suffix mode the full content arrives,
 * markers included, and has to be matched rather than placed by depth.
 */
export function negotiatesDepth(): boolean {
  return config.partialDir !== null || config.fragmentMode === "header";
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
  // With a partial directory the path already carries the depth.
  if (fragment && config.fragmentMode === "header" && config.partialDir === null) {
    headers[config.partialHeader] = depth > 1 ? String(depth) : "true";
  }
  return headers;
}
