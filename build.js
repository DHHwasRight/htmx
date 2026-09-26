import { build } from "esbuild";

const shared = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
};

await build({ ...shared, format: "esm", outfile: "dist/dpswap.js" });
await build({
  ...shared,
  format: "iife",
  globalName: "dpswap",
  minify: true,
  outfile: "dist/dpswap.min.js",
});
