import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { applyOutOfBand, parseFragment, selectFrom, swapInto } from "../src/swap.ts";
import type { SwapSpec, SwapStyle } from "../src/types.ts";

function doc(html: string) {
  return parseHTML(`<html><body>${html}</body></html>`).document as unknown as Document;
}

function spec(style: SwapStyle): SwapSpec {
  return { style, scroll: null, delay: 0 };
}

function swap(html: string, style: SwapStyle, incoming: string) {
  const d = doc(html);
  const target = d.querySelector("#t")!;
  swapInto(target, parseFragment(d, incoming), spec(style));
  return d.body.innerHTML;
}

test("innerHTML replaces the children", () => {
  assert.equal(swap(`<div id="t"><b>old</b></div>`, "innerHTML", "<i>new</i>"), `<div id="t"><i>new</i></div>`);
});

test("outerHTML replaces the element", () => {
  assert.equal(swap(`<div id="t"><b>old</b></div>`, "outerHTML", "<i>new</i>"), `<i>new</i>`);
});

test("beforebegin and afterend place content around the element", () => {
  assert.equal(swap(`<div id="t"></div>`, "beforebegin", "<i>a</i>"), `<i>a</i><div id="t"></div>`);
  assert.equal(swap(`<div id="t"></div>`, "afterend", "<i>a</i>"), `<div id="t"></div><i>a</i>`);
});

test("afterbegin and beforeend place content inside the element", () => {
  assert.equal(swap(`<div id="t"><b>x</b></div>`, "afterbegin", "<i>a</i>"), `<div id="t"><i>a</i><b>x</b></div>`);
  assert.equal(swap(`<div id="t"><b>x</b></div>`, "beforeend", "<i>a</i>"), `<div id="t"><b>x</b><i>a</i></div>`);
});

test("delete removes the element and none leaves it alone", () => {
  assert.equal(swap(`<div id="t">x</div>`, "delete", "<i>a</i>"), "");
  assert.equal(swap(`<div id="t">x</div>`, "none", "<i>a</i>"), `<div id="t">x</div>`);
});

test("select narrows the response to the matching subtree", () => {
  const d = doc("");
  const fragment = parseFragment(d, `<div><main id="m"><p>keep</p></main><footer>drop</footer></div>`);
  const selected = selectFrom(d, fragment, "#m");

  const holder = d.createElement("div");
  holder.appendChild(selected);
  assert.equal(holder.innerHTML, `<main id="m"><p>keep</p></main>`);
});

test("a select that matches nothing swaps nothing in", () => {
  const d = doc("");
  const selected = selectFrom(d, parseFragment(d, "<p>content</p>"), "#missing");

  assert.equal(selected.childNodes.length, 0);
});

test("out of band content is swapped by its own id", () => {
  const d = doc(`<nav id="side">old</nav><div id="t">old</div>`);
  const fragment = parseFragment(d, `<nav id="side" dp-swap-oob="innerHTML">new</nav><p>body</p>`);

  applyOutOfBand(d, fragment);
  swapInto(d.querySelector("#t")!, fragment, spec("innerHTML"));

  assert.equal(d.querySelector("#side")!.innerHTML, "new");
  assert.equal(d.querySelector("#t")!.innerHTML, "<p>body</p>");
});

test("out of band content can name its destination", () => {
  const d = doc(`<span class="count">1</span><div id="t"></div>`);
  const fragment = parseFragment(d, `<b dp-swap-oob="innerHTML:.count">2</b>`);

  applyOutOfBand(d, fragment);

  assert.equal(d.querySelector(".count")!.innerHTML, "2");
  assert.equal(fragment.childNodes.length, 0);
});

test("out of band content with no destination is dropped rather than injected", () => {
  const d = doc(`<div id="t"></div>`);
  const fragment = parseFragment(d, `<b dp-swap-oob="innerHTML">orphan</b><p>body</p>`);

  applyOutOfBand(d, fragment);
  swapInto(d.querySelector("#t")!, fragment, spec("innerHTML"));

  assert.equal(d.querySelector("#t")!.innerHTML, "<p>body</p>");
});
