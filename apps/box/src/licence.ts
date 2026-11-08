import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  generateKey,
  licenceStatus,
  publicKeyOf,
  signedRequest,
  toBase64Url,
  type Licence,
} from "@shopper/core/licence";
import type { BoxLicence } from "@shopper/api";
import { sha256 } from "@shopper/utils";

/**
 * The box's licence on disk (`SHOPPER_LICENCE_DIR`): `licence.json` from Shopper, `confirmation.json` from the last
 * check-in, and `box.key`, the box's own Ed25519 key, made on first use. Undefined when the build names no issuer
 * (development and tests that do not pass one): nothing is enforced.
 */
export function boxLicence(
  environment: Record<string, string | undefined>,
  options: { issuer: string; fetch?: (request: Request) => Promise<Response> },
): BoxLicence | undefined {
  if (!options.issuer) return undefined;
  const dir = environment.SHOPPER_LICENCE_DIR ?? ".shopper/licence";
  const file = (name: string) => join(dir, name);
  const send = options.fetch ?? ((request: Request) => fetch(request));
  let key: Promise<string> | undefined;

  async function status() {
    const [licence, confirmation, machine, boxKey] = await Promise.all([
      readJson(file("licence.json")),
      readJson(file("confirmation.json")),
      machineId(environment.SHOPPER_MACHINE_ID_FILE ?? "/etc/machine-id"),
      (key ??= ownKey(file("box.key"))),
    ]);
    const request = toBase64Url(
      new TextEncoder().encode(JSON.stringify({ machine, key: publicKeyOf(boxKey) })),
    );
    const now = new Date();
    return {
      ...(await licenceStatus({ issuer: options.issuer, machine, licence, confirmation, now })),
      request,
    };
  }

  return {
    status,
    async checkIn() {
      const current = await status();
      const server = environment.SHOPPER_LICENCE_URL;
      if (!current.licence || current.reason === "machine" || !server) return current;
      const request = await signedRequest(
        { key: await key!, licence: current.licence as Licence },
        new URL("/licence/confirmations", server).toString(),
        { method: "POST", body: "{}" },
      );
      const response = await send(request).catch(() => undefined);
      if (!response?.ok) return { ...current, error: "The licence server could not be reached." };
      // Only the issuer can sign a confirmation, so whatever arrives is checked by the next status.
      await writeFile(file("confirmation.json"), await response.text());
      return status();
    },
  };
}

/**
 * The first-boot wizard's licence step: `value` must be genuine for this machine (a stale one is fine, the next check-in
 * confirms it). Writes `licence.json` and returns undefined, or the reason it was refused.
 */
export async function acceptLicence(
  environment: Record<string, string | undefined>,
  issuer: string,
  value: unknown,
) {
  const dir = environment.SHOPPER_LICENCE_DIR ?? ".shopper/licence";
  const status = await licenceStatus({
    issuer,
    machine: await machineId(environment.SHOPPER_MACHINE_ID_FILE ?? "/etc/machine-id"),
    licence: value,
    now: new Date(),
  });
  if (status.state === "locked" && status.reason !== "expired") return status.reason;
  // A licence issued for an earlier key of this machine would pass every check but could never check in.
  if (status.licence?.key !== publicKeyOf(await ownKey(join(dir, "box.key"))))
    return "key" as const;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "licence.json"), JSON.stringify(value, null, 2));
  return undefined;
}

async function ownKey(path: string) {
  const existing = await readFile(path, "utf8").catch(() => undefined);
  if (existing) return existing;
  await mkdir(join(path, ".."), { recursive: true });
  const { privateKey } = await generateKey();
  await writeFile(path, privateKey, { flag: "wx", mode: 0o600 }).catch(() => undefined);
  await chmod(path, 0o600);
  // Another request may have won the race to create it: the file on disk is the key.
  return readFile(path, "utf8");
}

const machineId = async (path: string) => sha256((await readFile(path, "utf8")).trim());

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
