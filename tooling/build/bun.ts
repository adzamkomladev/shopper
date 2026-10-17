import { buildDefines } from "./info";

// Bun has no bundler define pass: expose the build constants as globals for `bun --preload ./tooling/build/bun.ts <file>` runs (tests).
for (const [name, value] of Object.entries(buildDefines)) {
  Object.assign(globalThis, { [name]: JSON.parse(value) });
}
