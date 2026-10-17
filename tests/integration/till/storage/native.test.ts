// Slice S1: Electron ships its own Node ABI, so the one SQLite3MC prebuild must load under both runtimes.
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { modulePath, openCipher } from "../../../support/till/sqlcipher";

const electron = createRequire(import.meta.url)("electron") as string;
const key = "ab".repeat(32);
// Opens the file with the key, appends the runtime's name and prints every runtime that has written.
const script = `
const Database = require(${JSON.stringify(modulePath)});
const db = new Database(process.argv[1]);
db.pragma("cipher='sqlcipher'"); db.pragma("legacy=4"); db.pragma("key=\\"x'${key}'\\"");
db.exec("CREATE TABLE IF NOT EXISTS t(v TEXT)");
db.prepare("INSERT INTO t VALUES (?)").run(process.versions.electron ? "electron" : "node");
console.log(db.prepare("SELECT group_concat(v) AS v FROM t").get().v);
`;

test("the same SQLite3MC build opens an encrypted database under Node and under Electron-as-Node", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shopper-till-native-"));
  try {
    const path = join(dir, "till.sqlite");
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
    const run = (binary: string, extra: NodeJS.ProcessEnv = {}) =>
      execFileSync(binary, ["-e", script, path], { env: { ...env, ...extra } })
        .toString()
        .trim();
    expect(run(process.execPath, { ELECTRON_RUN_AS_NODE: "" })).toBe("node");
    expect(run(electron)).toBe("node,electron");
    const db = openCipher(path, key);
    expect(db.prepare("SELECT count(*) AS n FROM t").get()).toEqual({ n: 2 });
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
