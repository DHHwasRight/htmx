import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { parseHTML } from "linkedom";
import { config, configure, configureFromDocument, fragmentUrl, withoutBase } from "../src/config.ts";
import * as prefetch from "../src/prefetch.ts";
import { process } from "../src/process.ts";
import { sharedLayerDepth } from "../src/swap.ts";
import { click, flush, harness } from "./helpers.ts";

const defaults = { ...config };
afterEach(() => configure(defaults));

function doc(html: string, head = "") {
  return parseHTML(`<html><head>${head}</head><body>${html}</body></html>`).document as unknown as Document;
}

test("a base path puts the partial tree under the base, with routes mirrored without it", () => {
  configure({ partialDir: "partials", base: "/d3set" });
  assert.equal(fragmentUrl("/d3set/charts/bar", undefined, 2), "/d3set/partials/2/charts/bar");
  assert.equal(fragmentUrl("/d3set/", undefined, 1), "/d3set/partials/1/");
  assert.equal(fragmentUrl("/d3set", undefined, 1), "/d3set/partials/1/");
  assert.equal(fragmentUrl("/d3set/guide?x=1#top", undefined, 1), "/d3set/partials/1/guide?x=1#top");
});

test("the base is normalised", () => {
  for (const base of ["/d3set", "/d3set/", "d3set", "d3set/"]) {
    configure({ partialDir: "partials", base });
    assert.equal(fragmentUrl("/d3set/charts", undefined, 2), "/d3set/partials/2/charts", base);
  }
});

test("a pathname outside the base is used unchanged", () => {
  configure({ partialDir: "partials", base: "/d3set" });
  assert.equal(withoutBase("/other/page"), "/other/page");
  assert.equal(withoutBase("/d3setx/page"), "/d3setx/page");
  assert.equal(fragmentUrl("/other/page", undefined, 1), "/d3set/partials/1/other/page");
});

test("no base keeps the root layout", () => {
  configure({ partialDir: "partials" });
  assert.equal(fragmentUrl("/charts", undefined, 2), "/partials/2/charts");
});

test("layout markers rendered with the base match the full pathname", () => {
  configure({ base: "/d3set" });
  const d = doc(`<main dp-layout="/d3set/"><div dp-layout="/d3set/charts"><p>bar</p></div></main>`);
  assert.equal(sharedLayerDepth(d, "/d3set/charts/line"), 2);
  assert.equal(sharedLayerDepth(d, "/d3set/guide"), 1);
});

test("layout markers rendered without the base still match", () => {
  configure({ base: "/d3set" });
  const d = doc(`<main dp-layout="/"><div dp-layout="/charts"><p>bar</p></div></main>`);
  assert.equal(sharedLayerDepth(d, "/d3set/charts/line"), 2);
  assert.equal(sharedLayerDepth(d, "/d3set/dashboards/ops"), 1);
});

test("a navigation on a base-path site fetches the partial under the base", async () => {
  configure({ partialDir: "partials", base: "/d3set" });
  const { doc, requested } = harness(
    `<nav dp-boost dp-target="#app"><a id="link" href="/d3set/charts/line">Line</a></nav>
     <main id="app" dp-layout="/d3set/">
       <div dp-layout="/d3set/charts"><p>bar</p></div>
     </main>`,
    { "/d3set/partials/2/charts/line": "<p>line</p>" },
  );
  process(doc);

  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, ["/d3set/partials/2/charts/line"]);
  assert.equal(doc.querySelector('[dp-layout="/d3set/charts"]')!.innerHTML, "<p>line</p>");
});

test("a prefetch on a base-path site is used by the click", async () => {
  configure({ partialDir: "partials", base: "/d3set" });
  prefetch.clear();
  const { doc, requested } = harness(
    `<nav dp-boost dp-prefetch dp-target="#app"><a id="link" href="/d3set/charts/line">Line</a></nav>
     <main id="app" dp-layout="/d3set/"><div dp-layout="/d3set/charts"><p>bar</p></div></main>`,
    { "/d3set/partials/2/charts/line": "<p>line</p>" },
  );
  process(doc);

  const link = doc.querySelector("#link")!;
  link.dispatchEvent(new (doc.defaultView!).Event("pointerenter", { bubbles: true }));
  await flush();
  click(link);
  await flush();

  assert.deepEqual(requested, ["/d3set/partials/2/charts/line"]);
  assert.equal(doc.querySelector('[dp-layout="/d3set/charts"]')!.innerHTML, "<p>line</p>");
});

test("a meta element configures the library", () => {
  const d = doc("", `<meta name="dp-config" content='{"partialDir":"partials","base":"/d3set"}'>`);
  configureFromDocument(d);
  assert.equal(config.partialDir, "partials");
  assert.equal(config.base, "/d3set");
});

test("a meta element cannot set fetch, unknown keys, or the wrong type", () => {
  const d = doc(
    "",
    `<meta name="dp-config" content='{"fetch":"x","nope":1,"timeout":"slow","prefetchLimit":4,"layoutAttr":null}'>`,
  );
  configureFromDocument(d);
  assert.equal(typeof config.fetch, "function");
  assert.equal("nope" in config, false);
  assert.equal(config.timeout, defaults.timeout);
  assert.equal(config.prefetchLimit, 4);
  assert.equal(config.layoutAttr, null);
});

test("invalid meta JSON is ignored", () => {
  configureFromDocument(doc("", `<meta name="dp-config" content="{nope">`));
  assert.equal(config.partialDir, defaults.partialDir);
});
