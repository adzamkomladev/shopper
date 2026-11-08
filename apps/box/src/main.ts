import { websocket } from "hono/bun";
import { buildInfo } from "@shopper/config";
import { runBackup } from "./cli/backup";
import { runDoctor } from "./cli/doctor";
import { migrateBox } from "./boot";
import { embeddedPack } from "./pack";
import { verifyRelease } from "./release";
import { boxServer } from "./serve";

declare const Bun: { serve(options: unknown): unknown };

// The sealed binary's entry. It must not use top-level await, which bytecode compilation cannot hold.
main().catch((error: unknown) => {
  console.error({
    event: "box.start_failed",
    message: error instanceof Error ? error.message : error,
  });
  process.exit(1);
});

async function main() {
  if (process.argv[2] === "backup") return runBackup(process.env);
  if (process.argv[2] === "doctor") return runDoctor(process.env).then(() => process.exit(0));
  await verifyRelease(process.env, buildInfo.releaseKey);
  const pack = await embeddedPack();
  if (pack && process.env.DATABASE_URL) await migrateBox(process.env.DATABASE_URL, pack);
  Bun.serve(boxServer(websocket, pack).config);
}
