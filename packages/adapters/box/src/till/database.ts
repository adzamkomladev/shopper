import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3-multiple-ciphers";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { tillMigrations, type TillDatabase } from "@shopper/db-sqlite";

type SQLite = InstanceType<typeof Database>;

export class TillDatabaseKeyError extends Error {
  constructor() {
    super("Till database key is wrong or the file is not an encrypted till database");
    this.name = "TillDatabaseKeyError";
  }
}

/** With a 64-hex `key` the file is SQLCipher-encrypted (SQLite3 Multiple Ciphers); without one it is plain. */
export function openTillDatabase(path: string, key?: string): TillDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { timeout: 0 }); // fail fast on a held lock, as node:sqlite did
  try {
    if (key) unlock(sqlite, key);
    sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
    migrate(sqlite);
  } catch (error) {
    sqlite.close();
    throw error;
  }
  const db = drizzle(async (query, params: unknown[], method) => {
    const statement = sqlite.prepare(query);
    if (method === "run" || !statement.reader) {
      statement.run(...params);
      return { rows: [] };
    }
    // Proxy selections need numeric access; raw SQL queries retain named result columns.
    const columns = statement.columns();
    const valuesRows = statement.raw(true).all(...params) as unknown[][];
    if (method === "values") return { rows: valuesRows };
    const rows = valuesRows.map((values) => {
      const row = Object.fromEntries(values.map((value, index) => [columns[index].name, value]));
      values.forEach((value, index) => Object.defineProperty(row, index, { value }));
      return row;
    });
    return { rows: (method === "get" ? rows[0] : rows) as unknown[] };
  });
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (closed) return Promise.reject(new Error("Till database is closed"));
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  }
  return {
    read: (fn) => enqueue(() => fn(db)),
    transaction: (fn) => enqueue(() => db.transaction((tx) => fn(tx), { behavior: "immediate" })),
    close() {
      if (closed) return tail.then(() => undefined);
      closed = true;
      const result = tail.then(() => void sqlite.close());
      tail = result;
      return result;
    },
  };
}

/** The key pragmas must run before any other statement; the read proves the key opens the file. */
function unlock(sqlite: SQLite, key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("Till database key must be 64 hex characters");
  sqlite.pragma("cipher='sqlcipher'");
  sqlite.pragma("legacy=4");
  sqlite.pragma(`key="x'${key}'"`);
  try {
    sqlite.prepare("SELECT count(*) FROM sqlite_master").get();
  } catch {
    throw new TillDatabaseKeyError();
  }
}

/** Runs each pending step and its user_version bump in one transaction, reading the version under the lock. */
function migrate(sqlite: SQLite) {
  for (let step = 0; step < tillMigrations.length; step++) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const { user_version } = sqlite.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      if (user_version <= step)
        sqlite.exec(`${tillMigrations[step]};PRAGMA user_version=${step + 1}`);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}
