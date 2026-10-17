import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";

test("the box renderer renders the golden receipt to a 576-dot PNG under Bun with wasm resvg", async () => {
  const { stdout } = await promisify(execFile)(
    "bun",
    ["--preload", "./tooling/build/bun.ts", "tests/support/hardware/render.ts"],
    {
      timeout: 60_000,
    },
  );
  const out = JSON.parse(stdout.trim().split("\n").at(-1)!);
  expect(out.signature).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(out.width).toBe(576);
  expect(out.length).toBeGreaterThan(1000);
}, 90_000);
