import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildInfo } from "@shopper/config";
import { writeAtomic } from "./secrets";
import { changeServer, findServer } from "./trust";

/**
 * A fresh install has no register file: write the install half of one, and the host starts as an enrolment host
 * on the "Set up this till" screen. The packaged app serves its own UI, so only a dev build names another origin.
 */
export async function firstRun(configPath: string, userData: string, devOrigin?: string) {
  // An explicit upstream (development, tests) is used as given; otherwise a box on this LAN wins over the cloud.
  const named = process.env.SHOPPER_TILL_UPSTREAM;
  const server = await findServer(
    named ? undefined : "https://shopper.local",
    named ?? buildInfo.tillUpstream,
    userData,
  );
  if (!server.upstream)
    throw new Error("This build names no server to enrol with (SHOPPER_TILL_UPSTREAM)");
  const origins = devOrigin ? [devOrigin] : [];
  const text = JSON.stringify(
    { ...server, sqlitePath: join(userData, "register.sqlite"), origins, port: 0 },
    null,
    2,
  );
  await writeAtomic(configPath, text);
  return text;
}

/** A box address typed on the enrol screen: pinned, then the register file points at it. Throws why, for the cashier. */
export async function moveServer(configPath: string, userData: string, address: string) {
  const stored = JSON.parse(await readFile(configPath, "utf8")) as { identity?: unknown };
  if (stored.identity !== undefined) throw new Error("This till is already enrolled");
  const server = await changeServer(address, userData);
  await writeAtomic(configPath, JSON.stringify({ ...stored, ...server }, null, 2));
}
