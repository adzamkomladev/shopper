import { readFile } from "node:fs/promises";
import { app } from "electron";
import { join } from "node:path";
import { buildInfo } from "@shopper/config";
import { writeAtomic } from "./secrets";
import { changeServer, findServer, onLan, pinBoxCa } from "./trust";

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

/**
 * The shop moved: the register file names its new server and holds the new token until the restart seals it. Moving
 * to the cloud drops the box's CA (the cloud chains to public CAs); moving onto a box keeps the CA pinned for it. The
 * device id, database and outbox stay as they are.
 */
export async function relocate(
  configPath: string,
  userData: string,
  registration: { upstream: string } | { pin: string },
) {
  if ("pin" in registration) return pinRelocation(configPath, userData, registration.pin);
  const { ca, ...stored } = JSON.parse(await readFile(configPath, "utf8")) as { ca?: unknown };
  const box = onLan(new URL(registration.upstream).hostname);
  await writeAtomic(
    configPath,
    JSON.stringify({ ...stored, ...(box && { ca }), ...registration, session: null }, null, 2),
  );
  // A new server: like a changed server, the register starts afresh on it.
  app.relaunch();
  app.exit(0);
}

/**
 * The shop is moving onto a box on this LAN: its CA is pinned first (trust on first use, as at enrolment; the signed
 * relocation names the box), and the register restarts trusting it; the next handshake hands the relocation again.
 */
async function pinRelocation(configPath: string, userData: string, upstream: string) {
  const ca = await pinBoxCa(upstream, userData);
  if (!ca) throw new Error(`${upstream} is not a box on this network`);
  const stored = JSON.parse(await readFile(configPath, "utf8")) as object;
  await writeAtomic(configPath, JSON.stringify({ ...stored, ca }, null, 2));
  app.relaunch();
  app.exit(0);
}
