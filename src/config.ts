import type { Config } from "./types.ts";

export const config: Config = {
  fragmentSuffix: "/_fragment.html",
  requestClass: "dp-request",
  settlingClass: "dp-settling",
  defaultBoostTarget: "body",
  timeout: 10_000,
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
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") + config.fragmentSuffix;
  return parsed.pathname + parsed.search + parsed.hash;
}
