import { sql } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { tillAudit } from "@shopper/db-sqlite";
import { createHostFixture } from "../till/host/fixture";
import { connectBrowser } from "../till/host/socket";
import type { Printer } from "./printer";

export { freePort, startPrinter, type Printer } from "./printer";

export const DRAWER_KICK = { name: "drawer", pin: 0, on: 25, off: 250 };
type Reply = Record<string, any>;
type Sale = { saleId: string; reply: Reply; receipt: Reply };
export type Tender = { kind: "cash" | "card"; amount: number };

/** The complete settings document the browser saves; `port` points at a (virtual) network printer. */
export function registerSettings(port: number | null, overrides: Record<string, unknown> = {}) {
  return {
    storeName: "Osu Mart",
    registerName: "Front till",
    printAutomatically: true,
    paperMm: 80,
    clearCartAfterSale: true,
    requirePinForReturns: false,
    printer:
      port === null
        ? null
        : { model: "epson", connection: { kind: "network", host: "127.0.0.1", port } },
    ...overrides,
  };
}

/** A real till host reached through the browser WebSocket bridge. `permissions` are added to the cashier session; `upstream` is the server it syncs with (unreachable by default). */
export async function startRegister(
  options: { permissions?: readonly string[]; upstream?: string } = {},
) {
  const fixture = await createHostFixture({ freshSession: true, upstream: options.upstream });
  const session = fixture.config.session;
  if (!session) throw new Error("Expected a signed-in fixture session");
  const permissions = options.permissions ?? ["register.settings"];
  const host = await fixture.start({
    ...fixture.config,
    session: { ...session, permissions: [...new Set([...session.permissions, ...permissions])] },
    receiptReference: {
      branchName: "Osu branch",
      cashierName: "Ama Mensah",
      tin: "P0012345678",
      address: "Oxford Street, Accra",
    },
  });
  const browser = await connectBrowser(host.ready);
  const ask = (message: Reply): Promise<Reply> => browser.ask(message);
  const status = async () => (await ask({ type: "status" })).status as Reply;
  const register = {
    fixture,
    host,
    ask,
    status,
    shopName: fixture.config.identity.shopName,
    registerName: fixture.config.identity.registerName,
    async save(settings: unknown, expectedRevision?: number) {
      const revision = expectedRevision ?? (await status()).settings?.revision;
      return ask({ type: "settings.save", settings, expectedRevision: revision });
    },
    /** Saves settings at the current revision and expects it to succeed. */
    async configure(settings: unknown) {
      const reply = await register.save(settings);
      expect(reply).toMatchObject({ type: "result" });
    },
    /** Fills the basket with the first product, applies the tenders and completes the sale. */
    async sell(tenders: Tender[], quantityThousandths = 1000): Promise<Sale> {
      const productId = fixture.config.references.products[0].id;
      await ask({ type: "add", expectedRevision: 0, productId, quantityThousandths });
      let revision = 1;
      for (const tender of tenders) {
        const card = tender.kind === "card" ? { approvalCode: "ABC123", last4: "1234" } : {};
        const added = await ask({
          type: "tender.add",
          expectedRevision: revision,
          ...tender,
          ...card,
        });
        expect(added).toMatchObject({ kind: "draft" });
        revision += 1;
      }
      const reply = await ask({ type: "sale.complete", expectedRevision: revision });
      expect(reply).toMatchObject({ type: "result", kind: "sale" });
      return { saleId: reply.event.sale.id, reply, receipt: reply.receipt };
    },
    async audit(command: string) {
      const rows = await fixture.database.read((tx) => tx.select().from(tillAudit));
      return rows
        .filter((row) => row.command === command)
        .sort((a, b) => (a.chainSeq ?? 0) - (b.chainSeq ?? 0));
    },
    async receiptOutput(saleId: string) {
      const rows = await fixture.database.read((tx) =>
        tx.all<Reply>(sql`select * from receipt_output where sale_id = ${saleId}`),
      );
      return rows[0];
    },
    async close() {
      browser.socket.close();
      await fixture.close();
    },
  };
  return register;
}

export type Register = Awaited<ReturnType<typeof startRegister>>;

/** Audit rows name their sale either in `entity_id` or in the payload. */
export const auditedSale = (rows: Awaited<ReturnType<Register["audit"]>>, saleId: string) =>
  rows.filter((row) => row.entityId === saleId || row.payload.saleId === saleId);
