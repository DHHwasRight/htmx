import { parseHTML } from "linkedom";
import { configure } from "../src/config.ts";

export interface Harness {
  doc: Document;
  /** Every fragment URL requested, in order. */
  requested: string[];
}

/**
 * Builds a document with a stubbed fetch, so a test states what the server
 * would return and then asserts what ended up in the DOM.
 */
export function harness(html: string, responses: Record<string, string> = {}): Harness {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  const requested: string[] = [];

  // linkedom has no location by default; requests resolve against this.
  Object.defineProperty(window, "location", {
    value: new URL("http://test.local/"),
    configurable: true,
  });

  configure({
    fetch: async (input) => {
      const url = String(input);
      requested.push(url);

      const body = responses[url];
      return body === undefined
        ? new Response("not found", { status: 404 })
        : new Response(body, { status: 200 });
    },
  });

  return { doc: document as unknown as Document, requested };
}

/** Lets queued microtasks and the awaited fetch chain finish. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Dispatches a click. linkedom has no MouseEvent, so the mouse properties the
 * library reads are attached to a plain event - which is also a check that the
 * library only reads what it declares it reads.
 */
export function click(el: Element, mouse: Partial<MouseEvent> = {}): void {
  const view = el.ownerDocument.defaultView!;
  const event = new view.Event("click", { bubbles: true, cancelable: true });
  Object.assign(event, { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, mouse);
  el.dispatchEvent(event);
}
