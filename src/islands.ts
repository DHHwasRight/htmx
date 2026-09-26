import { attr } from "./attrs.ts";
import { dispatch } from "./events.ts";

/**
 * When an island takes over from the server-rendered markup beneath it.
 *
 * Every one of these is a decision to spend network and main thread on a piece
 * of the page, which is why there is no default: an island says when it is
 * worth it.
 */
export type ClientDirective =
  | { kind: "load" }
  | { kind: "idle" }
  | { kind: "visible" }
  | { kind: "media"; query: string };

/** What an island module exports. */
export type Mount = (element: HTMLElement, props: Record<string, unknown>) => void;

const HYDRATED = new WeakSet<Element>();

/**
 * Hydrates every island in the subtree.
 *
 * Safe to call repeatedly, and called again for content swapped in, so an
 * island that arrives through a partial navigation comes alive the same way
 * one in the first response does.
 */
export function hydrate(root: ParentNode): void {
  for (const element of Array.from(root.querySelectorAll("[dp-island]"))) {
    schedule(element as HTMLElement);
  }
  if (isElement(root) && root.hasAttribute("dp-island")) schedule(root as HTMLElement);
}

function isElement(node: ParentNode): node is Element {
  return "hasAttribute" in node;
}

function schedule(element: HTMLElement): void {
  if (HYDRATED.has(element)) return;
  HYDRATED.add(element);

  const directive = parseDirective(attr(element, "client"));
  const run = () => void mount(element);

  switch (directive.kind) {
    case "load":
      run();
      return;
    case "idle":
      whenIdle(element, run);
      return;
    case "visible":
      whenVisible(element, run);
      return;
    case "media":
      whenMedia(element, directive.query, run);
      return;
  }
}

/** `load`, `idle`, `visible`, or `media:(min-width: 40rem)`. */
export function parseDirective(value: string | null): ClientDirective {
  if (!value) return { kind: "load" };

  const trimmed = value.trim();
  if (trimmed.startsWith("media:")) return { kind: "media", query: trimmed.slice(6).trim() };
  if (trimmed === "idle") return { kind: "idle" };
  if (trimmed === "visible") return { kind: "visible" };

  return { kind: "load" };
}

async function mount(element: HTMLElement): Promise<void> {
  const source = attr(element, "island");
  if (!source) return;

  try {
    const module = await import(/* @vite-ignore */ source);
    const fn: Mount | undefined = module.default ?? module.mount;

    if (typeof fn !== "function") {
      throw new TypeError(`${source} exports no default function and no mount`);
    }

    fn(element, readProps(element));
    dispatch(element, "dp:island", { source });
  } catch (error) {
    // The server-rendered markup stays exactly as it was, so a failed island
    // degrades to the content it was enhancing rather than to a hole.
    dispatch(element, "dp:islandError", { source, error });
  }
}

/** Props the server serialised into the placeholder. */
export function readProps(element: Element): Record<string, unknown> {
  const raw = attr(element, "props");
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function whenIdle(element: HTMLElement, run: () => void): void {
  const view = element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const idle = view?.requestIdleCallback;

  idle ? idle.call(view, () => run()) : setTimeout(run, 1);
}

function whenVisible(element: HTMLElement, run: () => void): void {
  const view = element.ownerDocument.defaultView;
  if (!view || typeof view.IntersectionObserver !== "function") {
    run();
    return;
  }

  const observer = new view.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      observer.disconnect();
      run();
    }
  });
  observer.observe(element);
}

function whenMedia(element: HTMLElement, query: string, run: () => void): void {
  const view = element.ownerDocument.defaultView;
  if (!view || typeof view.matchMedia !== "function") {
    run();
    return;
  }

  const list = view.matchMedia(query);
  if (list.matches) {
    run();
    return;
  }

  const onChange = () => {
    if (!list.matches) return;

    list.removeEventListener("change", onChange);
    run();
  };
  list.addEventListener("change", onChange);
}
