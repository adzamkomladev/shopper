import { createConnectionHost } from "./host";
import { startBridgeProxy, type StatusFault } from "./proxy";
import { createConnectionServer } from "./server";
import { startHostUpstream } from "../host/upstream";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected-empty"
  | "queued"
  | "upstream-offline"
  | "blocked"
  | "revoked"
  | "incompatible";

export const connectionScenario = {
  async start(state: ConnectionState, appOrigin: string, statusFault?: StatusFault) {
    const server = await createConnectionServer(state);
    let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
    let fixture: Awaited<ReturnType<typeof createConnectionHost>> | undefined;
    let host:
      | Awaited<ReturnType<Awaited<ReturnType<typeof createConnectionHost>>["start"]>>
      | undefined;
    let bridge: Awaited<ReturnType<typeof startBridgeProxy>> | undefined;
    let gate: ReturnType<Awaited<ReturnType<typeof startHostUpstream>>["holdNextPush"]> | undefined;
    let stopped = false;
    const cleanup = async () => {
      gate?.release();
      bridge?.release();
      const failures: unknown[] = [];
      try {
        await host?.stop();
      } catch (error) {
        failures.push(error);
      }
      const results = await Promise.allSettled([
        bridge?.close(),
        fixture?.close(),
        upstream?.close(),
        server.close(),
      ]);
      failures.push(
        ...results.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
      );
      if (failures.length) throw new AggregateError(failures, "Connection scenario cleanup failed");
    };
    try {
      upstream = await startHostUpstream(server.api);
      if (state === "queued") gate = upstream.holdNextPush();
      if (state === "upstream-offline" || state === "blocked" || state === "revoked")
        upstream.setAvailable(false);
      fixture = await createConnectionHost(server, upstream.url, appOrigin);
      host = await fixture.start();
      bridge = await startBridgeProxy(host.ready.port, state === "connecting", statusFault);
      // Host, bridge and upstream are initialized above before these callbacks can run.
      const recordSale = async () => {
        const result = await host!.request({
          type: "recordSale",
          input: { lines: [{ productId: server.productId, quantityThousandths: 1_500 }] },
        });
        if (result.type !== "result" || result.kind !== "sale")
          throw new Error("Host did not record the fixture sale");
      };
      if (state !== "connecting" && state !== "incompatible")
        await host.waitForStatus((status) => status.server === "online");
      if (state === "queued") {
        await recordSale();
        await gate?.entered;
      }
      if (state === "upstream-offline" || state === "blocked" || state === "revoked") {
        await recordSale();
        await upstream.waitForPush(1);
        await host.waitForStatus((status) => status.server === "offline");
        if (state === "blocked") await server.expireSession();
        if (state === "revoked") await server.revokeDevice();
        if (state !== "upstream-offline") {
          upstream.setAvailable(true);
          await host.request({ type: "retry" });
          await host.waitForStatus((status) => status.server === state);
        }
      }
      if (state === "incompatible")
        await host.waitForStatus((status) => status.server === "incompatible");
      return {
        url: `${appOrigin}/#${encodeURIComponent(host.ready.capability)}`,
        shopName: server.identity.shopName,
        hostStatus: state === "connecting" ? "Connecting" : "Connected",
        serverStatus: labelFor(state),
        capability: host.ready.capability,
        deviceToken: server.deviceToken,
        sessionProof: server.session.proof,
        bridgeConnectionCount: () => bridge!.connections,
        holdNextBridgeConnection: () => bridge!.holdNextConnection(),
        pushRequestCount: () =>
          upstream!.requests.filter((request) => request.path === "/sync/push").length,
        async waitForPushSuccess(call: number) {
          const request = await upstream!.waitForPush(call);
          if (request.status !== 200)
            throw new Error(`Expected accepted push, received ${request.status}`);
        },
        restoreUpstream() {
          upstream!.setAvailable(true);
        },
        releaseConnection() {
          bridge!.release();
        },
        async waitForHandshake() {
          await host!.waitForStatus((status) => status.server === "online");
        },
        async disconnect() {
          await host!.stop();
        },
        async stop() {
          if (stopped) return;
          stopped = true;
          await cleanup();
        },
      };
    } catch (error) {
      try {
        await cleanup();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Connection scenario setup and cleanup failed",
        );
      }
      throw error;
    }
  },
};

function labelFor(state: ConnectionState) {
  return {
    disconnected: "Connected",
    connecting: "Connecting",
    "connected-empty": "Connected",
    queued: "Connected",
    "upstream-offline": "Offline",
    blocked: "Upload blocked",
    revoked: "Device revoked",
    incompatible: "Version incompatible",
  }[state];
}
