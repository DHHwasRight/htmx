import assert from "node:assert/strict";
import { test } from "node:test";
import { hydrate, parseDirective, readProps } from "../src/islands.ts";
import { flush, harness } from "./helpers.ts";

test("a directive says when an island is worth its cost", () => {
  assert.deepEqual(parseDirective("load"), { kind: "load" });
  assert.deepEqual(parseDirective("idle"), { kind: "idle" });
  assert.deepEqual(parseDirective("visible"), { kind: "visible" });
  assert.deepEqual(parseDirective("media:(min-width: 40rem)"), {
    kind: "media",
    query: "(min-width: 40rem)",
  });
});

test("an absent or unknown directive hydrates on load", () => {
  assert.deepEqual(parseDirective(null), { kind: "load" });
  assert.deepEqual(parseDirective("whenever"), { kind: "load" });
});

test("props are read from the placeholder the server rendered", () => {
  const { doc } = harness(`<div id="i" dp-props='{"start":3,"label":"Go"}'></div>`);

  assert.deepEqual(readProps(doc.querySelector("#i")!), { start: 3, label: "Go" });
});

test("props that are absent or malformed read as empty rather than throwing", () => {
  const { doc } = harness(`<div id="a"></div><div id="b" dp-props="{not json"></div><div id="c" dp-props="7"></div>`);

  assert.deepEqual(readProps(doc.querySelector("#a")!), {});
  assert.deepEqual(readProps(doc.querySelector("#b")!), {});
  assert.deepEqual(readProps(doc.querySelector("#c")!), {});
});

test("a module that cannot be loaded leaves the server-rendered markup alone", async () => {
  const { doc } = harness(
    `<div id="i" dp-island="/islands/missing.js" dp-client="load"><p>server rendered</p></div>`,
  );

  let failed = false;
  doc.addEventListener("dp:islandError", () => (failed = true));

  hydrate(doc);
  await flush();

  assert.equal(failed, true);
  // The whole promise of an island: what it replaces is already there.
  assert.equal(doc.querySelector("#i")!.innerHTML, "<p>server rendered</p>");
});

test("an element is hydrated once however often it is processed", async () => {
  const { doc } = harness(`<div id="i" dp-island="/islands/missing.js" dp-client="load"></div>`);

  let attempts = 0;
  doc.addEventListener("dp:islandError", () => attempts++);

  hydrate(doc);
  hydrate(doc);
  await flush();

  assert.equal(attempts, 1);
});

test("an element without dp-island is not an island", async () => {
  const { doc } = harness(`<div id="i" dp-client="load"></div>`);

  let touched = false;
  doc.addEventListener("dp:islandError", () => (touched = true));
  doc.addEventListener("dp:island", () => (touched = true));

  hydrate(doc);
  await flush();

  assert.equal(touched, false);
});

test("hydration falls back to loading when the environment cannot defer", async () => {
  // linkedom has no IntersectionObserver, so `visible` has to resolve to
  // hydrating rather than to never hydrating.
  const { doc } = harness(`<div id="i" dp-island="/islands/missing.js" dp-client="visible"></div>`);

  let attempted = false;
  doc.addEventListener("dp:islandError", () => (attempted = true));

  hydrate(doc);
  await flush();

  assert.equal(attempted, true);
});
