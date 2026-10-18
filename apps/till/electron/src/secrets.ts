import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import * as v from "valibot";
import { registerSecrets, type RegisterSecrets } from "./schemas/secrets";

/** Writes, syncs and renames over the target, so a crash never leaves a half-written file. */
async function writeAtomic(path: string, content: string | Buffer) {
  const temporary = `${path}.${process.pid}.tmp`;
  const file = await open(temporary, "w", 0o600);
  try {
    await file.writeFile(content);
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}

/**
 * The register's secrets live only in `userData/register.secret`, sealed by the OS (DPAPI on Windows).
 * The first start seals a fresh database key plus the device token found in `register.json`; a token
 * still in `register.json` later (re-enrolment, or a crash before the scrub) replaces the sealed one.
 */
export async function loadSecrets(
  userData: string,
  config: { deviceToken?: unknown; sqlitePath?: unknown },
  configPath: string,
): Promise<RegisterSecrets> {
  // Linux dev and CI have no keyring: `--password-store=basic` opts in to the plain-text backend, never in a
  // packaged app unless SHOPPER_INSECURE_SECRETS=1 (the packaged smoke test). Windows always uses DPAPI.
  if (
    process.platform === "linux" &&
    app.commandLine.getSwitchValue("password-store") === "basic" &&
    (!app.isPackaged || process.env.SHOPPER_INSECURE_SECRETS === "1")
  )
    safeStorage.setUsePlainTextEncryption(true);
  const forcedOff = !app.isPackaged && process.env.SHOPPER_TEST_NO_ENCRYPTION === "1";
  if (forcedOff || !safeStorage.isEncryptionAvailable())
    throw new Error("OS encryption is unavailable, so the register cannot protect its secrets");
  const path = join(userData, "register.secret");
  const stored = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (
    stored?.length === 0 &&
    typeof config.sqlitePath === "string" &&
    existsSync(config.sqlitePath)
  )
    throw new Error(
      "register.secret is empty but the register database exists. Restore the secret",
    );
  const sealed = stored?.length ? stored : undefined;
  const token = typeof config.deviceToken === "string" ? config.deviceToken : undefined;
  let secrets: RegisterSecrets;
  if (sealed) {
    try {
      secrets = v.parse(registerSecrets, JSON.parse(safeStorage.decryptString(sealed)));
    } catch {
      throw new Error("register.secret is unreadable");
    }
    if (!token || token === secrets.deviceToken) {
      if (token) await scrub(configPath, config);
      return secrets;
    }
    secrets = { ...secrets, deviceToken: token };
  } else {
    if (!token)
      throw new Error("register.json has no deviceToken to seal. Enroll this register again");
    secrets = { v: 1, databaseKey: randomBytes(32).toString("hex"), deviceToken: token };
  }
  await writeAtomic(path, safeStorage.encryptString(JSON.stringify(secrets)));
  await scrub(configPath, config);
  return secrets;
}

function scrub(configPath: string, config: { deviceToken?: unknown }) {
  const { deviceToken: _sealed, ...rest } = config;
  return writeAtomic(configPath, JSON.stringify(rest, null, 2));
}
