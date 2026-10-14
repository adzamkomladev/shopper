import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SQLInputValue, DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { tillMigrations, type TillDatabase } from "@shopper/db-sqlite";

export function openTillDatabase(path: string): TillDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const require = createRequire(import.meta.url);
  const sqlite: DatabaseSync = new (require("node:sqlite").DatabaseSync)(path);
  sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
  migrate(sqlite);
  const db = drizzle(async (query, params: SQLInputValue[], method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    // Proxy selections need numeric access; raw SQL queries retain named result columns.
    statement.setReturnArrays(true);
    const columns = statement.columns();
    const valuesRows: unknown[][] = statement.all(...params).map((row) => {
      if (!Array.isArray(row)) throw new Error("SQLite array result mode was not applied");
      return row;
    });
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
      const result = tail.then(() => sqlite.close());
      tail = result;
      return result;
    },
  };
}

/** Runs each pending step and its user_version bump in one transaction, reading the version under the lock. */
function migrate(sqlite: DatabaseSync) {
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
