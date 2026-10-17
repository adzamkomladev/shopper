import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { bindings } from "cf/config";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { buildDefines, buildTask } from "../../tooling/build/info";

export default defineConfig(({ command, isPreview }) => ({
  run: { tasks: { build: buildTask("vp build") } },
  plugins: [
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
