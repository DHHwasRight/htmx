import type { Config } from "./types.ts";

export const config: Config = {
  fragmentSuffix: "/_fragment.html",
  fragmentMode: "suffix",
  partialHeader: "DP-Partial",
  partialDir: null,
  base: "",
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
 * The site's base path with one leading slash and no trailing one: `""`,
 * `"/d3set"`. `"/d3set/"` and `"d3set"` mean the same thing.
 */
export function basePath(): string {
  const trimmed = config.base.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

/**
 * A pathname without the site's base path: `/d3set/charts` → `/charts`. A
 * pathname outside the base is returned unchanged.
 */
export function withoutBase(pathname: string): string {
  const base = basePath();
  if (!base) return pathname;
  if (pathname === base) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

/**
 * Settings written in the document, so a static page needs no inline script:
 *
 *     <meta name="dp-config" content='{"partialDir":"partials","base":"/d3set"}'>
 *
 * Only the keys of `Config` that hold plain values are read. Invalid JSON is
 * ignored, and a later `configure()` call still wins.
 */
export function configureFromDocument(doc: Document): void {
  const content = doc.querySelector('meta[name="dp-config"]')?.getAttribute("content");
  if (!content) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== "object") return;
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "fetch" || !(key in config)) continue;
    const current = (config as unknown as Record<string, unknown>)[key];
    const nullable = key === "partialDir" || key === "layoutAttr";
    // A nullable key also takes a string; every other key keeps its type.
    const fits = value === null ? nullable : typeof value === typeof current || (nullable && typeof value === "string");
    if (fits) overrides[key] = value;
  }
  configure(overrides as Partial<Config>);
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
    // On a site under a base path (a GitHub project page), the tree sits
    // under the base too, and mirrors the routes without it.
    const path = withoutBase(parsed.pathname);
    return `${basePath()}/${dir}/${Math.max(1, depth)}${path}${parsed.search}${parsed.hash}`;
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
