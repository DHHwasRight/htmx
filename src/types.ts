/** Where new content goes relative to the target element. */
export type SwapStyle =
  | "innerHTML"
  | "outerHTML"
  | "beforebegin"
  | "afterbegin"
  | "beforeend"
  | "afterend"
  | "delete"
  | "none";

export const SWAP_STYLES: readonly SwapStyle[] = [
  "innerHTML",
  "outerHTML",
  "beforebegin",
  "afterbegin",
  "beforeend",
  "afterend",
  "delete",
  "none",
];

export interface SwapSpec {
  style: SwapStyle;
  /** Scroll the target into view after settling. */
  scroll: "top" | "bottom" | null;
  /** Delay before the swap, in milliseconds. */
  delay: number;
}

export interface TriggerSpec {
  event: string;
  once: boolean;
  /** Wait this long after the event before requesting. */
  delay: number;
  /** Ignore events arriving within this window of the last one. */
  throttle: number;
  /** Listen on a different element than the one carrying the attribute. */
  from: string | null;
  /** Only fire when the element's value actually changed. */
  changed: boolean;
}

export interface RequestSpec {
  /** Element that triggered the request. */
  source: Element;
  url: string;
  target: Element;
  swap: SwapSpec;
  /** CSS selector picking a subtree out of the response. */
  select: string | null;
  /** Push this URL into history, or null to leave history alone. */
  pushUrl: string | null;
  /** Element to mark as busy for the duration. */
  indicator: Element | null;
  /** A boosted navigation, which falls back to a full page load on error. */
  boosted: boolean;
}

export interface Config {
  /**
   * Appended to a pathname to address its prerendered fragment. Depoth emits
   * `<route>/index.html` for the full document and `<route>/_fragment.html`
   * for the content alone.
   */
  fragmentSuffix: string;
  /** Class placed on an indicator element while its request is in flight. */
  requestClass: string;
  /** Class placed on content that was just swapped in, for one frame. */
  settlingClass: string;
  /** Default target for a boosted navigation when none is declared. */
  defaultBoostTarget: string;
  /** How long to wait for a response before giving up, in milliseconds. */
  timeout: number;
  /** How many prefetched fragments to keep before discarding the oldest. */
  prefetchLimit: number;
  /** Fetch implementation, swappable for tests. */
  fetch: typeof fetch;
}

/** Shape stored in `history.state` so a popstate can repeat the swap. */
export interface HistoryEntry {
  target: string;
  select: string | null;
}
