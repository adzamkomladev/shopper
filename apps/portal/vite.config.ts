import { defineConfig, type Plugin } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { bindings } from "cf/config";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask, productionBuild } from "../../tooling/build/info";

export default defineConfig(({ command, isPreview }) => ({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
    productionBuild(),
    ...(process.env.SHOPPER_PORTAL_TEST_HOST
      ? []
      : [
          // Prerendering previews the built Worker, which must not open the remote IMPORTS bucket.
          cloudflare({
            viteEnvironment: { name: "ssr" },
            remoteBindings: command === "serve" && !isPreview,
            // Start reads this flag while prerendering the SPA shell; it never reaches a deploy.
            prerenderWorker: {
              // Assets belong to the default Worker only, and prerendering needs no credentials.
              config: ({ entryWorkerConfig: { assets: _assets, env, ...entry } }) => {
                const kept = Object.entries(env ?? {}).filter(
                  ([name, binding]) => name !== "ASSETS" && binding.type !== "secret",
                );
                return {
                  ...entry,
                  name: `${entry.name}-prerender`,
                  env: { ...Object.fromEntries(kept), TSS_PRERENDERING: bindings.text("true") },
                };
              },
            },
          }),
          prerenderManifest(),
        ]),
    tanstackStart({
      spa: { enabled: true, prerender: { outputPath: "/index" } },
      server: { entry: "server.ts" },
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  define: buildDefines,
  server: { port: 5173 },
}));

/**
 * Start writes the client asset manifest into the `ssr` environment only, so the prerender Worker
 * would render a shell that loads Vite's dev client entry. The `ssr` build runs before the
 * prerender Worker's; hand its manifest over and fail the build if that order ever changes.
 */
function prerenderManifest(): Plugin {
  const manifestId = "\0tanstack-start-manifest:v";
  let manifest: string | undefined;
  return {
    name: "shopper:prerender-manifest",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (id === manifestId && this.environment.name === "ssr") manifest = code;
    },
    load(id) {
      if (id !== manifestId || ["ssr", "client"].includes(this.environment.name)) return;
      if (!manifest) throw new Error("The ssr build must finish before the prerender Worker's");
      return manifest;
    },
  };
}
