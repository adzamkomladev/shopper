import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildUpdate } from "../../../tooling/installer/update";

/** An install tree as the installer leaves it: slot `a` running, `current` pointing at it, an updates folder. */
export async function boxTree() {
  const root = await mkdtemp(join(tmpdir(), "box-tree-"));
  await mkdir(join(root, "slots", "a"), { recursive: true });
  await writeFile(join(root, "slots", "a", "shopper-box"), "box 1.0.0");
  execFileSync("ln", ["-s", join(root, "slots", "a"), join(root, "current")]);
  const updates = join(root, "updates");
  await mkdir(updates);
  return { root, updates };
}

/** A signed bundle of a fake slot in `updates`: `files` are its contents. */
export async function bundle(
  updates: string,
  name: string,
  releaseKey: string,
  options: {
    version?: string;
    builtAt?: string;
    kind?: "update" | "taxpack";
    files?: Record<string, string>;
  } = {},
) {
  const source = await mkdtemp(join(tmpdir(), "bundle-src-"));
  for (const [file, text] of Object.entries(
    options.files ?? { "shopper-box": "box 1.1.0", "engine/rivet-engine": "engine" },
  )) {
    await mkdir(join(source, file, ".."), { recursive: true });
    await writeFile(join(source, file), text);
  }
  await buildUpdate({
    slot: source,
    out: join(updates, name),
    releaseKey,
    kind: options.kind,
    builtAt: options.builtAt ?? "2026-11-10T08:00:00.000Z",
    version: options.version ?? "1.1.0",
    schemaVersion: 42,
  });
  return source;
}
