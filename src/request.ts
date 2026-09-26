import { config, fragmentUrl } from "./config.ts";
import { dispatch } from "./events.ts";
import { applyOutOfBand, parseFragment, selectFrom, settle, swapInto } from "./swap.ts";
import type { RequestSpec } from "./types.ts";

/**
 * Runs one request: fetch the prerendered fragment, swap it in, settle it.
 *
 * A boosted navigation that fails falls back to a normal page load, so a
 * missing fragment or an offline moment degrades to what the browser would
 * have done anyway rather than leaving the page stuck.
 */
export async function perform(spec: RequestSpec): Promise<void> {
  if (!dispatch(spec.source, "dp:beforeRequest", { spec })) return;

  const url = fragmentUrl(spec.url, documentBase(spec.source));
  const indicator = spec.indicator;
  indicator?.classList.add(config.requestClass);

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      dispatch(spec.source, "dp:responseError", { spec, response });
      if (spec.boosted) navigate(spec.source, spec.url);
      return;
    }

    apply(spec, await response.text());
  } catch (error) {
    dispatch(spec.source, "dp:sendError", { spec, error });
    if (spec.boosted) navigate(spec.source, spec.url);
  } finally {
    indicator?.classList.remove(config.requestClass);
    dispatch(spec.source, "dp:afterRequest", { spec });
  }
}

function apply(spec: RequestSpec, html: string): void {
  const doc = spec.target.ownerDocument;

  const parsed = parseFragment(doc, html);
  applyOutOfBand(doc, parsed);
  const content = selectFrom(doc, parsed, spec.select);

  if (!dispatch(spec.target, "dp:beforeSwap", { spec, content })) return;

  // Resolved before the swap: a style that replaces or removes the target
  // leaves it detached, and an event on a detached node reaches no listener.
  const root = swapRoot(spec);

  swapInto(spec.target, content, spec.swap);
  dispatch(root, "dp:afterSwap", { spec });

  settle(spec.target, spec.swap);
  dispatch(root, "dp:afterSettle", { spec });
}

/**
 * The connected element containing whatever the swap produced. Listeners bind
 * new content by processing this, so it has to hold the new nodes and survive
 * the swap.
 */
function swapRoot(spec: RequestSpec): Element {
  switch (spec.swap.style) {
    case "innerHTML":
    case "afterbegin":
    case "beforeend":
    case "none":
      return spec.target;
    default:
      return spec.target.parentElement ?? spec.target.ownerDocument.documentElement;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    return await config.fetch(url, {
      signal: controller.signal,
      headers: { "DP-Request": "true" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function documentBase(el: Element): string | undefined {
  return el.ownerDocument.defaultView?.location.href;
}

/** Hands the navigation back to the browser, which is the whole fallback. */
function navigate(source: Element, url: string): void {
  source.ownerDocument.defaultView?.location?.assign(url);
}
