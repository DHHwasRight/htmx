import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { inherited, parseSwap, parseTime, parseTrigger, resolveTarget } from "../src/attrs.ts";

function fragment(html: string) {
  return parseHTML(`<html><body>${html}</body></html>`).document;
}

test("swap defaults to innerHTML", () => {
  assert.deepEqual(parseSwap(null), { style: "innerHTML", scroll: null, delay: 0 });
});

test("swap reads a style and its modifiers", () => {
  assert.deepEqual(parseSwap("outerHTML scroll:top swap:200ms"), {
    style: "outerHTML",
    scroll: "top",
    delay: 200,
  });
});

test("swap ignores an unknown style rather than guessing", () => {
  assert.equal(parseSwap("sideways").style, "innerHTML");
});

test("time accepts milliseconds, seconds and bare numbers", () => {
  assert.equal(parseTime("300ms"), 300);
  assert.equal(parseTime("1.5s"), 1500);
  assert.equal(parseTime("40"), 40);
  assert.equal(parseTime("soon"), 0);
});

test("trigger defaults to the event that suits the element", () => {
  const doc = fragment(`<a id="a"></a><form id="f"></form><input id="i">`);

  assert.equal(parseTrigger(null, doc.querySelector("#a")!).event, "click");
  assert.equal(parseTrigger(null, doc.querySelector("#f")!).event, "submit");
  assert.equal(parseTrigger(null, doc.querySelector("#i")!).event, "change");
});

test("trigger reads modifiers", () => {
  const doc = fragment(`<div id="d"></div>`);
  const spec = parseTrigger("keyup once changed delay:300ms throttle:1s from:#other", doc.querySelector("#d")!);

  assert.equal(spec.event, "keyup");
  assert.equal(spec.once, true);
  assert.equal(spec.changed, true);
  assert.equal(spec.delay, 300);
  assert.equal(spec.throttle, 1000);
  assert.equal(spec.from, "#other");
});

test("attributes are inherited from the nearest ancestor that declares them", () => {
  const doc = fragment(`<div dp-target="#out"><span><a id="a"></a></span></div>`);

  assert.equal(inherited(doc.querySelector("#a")!, "target"), "#out");
  assert.equal(inherited(doc.querySelector("#a")!, "swap"), null);
});

test("a closer declaration wins over an outer one", () => {
  const doc = fragment(`<div dp-target="#outer"><span dp-target="#inner"><a id="a"></a></span></div>`);

  assert.equal(inherited(doc.querySelector("#a")!, "target"), "#inner");
});

test("target resolves relative forms", () => {
  const doc = fragment(`<div id="wrap"><b id="prev"></b><a id="a"></a><i id="next"></i><em id="kid"></em></div>`);
  const a = doc.querySelector("#a")!;

  assert.equal(resolveTarget(a, null), a);
  assert.equal(resolveTarget(a, "this"), a);
  assert.equal(resolveTarget(a, "closest #wrap")?.id, "wrap");
  assert.equal(resolveTarget(a, "next")?.id, "next");
  assert.equal(resolveTarget(a, "previous")?.id, "prev");
  assert.equal(resolveTarget(a, "#kid")?.id, "kid");
});
