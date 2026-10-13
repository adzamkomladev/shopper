import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { localSale, outbox } from "@shopper/db-sqlite";
import { hostConfiguration } from "../server";
import { startTillHost } from "./process";

export async function createHostFixture(
  options: { upstream?: string; origins?: string[]; freshSession?: boolean; session?: null } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "shopper-till-host-"));
  const sqlitePath = join(directory, "till.sqlite");
  const database = openTillDatabase(sqlitePath);
  let config: Awaited<ReturnType<typeof hostConfiguration>>;
  try {
    config = await hostConfiguration(
      sqlitePath,
      options.origins ?? ["http://127.0.0.1:5184"],
      options.upstream,
      { freshSession: options.freshSession, session: options.session },
    );
  } catch (error) {
    await database.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  let host: Awaited<ReturnType<typeof startTillHost>> | undefined;
  return {
    database,
    sqlitePath,
    config,
    async start(configOverride: unknown = config) {
      host = await startTillHost(configOverride);
      config.port = host.ready.port;
      return host;
    },
    async localSales() {
      return database.read((tx) => tx.select().from(localSale));
    },
    async queued() {
      return database.read((tx) => tx.select().from(outbox));
    },
    async close() {
      try {
        await host?.stop();
      } finally {
        try {
          await database.close();
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      }
    },
  };
}
