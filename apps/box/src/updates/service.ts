import { mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import { BoxUpdateError, type BoxUpdates } from "@shopper/api";
import {
  boxUpdateId,
  boxUpdateParams,
  changedFiles,
  recordUpdate,
  runBoxUpdate,
  scheduleUpdate,
  updateCheckpoint,
  updateFile,
  type BoxUpdateDeps,
} from "@shopper/core/release";
import type { Launch } from "@shopper/adapters-box";
import { readBundle } from "./bundle";

const run = promisify(execFile);

/**
 * The box's update bundles: those in `SHOPPER_UPDATES_DIR` (put there by USB or scp, never uploaded through the
 * browser), verified against Shopper's release key and the licence's maintenance date, then staged into the spare A/B
 * slot after a verified backup. A root helper (deploy/bin/shopper-apply) flips `current` and restarts the box.
 */
export function boxUpdates(options: {
  env: Record<string, string | undefined>;
  releaseKey: string;
  installed: { version: string; schemaVersion: number };
  maintenanceUntil: () => Promise<string | undefined>;
  /** A verified backup (Day 37); rejects when backups are not set up, which refuses the update. */
  backup: () => Promise<void>;
  withDatabase: BoxUpdateDeps["withDatabase"];
  launch: Launch;
}): BoxUpdates {
  const updates = options.env.SHOPPER_UPDATES_DIR ?? ".shopper/updates";
  const root = options.env.SHOPPER_SLOTS_DIR ?? "/opt/shopper";
  const state = (name: string) => join(updates, name);
  const readState = async (name: string): Promise<Record<string, string> | undefined> =>
    readFile(state(name), "utf8").then(
      (text) => JSON.parse(text) as Record<string, string>,
      () => undefined,
    );

  const slot = async () =>
    basename(await realpath(join(root, "current")).catch(() => join(root, "slots", "a"))) === "b"
      ? "b"
      : "a";

  async function prepare(file: string) {
    const name = v.safeParse(updateFile, file);
    if (!name.success) throw new BoxUpdateError(400, "That is not an update bundle's file name.");
    const bundle = await readBundle(join(updates, name.output), {
      releaseKey: options.releaseKey,
      installed: options.installed,
      maintenanceUntil: await options.maintenanceUntil(),
    }).catch(() => undefined);
    if (!bundle) throw new BoxUpdateError(404, "That bundle is not in the updates folder.");
    if (!bundle.ok) throw new BoxUpdateError(422, bundle.message);
    if (!bundle.verdict.ok) throw new BoxUpdateError(422, bundle.verdict.message);
    if (bundle.manifest.kind !== "update")
      throw new BoxUpdateError(
        422,
        "A tax rule pack is applied by the tax module, not installed as an update.",
      );
    return { path: join(updates, name.output), manifest: bundle.manifest };
  }

  // Backup first, then unpack into the spare slot and check every file against the signed manifest; only then ask the
  // root helper to switch. Any refusal leaves the running slot, and the spare, as they were.
  async function stage(file: string) {
    if (await readState("apply.json"))
      throw new BoxUpdateError(409, "An update is already being installed.");
    const { path, manifest } = await prepare(file);
    await options.backup().catch((error: unknown) => {
      throw new BoxUpdateError(
        409,
        `The update needs a verified backup first, and it failed: ${error instanceof Error ? error.message : error}`,
      );
    });
    const spare = (await slot()) === "a" ? "b" : "a";
    const dir = join(root, "slots", spare);
    await emptySlot(dir);
    await run("tar", ["-xzf", path, "-C", dir]);
    const changed = await changedFiles(manifest, (name) =>
      readFile(join(dir, name)).catch(() => undefined),
    );
    if (changed.length) {
      await emptySlot(dir);
      throw new BoxUpdateError(422, `${changed.join(", ")} is not what Shopper signed.`);
    }
    await mkdir(updates, { recursive: true });
    await rm(state("result.json"), { force: true });
    await writeFile(
      state("apply.json"),
      JSON.stringify({ slot: spare, version: manifest.version, file }),
    );
    return manifest.version;
  }

  const deps: BoxUpdateDeps = {
    withDatabase: options.withDatabase,
    appVersion: options.installed.version,
    async apply(file, instanceId) {
      // Cancelled or replaced since it was scheduled: another schedule owns the folder's state now.
      if ((await readState("scheduled.json"))?.instanceId !== instanceId) return undefined;
      const version = await stage(file);
      await rm(state("scheduled.json"), { force: true });
      return { version };
    },
  };
  const launcher = options.launch("box-update", boxUpdateParams, (flow, params) =>
    runBoxUpdate(flow, deps, params),
  );

  return {
    async overview() {
      const names = await readdir(updates).catch(() => []);
      const context = {
        releaseKey: options.releaseKey,
        installed: options.installed,
        maintenanceUntil: await options.maintenanceUntil(),
      };
      const found = await Promise.all(
        names
          .filter((name) => v.is(updateFile, name))
          .map(async (file) => ({
            file,
            bundle: await readBundle(join(updates, file), context).catch(() => undefined),
          })),
      );
      const scheduled = await readState("scheduled.json");
      const last = await readState("result.json");
      return {
        running: { version: options.installed.version, slot: await slot() },
        bundles: found
          .flatMap(({ file, bundle }) =>
            bundle?.ok
              ? [
                  {
                    file,
                    kind: bundle.manifest.kind,
                    version: bundle.manifest.version,
                    builtAt: bundle.manifest.builtAt,
                    verdict: bundle.verdict,
                  },
                ]
              : [],
          )
          .sort((a, b) => b.builtAt.localeCompare(a.builtAt)),
        ...(last ? { last: last as never } : {}),
        ...(scheduled && Date.parse(scheduled.at!) > Date.now()
          ? { scheduled: { file: scheduled.file!, at: scheduled.at! } }
          : {}),
      };
    },
    async install(file, who) {
      const version = await stage(file);
      await options.withDatabase((db) =>
        recordUpdate(
          db,
          { ...who, appVersion: options.installed.version },
          { file, status: "started", version },
        ),
      );
    },
    async schedule(file, at, who) {
      await prepare(file);
      if (Date.parse(at) <= Date.now())
        throw new BoxUpdateError(422, "Pick a time that has not passed.");
      const instanceId = boxUpdateId(who.orgId, at);
      await mkdir(updates, { recursive: true });
      await writeFile(state("scheduled.json"), JSON.stringify({ instanceId, file, at }));
      await options
        .withDatabase((db) =>
          scheduleUpdate(
            db,
            { orgId: who.orgId, actorId: who.actorId, appVersion: options.installed.version },
            { instanceId, file, at, launch: (id, params) => launcher.start(id, params) },
            updateCheckpoint(instanceId, "schedule", "waiting"),
          ),
        )
        .catch(async (error: unknown) => {
          await rm(state("scheduled.json"), { force: true });
          throw error;
        });
    },
    cancel: () => rm(state("scheduled.json"), { force: true }),
  };
}

// The slot's folder belongs to the box's user but its parent does not, so it is emptied, never removed.
async function emptySlot(dir: string) {
  await mkdir(dir, { recursive: true });
  for (const name of await readdir(dir))
    await rm(join(dir, name), { recursive: true, force: true });
}
