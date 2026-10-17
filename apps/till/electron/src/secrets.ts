import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, safeStorage } from "electron";

type RegisterSecrets = { v: 1; databaseKey: string; deviceToken: string };

/** Writes next to the target and renames over it, so a crash never leaves a half-written file. */
export async function writeAtomic(path: string, content: string | Buffer) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

/**
 * The register's secrets live only in `userData/register.secret`, sealed by the OS (DPAPI on Windows).
 * The first start seals a fresh database key plus the device token found in `register.json`.
 */
export async function loadSecrets(
  userData: string,
  config: { deviceToken?: unknown },
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
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("OS encryption is unavailable, so the register cannot protect its secrets");
  const path = join(userData, "register.secret");
  const sealed = await readFile(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (sealed) return JSON.parse(safeStorage.decryptString(sealed)) as RegisterSecrets;
  if (typeof config.deviceToken !== "string")
    throw new Error("register.json has no deviceToken to seal. Enroll this register again");
  const secrets: RegisterSecrets = {
    v: 1,
    databaseKey: randomBytes(32).toString("hex"),
    deviceToken: config.deviceToken,
  };
  await writeAtomic(path, safeStorage.encryptString(JSON.stringify(secrets)));
  const { deviceToken: _sealed, ...rest } = config;
  await writeAtomic(configPath, JSON.stringify(rest, null, 2));
  return secrets;
}
