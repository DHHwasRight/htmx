import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { parseHTML } from "linkedom";
import { config, configure, fragmentUrl, requestHeaders } from "../src/config.ts";
import { narrowToSharedLayout, parseFragment, sharedLayerDepth } from "../src/swap.ts";

const defaults = { ...config };
afterEach(() => configure(defaults));

function doc(html: string) {
  return parseHTML(`<html><body>${html}</body></html>`).document as unknown as Document;
}

/** The live page: a root outlet holding two nested layouts and a page. */
const LIVE = `
  <main id="app">
    <div dp-layout="/docs"><aside>sidebar v1</aside><div class="body">
      <div dp-layout="/docs/guides"><nav>tabs v1</nav><article>install</article></div>
    </div></div>
  </main>`;

function narrow(incoming: string) {
  const d = doc(LIVE);
  const target = d.querySelector("#app")!;
  const result = narrowToSharedLayout(target, parseFragment(d, incoming));
  return {
    target: result.target.getAttribute("dp-layout") ?? result.target.id,
    html: Array.from(result.content.childNodes).map((n) => (n as Element).outerHTML ?? "").join(""),
  };
}

test("header mode leaves the URL alone and sets the partial header", () => {
  configure({ fragmentMode: "header" });
  assert.equal(fragmentUrl("/docs/guides/deploy"), "/docs/guides/deploy");
  assert.deepEqual(requestHeaders(true), { "DP-Request": "true", "DP-Partial": "true" });
  // A declared dp-get is not a fragment request, so it carries no marker.
  assert.deepEqual(requestHeaders(false), { "DP-Request": "true" });
});

test("suffix mode still rewrites the URL and sends no partial header", () => {
  configure({ fragmentMode: "suffix" });
  assert.equal(fragmentUrl("/docs/guides/deploy"), "/docs/guides/deploy/_fragment.html");
  assert.deepEqual(requestHeaders(true), { "DP-Request": "true" });
});

test("the header name is configurable", () => {
  configure({ fragmentMode: "header", partialHeader: "X-Partial" });
  assert.deepEqual(requestHeaders(true), { "DP-Request": "true", "X-Partial": "true" });
});

test("staying in the deepest section replaces only that section's contents", () => {
  const { target, html } = narrow(`
    <div dp-layout="/docs"><aside>sidebar v2</aside><div class="body">
      <div dp-layout="/docs/guides"><nav>tabs v2</nav><article>deploy</article></div>
    </div></div>`);

  // Both layers matched, so the swap lands inside /docs/guides: the docs
  // sidebar is never touched, and never animates.
  assert.equal(target, "/docs/guides");
  assert.match(html, /tabs v2/);
  assert.match(html, /deploy/);
  assert.doesNotMatch(html, /sidebar/);
});

test("entering a section from a sibling replaces the section but not its parent", () => {
  const { target, html } = narrow(`
    <div dp-layout="/docs"><aside>sidebar v2</aside><div class="body">
      <section>reference page, no guides layout</section>
    </div></div>`);

  // /docs matched, /docs/guides is absent from the response, so the swap stops
  // at /docs and replaces everything below it.
  assert.equal(target, "/docs");
  assert.match(html, /reference page/);
  assert.match(html, /sidebar v2/);
});

test("arriving from outside replaces the whole outlet", () => {
  const { target, html } = narrow(`<section>about page, no layouts at all</section>`);
  assert.equal(target, "app");
  assert.match(html, /about page/);
});

test("a different section at the same depth is not treated as shared", () => {
  const { target, html } = narrow(`
    <div dp-layout="/blog"><aside>blog sidebar</aside><article>post</article></div>`);
  assert.equal(target, "app");
  assert.match(html, /blog sidebar/);
});

test("narrowing is off when no layout attribute is configured", () => {
  configure({ layoutAttr: null });
  const { target } = narrow(`<div dp-layout="/docs"><p>x</p></div>`);
  assert.equal(target, "app");
});

test("the shared depth counts the layers the page already has", () => {
  const d = doc(`
    <main dp-layout="/">
      <div dp-layout="/alpha">
        <div dp-layout="/alpha/card-2"><p>panel</p></div>
      </div>
    </main>`);

  // Same card, different panel: everything matches, so only the panel is wanted.
  assert.equal(sharedLayerDepth(d, "/alpha/card-2/details"), 3);
  // A different card: the section still matches, the card does not.
  assert.equal(sharedLayerDepth(d, "/alpha/card-5/overview"), 2);
  // A different section: only the root matches.
  assert.equal(sharedLayerDepth(d, "/beta"), 1);
  // Nothing in common beyond the root.
  assert.equal(sharedLayerDepth(d, "/"), 1);
});

test("the depth rides on the partial header", () => {
  configure({ fragmentMode: "header" });
  assert.equal(requestHeaders(true, 3)["DP-Partial"], "3");
  // One level is sent as `true`, so a client that does not count still works.
  assert.equal(requestHeaders(true, 1)["DP-Partial"], "true");
  assert.equal(requestHeaders(false, 3)["DP-Partial"], undefined);
});

test("depth is 1 when layout markers are switched off", () => {
  configure({ layoutAttr: null });
  const d = doc(`<main dp-layout="/"><div dp-layout="/alpha"></div></main>`);
  assert.equal(sharedLayerDepth(d, "/alpha/x"), 1);
});
