import { attr, hasAttr, inherited, parseSwap, parseTrigger, resolveTarget } from "./attrs.ts";
import { config } from "./config.ts";
import * as history from "./history.ts";
import { perform } from "./request.ts";
import type { RequestSpec } from "./types.ts";

const BOUND = new WeakSet<Element>();

/**
 * Binds every element in the subtree that declares a request, plus boosted
 * links. Safe to call repeatedly: elements already bound are skipped, which is
 * what lets swapped-in content be processed without rebinding the page.
 */
export function process(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll("[dp-get]"))) {
    bindRequest(el);
  }
  if (isElement(root) && hasAttr(root, "get")) bindRequest(root);

  for (const el of Array.from(root.querySelectorAll("[dp-boost]"))) {
    bindBoost(el);
  }
  if (isElement(root) && hasAttr(root, "boost")) bindBoost(root);
}

function isElement(node: ParentNode): node is Element {
  return "getAttribute" in node;
}

// --- Declared requests -------------------------------------------------

function bindRequest(el: Element): void {
  if (BOUND.has(el)) return;
  BOUND.add(el);

  const trigger = parseTrigger(attr(el, "trigger"), el);
  const listener = throttled(trigger.throttle, (event: Event) => {
    if (isNavigational(el)) event.preventDefault();
    if (trigger.changed && !valueChanged(el)) return;

    const spec = specFor(el);
    if (!spec) return;

    if (trigger.delay > 0) setTimeout(() => void perform(spec), trigger.delay);
    else void perform(spec);
  });

  if (trigger.event === "load") {
    listener(new Event("load"));
    return;
  }

  if (trigger.event === "revealed") {
    observe(el, listener);
    return;
  }

  const source = trigger.from
    ? (el.ownerDocument.querySelector(trigger.from) ?? el)
    : el;

  source.addEventListener(trigger.event, listener, { once: trigger.once });
}

function specFor(el: Element): RequestSpec | null {
  const url = attr(el, "get");
  if (!url) return null;

  const target = resolveTarget(el, inherited(el, "target"));
  if (!target) return null;

  const push = inherited(el, "push-url");

  return {
    source: el,
    url,
    target,
    swap: parseSwap(inherited(el, "swap")),
    select: inherited(el, "select"),
    pushUrl: push === "true" ? url : push === "false" || push === null ? null : push,
    indicator: resolveTarget(el, inherited(el, "indicator")),
    boosted: false,
  };
}

// --- Boosted navigation ------------------------------------------------

/**
 * Turns ordinary links inside the element into partial navigations. The link
 * keeps its href, so without JavaScript - and for a crawler - it is still a
 * plain link to a complete page.
 */
function bindBoost(el: Element): void {
  if (BOUND.has(el)) return;
  BOUND.add(el);

  el.addEventListener("click", (event) => {
    const link = boostableLink(event);
    if (!link) return;

    event.preventDefault();

    const targetSelector = inherited(link, "target") ?? config.defaultBoostTarget;
    const target = resolveTarget(link, targetSelector);
    if (!target) return;

    const select = inherited(link, "select");
    const url = link.getAttribute("href") ?? "";

    history.push(link.ownerDocument, url, { target: targetSelector, select });

    void perform({
      source: link,
      url,
      target,
      swap: parseSwap(inherited(link, "swap") ?? "innerHTML"),
      select,
      pushUrl: url,
      indicator: resolveTarget(link, inherited(link, "indicator")),
      boosted: true,
    });
  });
}

/**
 * The link a click should boost, or null to let the browser handle it.
 *
 * The event is inspected by shape rather than by `instanceof MouseEvent`, so
 * the library does not depend on constructors that a given DOM implementation
 * may not expose.
 */
function boostableLink(event: Event): HTMLAnchorElement | null {
  if (event.defaultPrevented) return null;

  const mouse = event as MouseEvent;
  if (typeof mouse.button === "number" && mouse.button !== 0) return null;
  if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return null;

  const link = (event.target as Element | null)?.closest("a");
  if (!link || link.tagName.toLowerCase() !== "a") return null;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#")) return null;
  if (link.hasAttribute("download")) return null;

  const linkTarget = link.getAttribute("target");
  if (linkTarget && linkTarget !== "_self") return null;
  if (attr(link, "boost") === "false") return null;

  const view = link.ownerDocument.defaultView;
  if (view && new URL(href, view.location.href).origin !== view.location.origin) return null;

  return link;
}

/** Restores a swap when the user navigates back or forward. */
export function bindHistory(doc: Document): void {
  const view = doc.defaultView;
  if (!view) return;

  view.addEventListener("popstate", (event) => {
    const entry = history.read((event as PopStateEvent).state);
    if (!entry) return;

    const target = doc.querySelector(entry.target);
    if (!target) return;

    void perform({
      source: doc.documentElement,
      url: view.location.pathname + view.location.search,
      target,
      swap: { style: "innerHTML", scroll: "top", delay: 0 },
      select: entry.select,
      pushUrl: null,
      indicator: null,
      boosted: true,
    });
  });
}

// --- Helpers -----------------------------------------------------------

function isNavigational(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === "a" || tag === "form" || tag === "button";
}

const LAST_VALUE = new WeakMap<Element, string>();

function valueChanged(el: Element): boolean {
  const value = (el as HTMLInputElement).value ?? "";
  if (LAST_VALUE.get(el) === value) return false;

  LAST_VALUE.set(el, value);
  return true;
}

function throttled(ms: number, fn: (event: Event) => void): (event: Event) => void {
  if (ms <= 0) return fn;

  let last = 0;
  return (event: Event) => {
    const now = Date.now();
    if (now - last < ms) return;

    last = now;
    fn(event);
  };
}

function observe(el: Element, listener: (event: Event) => void): void {
  const view = el.ownerDocument.defaultView;
  if (!view || typeof view.IntersectionObserver !== "function") {
    listener(new Event("revealed"));
    return;
  }

  const observer = new view.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      observer.disconnect();
      listener(new Event("revealed"));
    }
  });
  observer.observe(el);
}
