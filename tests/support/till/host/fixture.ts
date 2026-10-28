import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { localSale, outbox } from "@shopper/db-sqlite";
import { hostConfiguration, renewTillEnrollment, type FixtureTill } from "../server";
import { insertOpenShift } from "../shifts";
import { startTillHost } from "./process";

export async function createHostFixture(
  options: {
    upstream?: string;
    origins?: string[];
    freshSession?: boolean;
    session?: null;
    shift?: boolean;
    /** Another enrolled register (`enrollAnotherTill`); by default the suite's main till is re-enrolled. */
    till?: FixtureTill;
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "shopper-till-host-"));
  const sqlitePath = join(directory, "till.sqlite");
  const database = waitingOnHost(openTillDatabase(sqlitePath));
  let config: Awaited<ReturnType<typeof hostConfiguration>>;
  try {
    if (!options.till) await renewTillEnrollment();
    config = await hostConfiguration(
      sqlitePath,
      options.origins ?? ["http://127.0.0.1:5184"],
      options.upstream,
      { freshSession: options.freshSession, session: options.session, till: options.till },
    );
    // An open shift, inserted directly (no audit row); `{ shift: false }` leaves the register closed.
    if (options.shift !== false)
      await insertOpenShift(database, {
        orgId: config.identity.orgId,
        deviceId: config.identity.deviceId,
        branchId: config.identity.branchId,
        storeId: config.identity.storeId,
        openedBy: config.session?.userId ?? config.identity.deviceId,
        openedSessionId: config.session?.id ?? config.identity.deviceId,
      });
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
    async start(
      configOverride: unknown = config,
      startOptions?: Parameters<typeof startTillHost>[1],
    ) {
      host = await startTillHost(configOverride, startOptions);
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

/** The host process writes to the same file in the background; the fixture's own connection waits for it. */
function waitingOnHost(database: ReturnType<typeof openTillDatabase>): typeof database {
  async function retry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!busy(error) || attempt >= 40) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }
  return {
    ...database,
    read: (fn) => retry(() => database.read(fn)),
    transaction: (fn) => retry(() => database.transaction(fn)),
  };
}

// Drizzle wraps the driver error ("Failed query: begin immediate"); the SqliteError is its cause.
function busy(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: unknown }).code === "SQLITE_BUSY" || busy(error.cause))
  );
}
