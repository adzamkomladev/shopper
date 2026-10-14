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
export type StatusScenario =
  | "live"
  | "polling"
  | "offline"
  | "syncing"
  | "upgrade"
  | "revoked"
  | "receipts";

export const connectionScenario = {
  async start(
    state: ConnectionState | StatusScenario,
    appOrigin: string,
    statusFault?: StatusFault,
  ) {
    const serverState =
      state === "upgrade"
        ? "incompatible"
        : ["live", "polling", "offline", "syncing", "receipts"].includes(state)
          ? "connected-empty"
          : state;
    const server = await createConnectionServer(serverState);
    let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
    let fixture: Awaited<ReturnType<typeof createConnectionHost>> | undefined;
    let host:
      | Awaited<ReturnType<Awaited<ReturnType<typeof createConnectionHost>>["start"]>>
      | undefined;
    let bridge: Awaited<ReturnType<typeof startBridgeProxy>> | undefined;
    let gate: ReturnType<Awaited<ReturnType<typeof startHostUpstream>>["holdNextPush"]> | undefined;
    let pullGate:
      | ReturnType<Awaited<ReturnType<typeof startHostUpstream>>["holdNextPull"]>
      | undefined;
    let stopped = false;
    const cleanup = async () => {
      gate?.release();
      pullGate?.release();
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
      if (state === "syncing") pullGate = upstream.holdNextPull();
      if (state === "polling" || state === "offline") upstream.setLiveAvailable(false);
      if (state === "offline") upstream.setPullAvailable(false);
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
      const recordSales = async (count: number) => {
        for (let index = 0; index < count; index += 1) await recordSale();
      };
      if (
        state !== "connecting" &&
        state !== "offline" &&
        state !== "incompatible" &&
        state !== "upgrade"
      )
        await host.waitForStatus((status) => status.server === "online");
      if (state === "live")
        await host.waitForStatus((status) => status.mode === "live" && status.lastPullAt !== null);
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
      if (state === "incompatible" || state === "upgrade")
        await host.waitForStatus((status) => status.server === "incompatible");
      if (state === "polling") await host.waitForStatus((status) => status.mode === "polling");
      if (state === "offline") await host.waitForStatus((status) => status.mode === "offline");
      if (state === "syncing") {
        await pullGate?.entered;
        await host.waitForStatus((status) => status.syncing === true);
      }
      if (state === "receipts") {
        await host.waitForStatus((status) => status.receiptsLeft === 2_000);
        upstream.setAvailable(false);
        await fixture.recordSales(1_901);
        await host.request({ type: "retry" });
      }
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
        pullRequestCount: () => upstream!.pullRequestCount(),
        waitForPull(call: number) {
          return upstream!.waitForPull(call);
        },
        recordSales,
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

function labelFor(state: ConnectionState | StatusScenario) {
  return {
    disconnected: "Connected",
    connecting: "Connecting",
    "connected-empty": "Connected",
    queued: "Connected",
    "upstream-offline": "Offline",
    blocked: "Upload blocked",
    revoked: "Device revoked",
    incompatible: "Version incompatible",
    live: "Live",
    polling: "Polling",
    offline: "Offline",
    syncing: "Syncing",
    upgrade: "Upgrade needed",
    receipts: "Receipts low",
  }[state];
}
