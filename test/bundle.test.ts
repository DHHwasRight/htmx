import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { start } from "../src/index.ts";
import { click, flush, harness } from "./helpers.ts";

/** Bundles a page script the way a site would, and returns the output. */
async function bundle(page: string): Promise<string> {
  const result = await build({
    stdin: { contents: page, resolveDir: import.meta.dirname + "/..", loader: "ts" },
    bundle: true,
    format: "esm",
    minify: true,
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0]!.text;
}

test("a page that does not import islands does not ship them", async () => {
  const code = await bundle(`import { start } from "./src/index.ts"; start();`);
  assert.doesNotMatch(code, /dp-island/);
});

test("a page that imports islands ships them", async () => {
  const code = await bundle(
    `import { start } from "./src/index.ts"; import { hydrate } from "./src/islands.ts"; start(document, [hydrate]);`,
  );
  assert.match(code, /dp-island/);
});

test("the core bundle has no islands and the full one does", async () => {
  const core = await bundle(`import "./src/bundle-core.ts";`);
  const full = await bundle(`import "./src/bundle-full.ts";`);
  assert.doesNotMatch(core, /dp-island/);
  assert.match(full, /dp-island/);
});

test("an extension runs on the document and on each swapped subtree", async () => {
  const { doc } = harness(
    `<nav dp-boost dp-target="#c"><a id="link" href="/guides">Guides</a></nav><main id="c"></main>`,
    { "/guides/_fragment.html": "<p>guides</p>" },
  );
  const seen: string[] = [];
  start(doc, [(root) => void seen.push((root as Element).id ?? "document")]);

  click(doc.querySelector("#link")!);
  await flush();

  assert.deepEqual(seen, ["document", "c"]);
});
