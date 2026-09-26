import assert from "node:assert/strict";
import { test } from "node:test";
import { config, configure } from "../src/config.ts";
import * as prefetch from "../src/prefetch.ts";
import { process } from "../src/process.ts";
import { click, flush, harness } from "./helpers.ts";

function hover(el: Element): void {
  const view = el.ownerDocument.defaultView!;
  el.dispatchEvent(new view.Event("pointerenter", { bubbles: true }));
}

test("hovering a link fetches its fragment ahead of the click", async () => {
  prefetch.clear();
  const { doc, requested } = harness(
    `<nav dp-boost dp-prefetch dp-target="#c"><a id="link" href="/guides">Guides</a></nav><main id="c"></main>`,
    { "/guides/_fragment.html": "<h1>Guides</h1>" },
  );
  process(doc);

  hover(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, ["/guides/_fragment.html"]);
});

test("the click then swaps without fetching again", async () => {
  prefetch.clear();
  const { doc, requested } = harness(
    `<nav dp-boost dp-prefetch dp-target="#c"><a id="link" href="/guides">Guides</a></nav><main id="c"></main>`,
    { "/guides/_fragment.html": "<h1>Guides</h1>" },
  );
  process(doc);

  hover(doc.querySelector("#link")!);
  await flush();
  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, ["/guides/_fragment.html"]);
  assert.equal(doc.querySelector("#c")!.innerHTML, "<h1>Guides</h1>");
});

test("hovering twice fetches once", async () => {
  prefetch.clear();
  const { doc, requested } = harness(
    `<nav dp-boost dp-prefetch dp-target="#c"><a id="link" href="/guides">Guides</a></nav><main id="c"></main>`,
    { "/guides/_fragment.html": "<h1>Guides</h1>" },
  );
  process(doc);

  const link = doc.querySelector("#link")!;
  hover(link);
  hover(link);
  await flush();

  assert.equal(requested.length, 1);
});

test("nothing is prefetched without opting in", async () => {
  prefetch.clear();
  const { doc, requested } = harness(
    `<nav dp-boost dp-target="#c"><a id="link" href="/guides">Guides</a></nav><main id="c"></main>`,
    { "/guides/_fragment.html": "<h1>Guides</h1>" },
  );
  process(doc);

  hover(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, []);
});

test("a single link can opt out", async () => {
  prefetch.clear();
  const { doc, requested } = harness(
    `<nav dp-boost dp-prefetch dp-target="#c">
       <a id="in" href="/a">A</a>
       <a id="out" href="/b" dp-prefetch="false">B</a>
     </nav><main id="c"></main>`,
    { "/a/_fragment.html": "a", "/b/_fragment.html": "b" },
  );
  process(doc);

  hover(doc.querySelector("#out")!);
  await flush();
  assert.deepEqual(requested, []);

  hover(doc.querySelector("#in")!);
  await flush();
  assert.deepEqual(requested, ["/a/_fragment.html"]);
});

test("a failed prefetch leaves the click to fall back to a real navigation", async () => {
  prefetch.clear();
  const { doc, navigated } = harness(
    `<nav dp-boost dp-prefetch dp-target="#c"><a id="link" href="/gone">Gone</a></nav><main id="c">original</main>`,
  );
  process(doc);

  let errored = false;
  doc.addEventListener("dp:responseError", () => (errored = true));

  hover(doc.querySelector("#link")!);
  await flush();
  click(doc.querySelector("#link")!);
  await flush();

  assert.equal(errored, true);
  // The page is left alone and the browser is given the navigation, which is
  // what the whole design promises: a swap is an enhancement over a link.
  assert.deepEqual(navigated, ["/gone"]);
  assert.equal(doc.querySelector("#c")!.innerHTML, "original");
});

test("the cache is bounded", async () => {
  prefetch.clear();
  configure({ prefetchLimit: 3 });

  const links = Array.from({ length: 6 }, (_, i) => `<a id="l${i}" href="/p${i}">${i}</a>`).join("");
  const responses = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [`/p${i}/_fragment.html`, `page ${i}`]),
  );
  const { doc } = harness(`<nav dp-boost dp-prefetch dp-target="#c">${links}</nav><main id="c"></main>`, responses);
  process(doc);

  for (let i = 0; i < 6; i++) hover(doc.querySelector(`#l${i}`)!);
  await flush();

  assert.ok(prefetch.size() <= 3, `cache held ${prefetch.size()} entries`);
  configure({ prefetchLimit: 32 });
});
