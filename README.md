# dp-swap

Partial page updates for prerendered sites. An htmx rewrite reduced to the
features a static site actually needs, in TypeScript, with no dependencies.

**11.0 kB minified.**

## Why not htmx

htmx assumes a server that returns HTML per request. A static site has no
server, so every navigation is a full document load unless you ship a router.

dp-swap inverts that for navigation: because the site generator prerenders
every route, it can also emit that route's content on its own. A boosted
navigation becomes a static file read that any CDN can serve.

It does not assume that for everything. A declared `dp-get` fetches the URL it
names, so the same library drives a server-backed app as readily as a
prerendered one — which is the point, since these are two different projects.

```
dist/guides/build/index.html      full document, what a crawler and a
                                  no-JavaScript visitor get
dist/guides/build/_fragment.html  the content alone, what a swap fetches
```

Every page keeps working with JavaScript disabled. `dp-boost` enhances real
`<a href>` links; a fragment is never the only representation of a page, and a
failed request falls back to the navigation the browser would have done anyway.

## Usage

```html
<script src="/dpswap.min.js"></script>

<nav dp-boost dp-target="#content">
  <a href="/guides">Guides</a>
  <a href="/guides/build">Build</a>
</nav>
<main id="content">...</main>
```

Links inside the boosted container now swap `#content` and push history.
Back and forward replay the swap.

For a request that is not a navigation:

```html
<button dp-get="/page/2" dp-target="#list" dp-swap="beforeend">More</button>
```

## Attributes

| Attribute | Purpose |
|---|---|
| `dp-boost` | Turn descendant links into partial navigations. `dp-boost="false"` opts a link out. |
| `dp-get` | Request this URL's fragment. |
| `dp-target` | Where the response goes. CSS selector, `this`, `closest <sel>`, `find <sel>`, `next`, `previous`. |
| `dp-swap` | How it goes there, plus `scroll:top`, `scroll:bottom`, `swap:<time>`. |
| `dp-select` | Take only the matching subtree out of the response. |
| `dp-swap-oob` | On a response element: swap it somewhere else. `<style>` or `<style>:<selector>`. |
| `dp-trigger` | Which event fires the request, plus `once`, `changed`, `delay:<time>`, `throttle:<time>`, `from:<sel>`. Also `load` and `revealed`. |
| `dp-push-url` | Push a URL into history. |
| `dp-indicator` | Element to mark with `dp-request` while in flight. |
| `dp-prefetch` | Fetch a link's fragment on pointer intent, before the click. `dp-prefetch="false"` opts a link back out. |
| `dp-fragment` | Make a `dp-get` fetch the prerendered fragment of its URL rather than the URL itself. |

### Which URL gets fetched

A **boosted navigation** fetches the page's prerendered fragment: going to
`/guides` means wanting what is on that page, and on a prerendered site that
content already exists as a file.

A **declared `dp-get`** fetches exactly the URL it names. `dp-get="/api/search"`
requests `/api/search`, not a rendering of it. Add `dp-fragment` when a static
page wants another page's content without hard-coding the suffix.

`dp-target`, `dp-swap`, `dp-select`, `dp-push-url`, `dp-indicator`,
`dp-prefetch` and `dp-fragment` are inherited from the nearest ancestor that declares them, so one
declaration on a container covers every link inside it.

### Addressing a fragment by header instead of by URL

The default gives every route a second URL. A server that can route on a
request header does not need one:

```js
dpswap.configure({ fragmentMode: "header" });
```

A boosted navigation then requests the page's own URL with `DP-Partial` set,
and the server decides which representation to return. One URL per route, at
the cost of needing a server that understands the header — and a `Vary` on it,
or a cache will hand a fragment to a browser that asked for a document.

## Layouts

A prerendered site has nested layouts, and most navigations change only the
innermost one. Mark the boundaries and dp-swap will replace the smallest region
that actually changed:

```html
<main id="app" dp-layout="/">
  <div dp-layout="/docs">
    <aside>…sidebar…</aside>
    <div dp-layout="/docs/guides">…page…</div>
  </div>
</main>
```

Moving between two guides matches both markers, so only the innermost subtree
is replaced — the sidebar keeps its scroll position and its open disclosures.
Arriving from outside `/docs` matches neither, so the whole section is replaced.
The old DOM is what makes this possible: the client knows where it is without
being told.

`dp-layout` holds the URL prefix that layer owns. A swap replaces the
**children** of the deepest marker both pages share, so anything a layout
renders beside its children is replaced along with them — put the marker on the
element that wraps exactly the children and the surrounding chrome survives.
Set `layoutAttr: null` to turn matching off.

### Asking for less

In `fragmentMode: "header"` the client counts how many layers it already holds
and sends that count, so the server can skip them:

```
GET /docs/guides/build      DP-Partial: 3
```

Nothing has to be configured for this and no manifest is involved — the markers
in the live document name the prefixes the current page sits under, and a
prefix either covers the destination or it does not. A server that keeps one
prerendered tree per depth answers with just the innermost region; one that
does not can treat any value as "give me the fragment".

### Chrome that is not swapped but still changes

Keeping a tab strip in place is right until you notice it is still highlighting
the tab you left. A response may carry replacements for elements outside the
swapped region:

```html
<nav id="card-tabs" dp-swap-oob="outerHTML">…with the new highlight…</nav>
<div>…the actual swapped content…</div>
```

`dp-swap-oob` elements are lifted out of the response and applied by `id`
before the main swap.

### Prefetching

```html
<nav dp-boost dp-prefetch dp-target="#content"> ... </nav>
```

A pointer entering a link, or focus reaching it, starts fetching that page's
fragment. Intent usually runs a few hundred milliseconds ahead of the click,
which is long enough for a static file to arrive, so the click has nothing left
to wait for. The cache is bounded (`prefetchLimit`, 32 by default) and a failed
prefetch is forgotten so the real request reports the failure itself.

### Swap styles

`innerHTML` (default), `outerHTML`, `beforebegin`, `afterbegin`, `beforeend`,
`afterend`, `delete`, `none` — htmx's set, unchanged.

### Events

`dp:beforeRequest`, `dp:beforeSwap`, `dp:afterSwap`, `dp:afterSettle`,
`dp:afterRequest`, `dp:responseError`, `dp:sendError`, `dp:island`,
`dp:islandError`.

Request events fire on the element that triggered the request; swap events fire
on the element that received the content, so a listener can bind what just
arrived. Cancelling `dp:beforeRequest` or `dp:beforeSwap` stops there.

## Islands

A server-rendered placeholder names a module and says when it is worth loading:

```html
<div dp-island="/islands/search.js"
     dp-client="visible"
     dp-props='{"placeholder":"Search this page..."}'>
  <input disabled placeholder="Search...">
</div>
```

```js
export default function mount(element, props) { ... }
```

`dp-client` takes `load`, `idle`, `visible`, or `media:(min-width: 40rem)`.
There is no default beyond `load`, because every island spends network and main
thread on part of a page and should say why.

The module is loaded with a dynamic `import()`, so it is any ES module —
preact, effect, whatever the project reaches for. Islands inside content that
arrives through a partial navigation hydrate the same way as islands in the
first response.

If the module fails to load, the markup underneath it stays exactly as the
server rendered it. That is the whole point of rendering it first.

## What is deliberately missing

- **Mutating verbs.** `dp-post` and friends need a server. The names are
  reserved, and the URL rule above means adding them is additive.
- **The `HX-*` response header protocol.** Same reason: a static file has no
  say in how it is swapped.
- **Extensions, templates, SSE, websockets, morphing.** Out of scope.

## Configuration

```js
dpswap.configure({
  fragmentMode: "suffix",              // or "header"
  fragmentSuffix: "/_fragment.html",   // suffix mode only
  partialHeader: "DP-Partial",         // header mode only
  layoutAttr: "dp-layout",             // null turns layout matching off
  defaultBoostTarget: "body",
  requestClass: "dp-request",
  settlingClass: "dp-settling",
  timeout: 10000,
  prefetchLimit: 32,
  fetch: globalThis.fetch,             // swappable, which is how the tests run
});
```

The bundle starts itself on load. Opt out with
`<script src="/dpswap.min.js" data-dp-auto="false">` and call `dpswap.start()`
yourself.

## Seen working

[prerender](https://github.com/DHHwasRight/prerender) is a static site
generator built around this library, and its examples are the shortest way to
see the behaviour rather than read about it.

| File | What it shows |
|---|---|
| [`nested-cards/assets/boot.js`](https://github.com/DHHwasRight/prerender/blob/main/examples/nested-cards/assets/boot.js) | The whole client-side setup: header mode, and marking the swapped region so it can be seen |
| [`nested-cards/src/views/layouts.rsx`](https://github.com/DHHwasRight/prerender/blob/main/examples/nested-cards/src/views/layouts.rsx) | Four nested `dp-layout` markers, and where to put them so chrome survives |
| [`nested-cards/tests/partial.spec.ts`](https://github.com/DHHwasRight/prerender/blob/main/examples/nested-cards/tests/partial.spec.ts) | What each navigation replaces, asserted by marking live elements and checking which marks survived |

In this repository, [`test/layouts.test.ts`](test/layouts.test.ts) covers
narrowing and depth counting, [`test/navigation.test.ts`](test/navigation.test.ts)
covers boosting and history, and [`test/swap.test.ts`](test/swap.test.ts)
covers the swap styles and out-of-band handling.

## Development

```
npm install
npm run ci      # typecheck, test, build
```

Tests run on linkedom rather than a browser. The library never reaches for a
global DOM constructor — events, history and location all come from the
document being operated on — which is what makes that possible and what keeps
it usable from a server-side DOM.
