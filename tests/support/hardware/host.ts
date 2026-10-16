import { spawn, type ChildProcess } from "node:child_process";
import { connect, createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { tillAudit } from "@shopper/db-sqlite";
import { decodeEscPos } from "./escpos";
import { createHostFixture } from "../till/host/fixture";
import { connectBrowser } from "../till/host/socket";

export const DRAWER_KICK = { name: "drawer", pin: 0, on: 25, off: 250 };
type Reply = Record<string, any>;
type Sale = { saleId: string; reply: Reply; receipt: Reply };
export type Tender = { kind: "cash" | "card"; amount: number };

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** The virtual ESC/POS printer on `port` (a fresh free port by default); every connection is one captured job. */
export async function startPrinter(port?: number) {
  const listenOn = port ?? (await freePort());
  const directory = await mkdtemp(join(tmpdir(), "shopper-printer-"));
  const server: ChildProcess = spawn("node", ["tooling/printer/server.mjs"], {
    env: { ...process.env, CAPTURE_DIR: directory, PORT: String(listenOn) },
    stdio: "pipe",
  });
  await expect
    .poll(
      () =>
        new Promise<boolean>((resolve) => {
          const socket = connect(listenOn, "127.0.0.1");
          socket.once("error", () => resolve(false));
          socket.once("connect", () => {
            socket.end();
            resolve(true);
          });
        }),
    )
    .toBe(true);
  const printer = {
    port: listenOn,
    /** Captured jobs in arrival order, decoded the way a printer would read them. */
    async jobs() {
      const files = await Promise.all(
        (await readdir(directory)).map(async (name) => ({
          name,
          at: (await stat(join(directory, name), { bigint: true })).mtimeNs,
        })),
      );
      files.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const captured = await Promise.all(
        files.map(async ({ name }) => new Uint8Array(await readFile(join(directory, name)))),
      );
      // The readiness probe connects and hangs up, which the virtual printer captures as an empty file.
      return captured
        .filter((bytes) => bytes.length > 0)
        .map((bytes) => {
          const { text, commands } = decodeEscPos(bytes);
          return {
            bytes,
            text,
            commands,
            page: text.join("\n"),
            kicks: commands.filter((command) => command.name === "drawer").length,
          };
        });
    },
    async waitForJobs(count: number) {
      await expect.poll(async () => (await printer.jobs()).length, { timeout: 10_000 }).toBe(count);
      return printer.jobs();
    },
    async stop() {
      server.kill();
      await new Promise<void>((resolve) => server.once("close", () => resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
  return printer;
}

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

/** A real till host reached through the browser WebSocket bridge. `permissions` are added to the cashier session. */
export async function startRegister(options: { permissions?: readonly string[] } = {}) {
  const fixture = await createHostFixture({ freshSession: true });
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
    async sell(tenders: Tender[]): Promise<Sale> {
      const productId = fixture.config.references.products[0].id;
      await ask({ type: "add", expectedRevision: 0, productId });
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
export type Printer = Awaited<ReturnType<typeof startPrinter>>;

/** Audit rows name their sale either in `entity_id` or in the payload. */
export const auditedSale = (rows: Awaited<ReturnType<Register["audit"]>>, saleId: string) =>
  rows.filter((row) => row.entityId === saleId || row.payload.saleId === saleId);
