import assert from "node:assert/strict";
import { test } from "node:test";
import { config, configure, fragmentUrl } from "../src/config.ts";
import { process } from "../src/process.ts";
import { click, flush, harness } from "./helpers.ts";

test("a page url maps to its prerendered fragment", () => {
  assert.equal(fragmentUrl("/guides/build"), "/guides/build/_fragment.html");
  assert.equal(fragmentUrl("/guides/build/"), "/guides/build/_fragment.html");
  assert.equal(fragmentUrl("/"), "/_fragment.html");
  assert.equal(fragmentUrl("/search?q=x"), "/search/_fragment.html?q=x");
});

test("a boosted link swaps the fragment into the target", async () => {
  const { doc, requested } = harness(
    `<div dp-boost dp-target="#content"><a id="link" href="/guides">Guides</a></div>
     <main id="content"><p>home</p></main>`,
    { "/guides/_fragment.html": "<h1>Guides</h1>" },
  );
  process(doc);

  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, ["/guides/_fragment.html"]);
  assert.equal(doc.querySelector("#content")!.innerHTML, "<h1>Guides</h1>");
});

test("a boosted link leaves its href alone so it still works without javascript", () => {
  const { doc } = harness(`<div dp-boost><a id="link" href="/guides">Guides</a></div>`);
  process(doc);

  assert.equal(doc.querySelector("#link")!.getAttribute("href"), "/guides");
});

test("modified clicks, downloads and external links are left to the browser", async () => {
  const { doc, requested } = harness(
    `<div dp-boost dp-target="#c">
       <a id="hash" href="#section">hash</a>
       <a id="download" href="/file.pdf" download>file</a>
       <a id="external" href="https://elsewhere.test/page">out</a>
       <a id="blank" href="/other" target="_blank">new tab</a>
       <a id="optout" href="/other" dp-boost="false">no</a>
     </div>
     <main id="c"></main>`,
  );
  process(doc);

  for (const id of ["#hash", "#download", "#external", "#blank", "#optout"]) {
    click(doc.querySelector(id)!);
  }
  click(doc.querySelector("#hash")!, { metaKey: true });
  await flush();

  assert.deepEqual(requested, []);
});

test("a declared request targets and swaps what it was told to", async () => {
  const { doc } = harness(
    `<button id="more" dp-get="/page/2" dp-target="#list" dp-swap="beforeend">More</button>
     <ul id="list"><li>one</li></ul>`,
    { "/page/2": "<li>two</li>" },
  );
  process(doc);

  click(doc.querySelector("#more")!);
  await flush();

  assert.equal(doc.querySelector("#list")!.innerHTML, "<li>one</li><li>two</li>");
});

test("dp-select narrows a full page response to one region", async () => {
  const { doc } = harness(
    `<a id="link" dp-get="/about" dp-target="#c" dp-select="#main">About</a><div id="c"></div>`,
    { "/about": `<div><nav>skip</nav><div id="main">kept</div></div>` },
  );
  process(doc);

  click(doc.querySelector("#link")!);
  await flush();

  assert.equal(doc.querySelector("#c")!.innerHTML, `<div id="main">kept</div>`);
});

test("the indicator is marked for the duration of the request", async () => {
  const { doc } = harness(
    `<a id="link" dp-get="/x" dp-target="#c" dp-indicator="#spin">go</a>
     <span id="spin"></span><div id="c"></div>`,
    { "/x": "<p>done</p>" },
  );
  process(doc);

  const spinner = doc.querySelector("#spin")!;
  click(doc.querySelector("#link")!);
  assert.equal(spinner.classList.contains(config.requestClass), true);

  await flush();
  assert.equal(spinner.classList.contains(config.requestClass), false);
});

test("events fire in lifecycle order and beforeSwap can cancel", async () => {
  const { doc } = harness(
    `<a id="link" dp-get="/x" dp-target="#c">go</a><div id="c">original</div>`,
    { "/x": "<p>new</p>" },
  );
  process(doc);

  const seen: string[] = [];
  for (const name of ["dp:beforeRequest", "dp:beforeSwap", "dp:afterSwap", "dp:afterSettle"]) {
    doc.addEventListener(name, (event) => {
      seen.push(name);
      if (name === "dp:beforeSwap") event.preventDefault();
    });
  }

  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(seen, ["dp:beforeRequest", "dp:beforeSwap"]);
  assert.equal(doc.querySelector("#c")!.innerHTML, "original");
});

test("a missing fragment leaves the page untouched", async () => {
  const { doc } = harness(
    `<a id="link" dp-get="/gone" dp-target="#c">go</a><div id="c">original</div>`,
  );
  process(doc);

  let errored = false;
  doc.addEventListener("dp:responseError", () => (errored = true));

  click(doc.querySelector("#link")!);
  await flush();

  assert.equal(errored, true);
  assert.equal(doc.querySelector("#c")!.innerHTML, "original");
});

test("content swapped in is bound without rebinding the page", async () => {
  const { doc, requested } = harness(
    `<a id="first" dp-get="/one" dp-target="#c">one</a><div id="c"></div>`,
    {
      "/one": `<a id="second" dp-get="/two" dp-target="#c">two</a>`,
      "/two": `<p>done</p>`,
    },
  );
  process(doc);
  doc.addEventListener("dp:afterSwap", (event) => {
    const target = event.target as Element | null;
    if (target && "querySelectorAll" in target) process(target);
  });

  click(doc.querySelector("#first")!);
  await flush();
  click(doc.querySelector("#second")!);
  await flush();

  assert.deepEqual(requested, ["/one", "/two"]);
  assert.equal(doc.querySelector("#c")!.innerHTML, "<p>done</p>");
});

test("a trigger fires once when asked to", async () => {
  const { doc, requested } = harness(
    `<button id="b" dp-get="/x" dp-target="#c" dp-trigger="click once">go</button><div id="c"></div>`,
    { "/x": "<p>ok</p>" },
  );
  process(doc);

  const button = doc.querySelector("#b")!;
  click(button);
  await flush();
  click(button);
  await flush();

  assert.deepEqual(requested, ["/x"]);
});

test("a declared request fetches the url it names, not a fragment of it", async () => {
  const { doc, requested } = harness(
    `<a id="link" dp-get="/api/search?q=x" dp-target="#c">go</a><div id="c"></div>`,
    { "/api/search?q=x": "<p>ok</p>" },
  );
  process(doc);

  click(doc.querySelector("#link")!);
  await flush();

  // This is what lets the same library drive a server as well as a
  // prerendered site: dp-get means fetch this, not fetch a rendering of this.
  assert.deepEqual(requested, ["/api/search?q=x"]);
});

test("dp-fragment opts a declared request into the fragment mapping", async () => {
  const { doc, requested } = harness(
    `<a id="link" dp-get="/page/2" dp-fragment dp-target="#c">more</a><div id="c"></div>`,
    { "/page/2/_fragment.html": "<p>ok</p>" },
  );
  process(doc);

  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, ["/page/2/_fragment.html"]);
});

test("the fragment suffix is configurable", async () => {
  configure({ fragmentSuffix: ".part.html" });

  const { doc, requested } = harness(
    `<nav dp-boost dp-target="#c"><a id="link" href="/about">go</a></nav><div id="c"></div>`,
    { "/about.part.html": "<p>ok</p>" },
  );
  process(doc);

  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(requested, ["/about.part.html"]);
  configure({ fragmentSuffix: "/_fragment.html" });
});
