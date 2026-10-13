import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createConnectionServer } from "./server";
import { startTillHost } from "../host/process";

type Server = Awaited<ReturnType<typeof createConnectionServer>>;

export async function createConnectionHost(server: Server, upstream: string, origin: string) {
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
    session: server.session,
    references: server.references,
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
      server.references,
    );
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
