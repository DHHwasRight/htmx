import { config, configure, configureFromDocument, fragmentUrl } from "./config.ts";
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
export { config, configure, configureFromDocument, fragmentUrl, perform, process };

/**
 * Runs on the document at start and on every subtree swapped in later.
 *
 * Islands are one: `start(document, [hydrate])`. Passing them in, rather than
 * calling them from here, is what lets a bundler drop a feature a site never
 * imports.
 */
export type Extension = (root: ParentNode) => void;

/**
 * Binds the document and starts listening for history navigation. Content
 * swapped in later is processed automatically, so this is the only call a
 * page needs to make. A `<meta name="dp-config">` in the document is applied
 * first.
 */
export function start(doc: Document = document, extensions: readonly Extension[] = []): void {
  configureFromDocument(doc);
  process(doc);
  for (const extend of extensions) extend(doc);
  bindHistory(doc);

  doc.addEventListener("dp:afterSwap", (event) => {
    const target = event.target as Element | null;
    if (!target || !("querySelectorAll" in target)) return;

    process(target);
    for (const extend of extensions) extend(target);
  });
}

export const swapping = swap;
export const prefetch = prefetching;
