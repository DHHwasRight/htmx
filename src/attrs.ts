import type { SwapSpec, SwapStyle, TriggerSpec } from "./types.ts";
import { SWAP_STYLES } from "./types.ts";

export const PREFIX = "dp-";

export function attr(el: Element, name: string): string | null {
  return el.getAttribute(PREFIX + name);
}

export function hasAttr(el: Element, name: string): boolean {
  return el.hasAttribute(PREFIX + name);
}

/**
 * Reads an attribute from the element or the nearest ancestor that declares
 * it. Inheritance is what lets a single `dp-target` on a container apply to
 * every link inside it.
 */
export function inherited(el: Element, name: string): string | null {
  let current: Element | null = el;
  while (current) {
    const value = current.getAttribute(PREFIX + name);
    if (value !== null) return value;
    current = current.parentElement;
  }
  return null;
}

/** The element an ancestor selector resolves against, or null if unresolvable. */
export function resolveTarget(el: Element, spec: string | null): Element | null {
  if (!spec || spec === "this") return el;

  if (spec.startsWith("closest ")) return el.closest(spec.slice(8).trim());
  if (spec.startsWith("find ")) return el.querySelector(spec.slice(5).trim());
  if (spec === "next") return el.nextElementSibling;
  if (spec === "previous") return el.previousElementSibling;

  return el.ownerDocument.querySelector(spec);
}

const DEFAULT_SWAP: SwapSpec = { style: "innerHTML", scroll: null, delay: 0 };

/**
 * Parses `dp-swap`: a style optionally followed by modifiers, as in
 * `outerHTML scroll:top` or `innerHTML swap:100ms`.
 */
export function parseSwap(value: string | null): SwapSpec {
  if (!value) return { ...DEFAULT_SWAP };

  const tokens = value.trim().split(/\s+/);
  const spec: SwapSpec = { ...DEFAULT_SWAP };

  for (const token of tokens) {
    if (isSwapStyle(token)) {
      spec.style = token;
    } else if (token === "scroll:top" || token === "scroll:bottom") {
      spec.scroll = token.slice(7) as "top" | "bottom";
    } else if (token.startsWith("swap:")) {
      spec.delay = parseTime(token.slice(5));
    }
  }

  return spec;
}

function isSwapStyle(token: string): token is SwapStyle {
  return (SWAP_STYLES as readonly string[]).includes(token);
}

/**
 * Parses `dp-trigger`: an event name followed by modifiers, as in
 * `click once`, `keyup changed delay:300ms` or `revealed`.
 */
export function parseTrigger(value: string | null, el: Element): TriggerSpec {
  const spec: TriggerSpec = {
    event: defaultEvent(el),
    once: false,
    delay: 0,
    throttle: 0,
    from: null,
    changed: false,
  };

  if (!value) return spec;

  const tokens = value.trim().split(/\s+/);
  const [event, ...modifiers] = tokens;
  if (event) spec.event = event;

  for (const modifier of modifiers) {
    if (modifier === "once") spec.once = true;
    else if (modifier === "changed") spec.changed = true;
    else if (modifier.startsWith("delay:")) spec.delay = parseTime(modifier.slice(6));
    else if (modifier.startsWith("throttle:")) spec.throttle = parseTime(modifier.slice(9));
    else if (modifier.startsWith("from:")) spec.from = modifier.slice(5);
  }

  return spec;
}

/** The event that makes sense for the element when none is declared. */
function defaultEvent(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "form") return "submit";
  if (tag === "input" || tag === "textarea" || tag === "select") return "change";
  return "click";
}

/** `300ms`, `1s` or a bare number of milliseconds. */
export function parseTime(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s)?$/.exec(value.trim());
  if (!match) return 0;

  const amount = Number(match[1]);
  return match[2] === "s" ? amount * 1000 : amount;
}
