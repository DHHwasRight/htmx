// dist/dpswap.full.min.js: everything, islands included.
import { autoStart } from "./auto.ts";
import { hydrate } from "./islands.ts";

export * from "./index.ts";
export { hydrate };

autoStart([hydrate]);
