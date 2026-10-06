import { config, configure, fragmentUrl } from "./config.ts";
import { hydrate } from "./islands.ts";
import { bindHistory, process } from "./process.ts";
import { perform } from "./request.ts";
import * as prefetching from "./prefetch.ts";
import * as swap from "./swap.ts";

export type {
  Config,
  HistoryEntry,
  RequestSpec,
  SwapSpec,
  SwapStyle,
  TriggerSpec,
} from "./types.ts";
export type { DpEventName } from "./events.ts";
export type { ClientDirective, Mount } from "./islands.ts";
export { config, configure, fragmentUrl, hydrate, perform, process };

/**
 * Binds the document and starts listening for history navigation. Content
 * swapped in later is processed automatically, so this is the only call a
 * page needs to make.
 */
export function start(doc: Document = document): void {
  process(doc);
  hydrate(doc);
  bindHistory(doc);

  doc.addEventListener("dp:afterSwap", (event) => {
    const target = event.target as Element | null;
    if (!target || !("querySelectorAll" in target)) return;

    process(target);
    hydrate(target);
  });
}

export const swapping = swap;
export const prefetch = prefetching;

// Opt *out* with data-dp-auto="false", rather than opt in.
//
// This read `hasAttribute("data-dp-auto") !== false`, which is only true when
// the attribute is present — so a plain <script src="dpswap.min.js"> never
// started, and every boosted link fell back to a full page load. The bundle
// loaded, configured cleanly and did nothing, which is why it went unnoticed.
const auto = globalThis.document;
if (auto && auto.currentScript?.getAttribute("data-dp-auto") !== "false") {
  if (auto.readyState === "loading") {
    auto.addEventListener("DOMContentLoaded", () => start(auto), { once: true });
  } else {
    start(auto);
  }
}
