// Raw SQLite3MC access for the encryption suites; the addon is a dependency of @shopper/adapters-box only.
import { createRequire } from "node:module";

const require = createRequire(import.meta.resolve("@shopper/adapters-box"));
export const modulePath = require.resolve("better-sqlite3-multiple-ciphers");
type Cipher = {
  exec(source: string): unknown;
  pragma(source: string): unknown;
  prepare(source: string): { get(): unknown };
  close(): void;
};
export const Database = require("better-sqlite3-multiple-ciphers") as new (
  path: string,
  options?: { timeout?: number },
) => Cipher;

/** Opens `path` with the till's SQLCipher settings. */
export function openCipher(path: string, key: string) {
  const db = new Database(path);
  db.pragma("cipher='sqlcipher'");
  db.pragma("legacy=4");
  db.pragma(`key="x'${key}'"`);
  return db;
}
