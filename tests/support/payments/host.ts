import { v7 } from "uuid";
import { openTillDatabase, createHostPayments } from "@shopper/adapters-box/till";
import { buildInfo } from "@shopper/config";
import type { BridgeMessage } from "@shopper/sync/bridge";
import { addToDraft, provisionTillReference } from "@shopper/core/till";
import { serveHono } from "../till/http";
import { momoFixture } from "./momo";

export async function paymentHost(
  path: string,
  options: {
    failFirstStartReply?: boolean;
    beforeReply?: (path: string, response: Response) => Promise<void>;
  } = {},
) {
  const fixture = await momoFixture();
  let failed = false;
  const server = await serveHono({
    async fetch(request) {
      const response = await fixture.api.fetch(request);
      if (
        options.failFirstStartReply &&
        !failed &&
        request.method === "POST" &&
        new URL(request.url).pathname === "/payments/momo"
      ) {
        failed = true;
        return Response.json({ error: "Connection lost after charge creation" }, { status: 503 });
      }
      if (request.method === "POST")
        await options.beforeReply?.(new URL(request.url).pathname, response);
      return response;
    },
  });
  const database = openTillDatabase(path);
  const scope = {
    orgId: fixture.orgId,
    deviceId: fixture.ids.device,
    branchId: fixture.ids.branch,
    cashierId: fixture.ids.user,
  };
  const context = {
    ...scope,
    actorId: scope.cashierId,
    role: "cashier",
    appVersion: buildInfo.version,
  };
  const productId = v7();
  const session = {
    id: fixture.session.id,
    orgId: scope.orgId,
    deviceId: scope.deviceId,
    branchId: scope.branchId,
    userId: scope.cashierId,
    proof: fixture.token,
    roleName: fixture.session.roleName,
    issuedAt: fixture.session.issuedAt,
    expiresAt: fixture.session.expiresAt,
    permissions: fixture.session.permissions,
  };
  const config = {
    sqlitePath: path,
    identity: {
      ...scope,
      storeId: fixture.ids.store,
      shopName: "MoMo tenant",
      registerName: "Till",
    },
    upstream: server.url,
    deviceToken: fixture.deviceToken,
    session,
    port: 0,
    origins: ["http://localhost"],
  };
  await provisionTillReference(database, context, {
    products: [
      {
        id: productId,
        orgId: scope.orgId,
        sku: "MOMO",
        name: "MoMo basket",
        baseUnit: "each",
        taxClass: "standard",
        archivedAt: null,
        barcodes: [],
      },
    ],
    prices: [
      {
        id: v7(),
        orgId: scope.orgId,
        productId,
        branchId: null,
        amount: 10_000,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTo: null,
      },
    ],
    taxRules: [
      {
        id: v7(),
        orgId: scope.orgId,
        effectiveFrom: "2026-01-01",
        vatBps: 1500,
        nhilBps: 250,
        getfundBps: 250,
        covidBps: 0,
        source: "Ghana 2026 host integration",
      },
    ],
    barcodeMappings: [],
    cashRounding: "10p",
  });
  const messages: BridgeMessage[] = [];
  const payments = createHostPayments(database, config, (message) => messages.push(message));
  await addToDraft(database, context, { scope, at: new Date(), expectedRevision: 0, productId });
  return {
    ...fixture,
    database,
    scope,
    context,
    messages,
    payments,
    async close() {
      await database.close();
      await server.close();
      await fixture.close();
    },
  };
}
