import { start, type Extension } from "./index.ts";

/**
 * Starts the library when the script tag loads, for the prebuilt bundles.
 *
 * The ES module does not call this: an import must have no side effects, or a
 * bundler cannot drop what the page does not use, and a page that calls
 * `start` itself would bind everything twice.
 *
 * Opt *out* with data-dp-auto="false", rather than opt in. This once read
 * `hasAttribute("data-dp-auto") !== false`, which is only true when the
 * attribute is present — so a plain <script src="dpswap.min.js"> never
 * started, and every boosted link fell back to a full page load. The bundle
 * loaded, configured cleanly and did nothing, which is why it went unnoticed.
 */
export function autoStart(extensions: readonly Extension[]): void {
  const doc = globalThis.document;
  // `currentScript` is only set while the script first runs, so read it now.
  if (!doc || doc.currentScript?.getAttribute("data-dp-auto") === "false") return;

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", () => start(doc, extensions), { once: true });
  } else {
    start(doc, extensions);
  }
}
