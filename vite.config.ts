import { defineConfig } from "vite-plus";
import { buildDefines } from "./tooling/build/info";

// CPU-hungry files (their own vitest pool or CLI spawns) and files that assert a time budget or an
// upload interleaving: two at a time, so they never starve each other into timeouts.
const heavy = [
  "tests/integration/tooling/seed.test.ts",
  "tests/integration/edge/worker.test.ts",
  "tests/integration/catalogue/import/large.test.ts",
  "tests/integration/sales/customers/order.test.ts",
  "tests/integration/till/refunds/cross.test.ts",
  "tests/integration/reports/rollup.test.ts",
  "tests/integration/reports/speed.test.ts",
  // Chaos: 2,000 offline sales through a spawned register, and ten SIGKILL rounds.
  "tests/integration/sync/chaos/offline.test.ts",
  "tests/integration/sync/chaos/kill.test.ts",
];
// Release builds: packaging rebuilds the till host and Electron into the dist/ other files run from.
const solo = [
  "tests/integration/till/electron/package.test.ts",
  "tests/integration/tooling/cloudflare/*.test.ts",
];
export default defineConfig({
  define: buildDefines,
  fmt: {
    ignorePatterns: [
      "**/dist/**",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
      // Installed by `playwright-cli install --skills=agents`; must stay byte-identical to the tool.
      ".agents/skills/playwright-cli/**",
    ],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      "**/dist/**",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
      "tooling/worker/tests/**",
    ],
  },
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    // Every file owns its database and temp dirs, so files run in parallel. Apps that suites spawn
    // are bundled once up front: a per-file build would empty a dist/ another file is running.
    globalSetup: ["tests/support/prebuild.ts"],
    // Groups run in order; files inside a group run side by side. The sync volume suites wait on
    // round trips rather than CPU, so they share the first group and, slowest first, start at once.
    projects: [
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", ...heavy, ...solo],
          maxWorkers: 4,
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: { name: "heavy", include: heavy, maxWorkers: 2, sequence: { groupOrder: 1 } },
      },
      {
        extends: true,
        test: { name: "solo", include: solo, maxWorkers: 1, sequence: { groupOrder: 2 } },
      },
    ],
  },
  run: {
    tasks: {
      build: { command: "vp run -r --cache build", cache: { env: ["GITHUB_SHA", "BUILD_DATE"] } },
      check: { command: "vp check", cache: true },
      test: { command: "vp test", cache: false },
    },
  },
});
