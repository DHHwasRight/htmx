/** Every event dp-swap dispatches, in lifecycle order. */
export type DpEventName =
  | "dp:beforeRequest"
  | "dp:beforeSwap"
  | "dp:afterSwap"
  | "dp:afterSettle"
  | "dp:afterRequest"
  | "dp:responseError"
  | "dp:sendError";

/**
 * Dispatches a cancelable event on the element. Returns false when a listener
 * called `preventDefault`, which callers treat as "stop here".
 *
 * The constructor comes from the element's own window rather than the global
 * scope, so the library works in any document, including the ones test runners
 * and server-side DOMs provide.
 */
export function dispatch(
  el: Element,
  name: DpEventName,
  detail: Record<string, unknown> = {},
): boolean {
  const view = el.ownerDocument.defaultView;
  const Ctor = view?.CustomEvent ?? globalThis.CustomEvent;

  return el.dispatchEvent(new Ctor(name, { detail, bubbles: true, cancelable: true }));
}
