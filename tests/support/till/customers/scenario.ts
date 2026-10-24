// A live register for the customer e2e: a real host, bridge and server, with the server reachable (unlike the sale
// scenario, which keeps it down). The server holds one barcoded product and Ama Mensah (0241234567), a regular with
// one sale already behind her; the register has pulled both before the page opens.
//   startCustomerScenario(appOrigin) -> { url, barcode, ama, upstream, serverSales, stop }
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { createConnectionHost } from "../connection/host";
import { startBridgeProxy } from "../connection/proxy";
import { createConnectionServer } from "../connection/server";
import { startHostUpstream } from "../host/upstream";

export const amaPhone = "0241234567";
const barcode = ean13("600987600001");

export async function startCustomerScenario(appOrigin: string) {
  const server = await createConnectionServer("connected-empty");
  const cleanups: (() => Promise<unknown> | void)[] = [() => server.close()];
  const stop = async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  };
  try {
    const { createCustomer } = await import("@shopper/core/customers");
    const { orgId } = server.identity;
    const ama = v7();
    // Seeded before the host starts, so the register's first snapshot carries both.
    await createCustomer(
      server.database,
      { orgId, appVersion: server.appVersion, reason: "Customer e2e" },
      { customer: { id: ama, name: "Ama Mensah", phone: amaPhone } },
    );
    await server.database.execute(sql`
      INSERT INTO product_barcode (id, org_id, product_id, code, quantity_thousandths)
      VALUES (${v7()}, ${orgId}, ${server.productId}, ${barcode}, 1000)`);
    const upstream = await startHostUpstream(server.api);
    cleanups.push(() => upstream.close());
    const fixture = await createConnectionHost(server, upstream.url, appOrigin);
    cleanups.push(() => fixture.close());
    const host = await fixture.start();
    const bridge = await startBridgeProxy(host.ready.port, false);
    cleanups.push(() => bridge.close());
    await host.waitForStatus((status) => status.server === "online" && status.lastPullAt !== null);
    await until(async () => {
      const found = await host.request({ type: "customer.find", phone: amaPhone });
      return found.type === "result" && (found.customers as unknown[]).length === 1;
    });
    // Her earlier sale, rung up on this register before the browser opens.
    const sell = (expectedRevision: number, message: Record<string, unknown>) =>
      host.request({ expectedRevision, ...message });
    await sell(0, { type: "add", productId: server.productId });
    await sell(1, { type: "customer.attach", customerId: ama });
    await sell(2, { type: "tender.add", kind: "cash", amount: 12_000 });
    const earlier = await sell(3, { type: "sale.complete" });
    if (earlier.type !== "result") throw new Error("The earlier sale did not complete");
    return {
      url: `${appOrigin}/#${encodeURIComponent(host.ready.capability)}`,
      barcode,
      ama,
      upstream,
      /** The customer on each sale the server has stored, oldest first. */
      async serverSales() {
        const { rows } = await server.database.execute<{ customer_id: string | null }>(
          sql`SELECT customer_id FROM sale WHERE org_id = ${orgId} ORDER BY id`,
        );
        return rows.map((row) => row.customer_id);
      },
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function until(done: () => Promise<boolean>, timeoutMs = 20_000) {
  for (const started = Date.now(); Date.now() - started < timeoutMs;) {
    if (await done()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("The register did not pull the customer in time");
}

function ean13(body: string) {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) sum += Number(body[i]) * (i % 2 ? 3 : 1);
  return `${body}${(10 - (sum % 10)) % 10}`;
}
