import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createConnectionServer } from "./server";
import { startTillHost } from "../host/process";
import { insertOpenShift } from "../shifts";

type Server = Awaited<ReturnType<typeof createConnectionServer>>;

export async function createConnectionHost(
  server: Server,
  upstream: string,
  origin: string,
  references: unknown = server.references,
  /** `shift: false` leaves the register closed, so a test can open the shift itself. */
  options: { shift?: boolean } = {},
) {
  const [{ openTillDatabase }, { provisionTillReference }] = await Promise.all([
    import("@shopper/adapters-box/till"),
    import("@shopper/core/till"),
  ]);
  const directory = await mkdtemp(join(tmpdir(), "shopper-connection-"));
  const sqlitePath = join(directory, "till.sqlite");
  const database = openTillDatabase(sqlitePath);
  const config = {
    sqlitePath,
    identity: server.identity,
    deviceToken: server.deviceToken,
    receiptCodes: server.receiptCodes,
    session: server.session,
    references,
    upstream,
    origins: [origin],
    port: 0,
  };
  try {
    await provisionTillReference(
      database,
      {
        orgId: server.identity.orgId,
        actorId: server.session.userId,
        role: server.session.roleName,
        deviceId: server.identity.deviceId,
        branchId: server.identity.branchId,
        appVersion: server.appVersion,
      },
      references,
    );
    if (options.shift !== false)
      await insertOpenShift(database, {
        orgId: server.identity.orgId,
        deviceId: server.identity.deviceId,
        branchId: server.identity.branchId,
        storeId: server.identity.storeId,
        openedBy: server.session.userId,
        openedSessionId: server.session.id,
      });
  } catch (error) {
    await database.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  let host: Awaited<ReturnType<typeof startTillHost>> | undefined;
  return {
    config,
    async start() {
      host = await startTillHost(config);
      return host;
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
