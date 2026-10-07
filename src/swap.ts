import { config } from "./config.ts";
import { attr } from "./attrs.ts";
import type { SwapSpec, SwapStyle } from "./types.ts";
import { SWAP_STYLES } from "./types.ts";

/** Parses a response body into detached nodes belonging to `doc`. */
export function parseFragment(doc: Document, html: string): DocumentFragment {
  const template = doc.createElement("template");
  template.innerHTML = html;
  return template.content;
}

/**
 * Narrows a parsed response to the part named by `dp-select`. A missing match
 * yields an empty fragment rather than swapping the whole response in, so a
 * selector typo fails visibly instead of replacing the page.
 */
export function selectFrom(
  doc: Document,
  fragment: DocumentFragment,
  selector: string | null,
): DocumentFragment {
  if (!selector) return fragment;

  const result = doc.createDocumentFragment();
  for (const match of Array.from(fragment.querySelectorAll(selector))) {
    result.appendChild(match);
  }
  return result;
}

/**
 * Applies elements marked `dp-swap-oob` anywhere else in the document, and
 * removes them from the incoming fragment. The attribute value is a swap
 * style, optionally followed by a selector; with no selector the element's own
 * id names its destination.
 */
export function applyOutOfBand(doc: Document, fragment: DocumentFragment): void {
  const marked = Array.from(fragment.querySelectorAll("[dp-swap-oob]"));

  for (const el of marked) {
    const value = attr(el, "swap-oob") ?? "outerHTML";
    const [styleToken, selectorToken] = splitOob(value);
    const selector = selectorToken ?? (el.id ? `#${el.id}` : null);

    el.removeAttribute("dp-swap-oob");
    el.remove();

    if (!selector) continue;
    const destination = doc.querySelector(selector);
    if (!destination) continue;

    // `outerHTML` replaces the destination with the marked element itself;
    // every other style positions its children, so the wrapper is a carrier
    // rather than part of the content.
    const content = doc.createDocumentFragment();
    if (styleToken === "outerHTML") content.appendChild(el);
    else content.append(...Array.from(el.childNodes));

    swapInto(destination, content, { style: styleToken, scroll: null, delay: 0 });
  }
}

function splitOob(value: string): [SwapStyle, string | null] {
  const separator = value.indexOf(":");
  const style = separator === -1 ? value : value.slice(0, separator);
  const selector = separator === -1 ? null : value.slice(separator + 1);

  return [isSwapStyle(style) ? style : "outerHTML", selector || null];
}

function isSwapStyle(token: string): token is SwapStyle {
  return (SWAP_STYLES as readonly string[]).includes(token);
}

/** Places `content` relative to `target` according to the swap style. */
export function swapInto(target: Element, content: DocumentFragment, spec: SwapSpec): void {
  switch (spec.style) {
    case "innerHTML":
      target.replaceChildren(content);
      break;
    case "outerHTML":
      target.replaceWith(content);
      break;
    case "beforebegin":
      target.parentElement?.insertBefore(content, target);
      break;
    case "afterbegin":
      target.insertBefore(content, target.firstChild);
      break;
    case "beforeend":
      target.appendChild(content);
      break;
    case "afterend":
      target.parentElement?.insertBefore(content, target.nextSibling);
      break;
    case "delete":
      target.remove();
      break;
    case "none":
      break;
  }
}

/** Marks freshly swapped content so a stylesheet can animate it in. */
export function settle(target: Element, spec: SwapSpec): void {
  if (spec.style === "delete" || spec.style === "none") return;
  if (!target.isConnected) return;

  target.classList.add(config.settlingClass);
  queueMicrotask(() => target.classList.remove(config.settlingClass));

  if (spec.scroll === "top") target.scrollTop = 0;
  if (spec.scroll === "bottom") target.scrollTop = target.scrollHeight;
}

/**
 * Narrows a swap to the deepest layout both pages share.
 *
 * A prerendered partial contains every layout below the root, because the
 * server has no idea where the visitor is coming from. The client does: the
 * old DOM is right there. Walking both trees down their `dp-layout` markers
 * finds the last layer whose prefix matches on both sides, and only what is
 * below that is actually replaced.
 *
 * So moving between two guides leaves the docs sidebar untouched, while
 * arriving from outside the section replaces it. The returned element is also
 * what gets the settling class, so the animation covers exactly the region
 * that changed.
 *
 * Returns the original pair unchanged when there are no markers, which is the
 * case for a declared `dp-get` against a server that knows nothing about this.
 */
export function narrowToSharedLayout(
  target: Element,
  content: DocumentFragment,
): { target: Element; content: DocumentFragment } {
  // Not `attr`: that name is already the attribute-reading helper imported
  // above, and shadowing it here would be a trap for the next reader.
  const layoutAttr = config.layoutAttr;
  if (!layoutAttr) return { target, content };

  const selector = `[${layoutAttr}]`;
  let oldScope: ParentNode = target;
  let newScope: ParentNode = content;

  for (;;) {
    const oldLayer = oldScope.querySelector(selector);
    const newLayer = newScope.querySelector(selector);
    if (!oldLayer || !newLayer) break;
    if (oldLayer.getAttribute(layoutAttr) !== newLayer.getAttribute(layoutAttr)) break;
    oldScope = oldLayer;
    newScope = newLayer;
  }

  if (oldScope === target) return { target, content };

  // Move the shared layer's new children into a fragment of their own; the
  // layer element itself already exists in the page and is kept.
  const narrowed = target.ownerDocument.createDocumentFragment();
  narrowed.append(...Array.from(newScope.childNodes));
  return { target: oldScope as Element, content: narrowed };
}

/**
 * How many layout layers the live page and `url` have in common.
 *
 * Counted before the request, so the server can skip the layers the client is
 * keeping. It needs no manifest: the markers in the current document name the
 * prefixes this page sits under, and a prefix either covers the destination or
 * it does not. The first marker is the root, which every page shares.
 *
 * Returns 1 when nothing deeper matches, which is the whole-body partial.
 */
export function sharedLayerDepth(doc: Document, url: string): number {
  const attr = config.layoutAttr;
  if (!attr) return 1;

  // `location` is absent in a server-side or test DOM, so the optional chain
  // has to reach it as well as the view.
  const target = new URL(url, doc.defaultView?.location?.href ?? "http://localhost").pathname;
  const markers = [...doc.querySelectorAll(`[${attr}]`)].map((el) => el.getAttribute(attr) ?? "");

  let depth = 0;
  for (const prefix of markers) {
    const covers = prefix === "/" || target === prefix || target.startsWith(`${prefix}/`);
    if (!covers) break;
    depth++;
  }
  return Math.max(1, depth);
}

/**
 * The element holding layer `depth` of the live document.
 *
 * When the client asked for a partial by depth, the response contains only
 * what sits below that layer and therefore carries no markers of its own —
 * there is nothing to match against. There does not need to be: the depth was
 * computed here, from this document, so the destination is already known.
 *
 * Returns null when the document is not that deep, which leaves the caller to
 * fall back to matching.
 */
export function layerTarget(root: ParentNode, depth: number): Element | null {
  const attr = config.layoutAttr;
  if (!attr || depth < 1) return null;

  let scope: ParentNode = root;
  let found: Element | null = null;
  for (let i = 0; i < depth; i++) {
    const next = scope.querySelector(`[${attr}]`);
    if (!next) return null;
    found = next;
    scope = next;
  }
  return found;
}
