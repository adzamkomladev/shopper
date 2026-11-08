import { websocket } from "hono/bun";
import { buildInfo } from "@shopper/config";
import { runBackup } from "./cli/backup";
import { runDoctor } from "./cli/doctor";
import { migrateBox } from "./boot";
import { embeddedPack } from "./pack";
import { verifyRelease } from "./release";
import { boxServer } from "./serve";
import { rollbackDatabase } from "./rollback";
import { preUpdateDump } from "./updates/box";
import { writeFileSync } from "node:fs";

declare const Bun: { serve(options: unknown): unknown };

// The sealed binary's entry. It must not use top-level await, which bytecode compilation cannot hold.
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error({ event: "box.start_failed", message });
  // The update helper reports why a new slot did not start; best effort, as the folder may not exist.
  try {
    writeFileSync(
      `${process.env.SHOPPER_UPDATES_DIR ?? ".shopper/updates"}/boot-error.txt`,
      message,
    );
  } catch {}
  process.exit(1);
});

async function main() {
  if (process.argv[2] === "backup") return runBackup(process.env);
  // Run by shopper-apply, as the box's user, after it switched a failed update back.
  if (process.argv[2] === "rollback")
    return console.log(
      await rollbackDatabase(process.env.DATABASE_URL!, preUpdateDump(process.env)),
    );
  if (process.argv[2] === "doctor") return runDoctor(process.env).then(() => process.exit(0));
  await verifyRelease(process.env, buildInfo.releaseKey);
  const pack = await embeddedPack();
  if (pack && process.env.DATABASE_URL) await migrateBox(process.env.DATABASE_URL, pack);
  Bun.serve(boxServer(websocket, pack).config);
}
