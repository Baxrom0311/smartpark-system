/**
 * Generate `src/routeTree.gen.ts` ahead of `tsc -b` so the build can
 * type-check the project before Vite runs. The TanStack Router Vite
 * plugin only writes this file during a Vite/dev/build cycle, but our
 * `npm run build` script runs `tsc -b` first — so we generate the
 * route tree explicitly here.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  generator,
  getConfig,
} from "@tanstack/router-generator";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

async function main() {
  const config = getConfig(
    {
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
      autoCodeSplitting: true,
    },
    root,
  );

  await generator(config, root);
  console.log("✓ routeTree.gen.ts generated");
}

main().catch((err) => {
  console.error("× failed to generate routeTree.gen.ts:", err);
  process.exit(1);
});
