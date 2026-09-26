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
  fragmentSuffix: "/_fragment.html",
  defaultBoostTarget: "body",
  timeout: 10000,
});
```

## Development

```
npm install
npm run ci      # typecheck, test, build
```

Tests run on linkedom rather than a browser. The library never reaches for a
global DOM constructor — events, history and location all come from the
document being operated on — which is what makes that possible and what keeps
it usable from a server-side DOM.
