import { config, configure, fragmentUrl } from "./config.ts";
import { bindHistory, process } from "./process.ts";
import { perform } from "./request.ts";
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
export { config, configure, fragmentUrl, perform, process };

/**
 * Binds the document and starts listening for history navigation. Content
 * swapped in later is processed automatically, so this is the only call a
 * page needs to make.
 */
export function start(doc: Document = document): void {
  process(doc);
  bindHistory(doc);

  doc.addEventListener("dp:afterSwap", (event) => {
    const target = event.target as Element | null;
    if (target && "querySelectorAll" in target) process(target);
  });
}

export const swapping = swap;

const auto = globalThis.document;
if (auto && auto.currentScript?.hasAttribute("data-dp-auto") !== false) {
  if (auto.readyState === "loading") {
    auto.addEventListener("DOMContentLoaded", () => start(auto), { once: true });
  } else {
    start(auto);
  }
}
