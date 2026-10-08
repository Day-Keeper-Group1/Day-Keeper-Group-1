// KAN-98: bundle the background reader into a Netlify function.
//
// src/server/background/worker.ts is app code, and app code is guarded by
// `server-only`, a package that throws unless it is loaded under the
// react-server condition, as Next.js loads it. Netlify's own bundler does not
// set that condition, so a function it bundles from app code dies on load
// (measured on 2026-10-09). So this script bundles the worker first, the way
// Next.js would, and Netlify only has to pick the result up:
//
//   - `conditions: ["react-server"]` resolves packages the way Next.js does
//     for server code;
//   - `server-only` itself becomes an empty module, which is what it is under
//     that condition;
//   - every other package stays external, so Netlify packs it from
//     node_modules as it does for any function.
//
// Runs before `next build` (netlify.toml). The output is generated, so it is
// gitignored. Silent on success.

import { build } from "esbuild";

await build({
  entryPoints: ["src/server/background/worker.ts"],
  outfile: "netlify/functions/read-letter.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  conditions: ["react-server"],
  packages: "external",
  logLevel: "warning",
  plugins: [
    {
      name: "server-only-is-satisfied",
      setup(bundler) {
        bundler.onResolve({ filter: /^server-only$/ }, () => ({
          path: "server-only",
          namespace: "empty",
        }));
        bundler.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
