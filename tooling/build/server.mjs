import { fileURLToPath } from "node:url";
import { build } from "vite-plus";
import { runtimeExternals } from "./externals.mjs";
import { rivetNative } from "./rivet.mjs";
import { buildDefines } from "./info.ts";
const sealed = process.argv[2] === "box-sealed";
await build({
  configFile: false,
  define: buildDefines,
  plugins: sealed ? [rivetNative] : [],
  // The sealed box takes satori's text shaper from its own embedded wasm (apps/box/src/shims/harfbuzz.ts).
  resolve: sealed
    ? {
        alias: [
          {
            find: /^harfbuzzjs$/,
            replacement: fileURLToPath(
              new URL("../../apps/box/src/shims/harfbuzz.ts", import.meta.url),
            ),
          },
        ],
      }
    : {},
  // Everything is bundled except the native and wasm packages, which load from node_modules (externals.mjs), and Electron itself.
  ssr: {
    noExternal: true,
    external: sealed
      ? [
          ...runtimeExternals.filter((name) => name !== "satori"),
          "electron",
          "@rivetkit/rivetkit-napi",
        ]
      : [...runtimeExternals, "electron"],
  },
  build: {
    ssr:
      { "till-host": "src/server.ts", "till-electron": "src/main.ts", "box-sealed": "src/main.ts" }[
        process.argv[2]
      ] ?? "src/index.ts",
    // An e2e run with SHOPPER_RUN_ID builds into its own folder (tooling/e2e/run.ts).
    outDir: process.env.SHOPPER_BUILD_OUT_DIR ?? "dist",
  },
});
