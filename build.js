import { build } from "esbuild";

const shared = {
  bundle: true,
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
};

// The ES modules: no side effects, so a bundler keeps only what a page
// imports. Islands are a separate entry; the shared code goes in a chunk.
await build({
  ...shared,
  entryPoints: { dpswap: "src/index.ts", islands: "src/islands.ts" },
  format: "esm",
  splitting: true,
  outdir: "dist",
  chunkNames: "chunks/[name]-[hash]",
});

// The prebuilt bundles start themselves when the script tag loads.
const bundles = {
  "dist/dpswap.min.js": "src/bundle-core.ts",
  "dist/dpswap.full.min.js": "src/bundle-full.ts",
};
for (const [outfile, entry] of Object.entries(bundles)) {
  await build({ ...shared, entryPoints: [entry], format: "iife", globalName: "dpswap", minify: true, outfile });
}
