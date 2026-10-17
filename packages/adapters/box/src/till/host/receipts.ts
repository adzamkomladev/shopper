import * as v from "valibot";
import { eq } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { localSale, receiptOutput } from "@shopper/db-sqlite";
import { receiptDocument, type ReceiptDocument } from "@shopper/core/receipts";
import {
  readRegisterSettings,
  recordReceiptPrint,
  storeReceiptPdf,
  TillError,
} from "@shopper/core/till";
import { encodeReceipt, escpos, paper, printerProfiles } from "@shopper/hardware";
import { networkPrinter, printerDrawer } from "@shopper/hardware/network";
import type { ReceiptPrinter } from "@shopper/hardware";
import type { Renderer } from "@shopper/ports";
import type { PrinterStatus } from "@shopper/sync/bridge";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { HostConfiguration } from "./config";

type Job = {
  kind: NonNullable<PrinterStatus["lastJob"]>["kind"];
  saleId: string | null;
  record?: "first" | "reprint";
};
type Context = ReturnType<typeof auditContext>;
type Settings = Awaited<ReturnType<typeof readRegisterSettings>>["value"];
/** Settings with a printer; the type proves the unconfigured case was handled. */
type Ready = Settings & { printer: NonNullable<Settings["printer"]> };
type Write = (printer: ReceiptPrinter, current: Ready) => Promise<void>;

/** Prints receipts and kicks the drawer on the till's network printer; a printer fault never fails a sale. */
export function createHostReceipts(options: {
  database: TillDatabase;
  config: HostConfiguration;
  publishStatus: () => Promise<void>;
  /** The Electron parent's renderer; the box renderer is loaded on first use otherwise. */
  renderer?: Renderer;
  /** Called after a receipt PDF is stored, so a sale that was acknowledged first still uploads. */
  onPdfStored: () => void;
}) {
  const { database, config, publishStatus } = options;
  let box: Promise<Renderer> | undefined;
  // Loaded lazily: satori and resvg-wasm are only evaluated on a host that renders itself.
  const renderer = async () =>
    options.renderer ?? (await (box ??= import("../../renderer").then((m) => m.boxRenderer())));
  let pdfTail: Promise<unknown> = Promise.resolve();
  let lastJob: PrinterStatus["lastJob"] = null;
  let offline = false;
  let tail: Promise<unknown> = Promise.resolve();

  /** One job at a time: bytes never interleave on the socket and the status follows the latest job. */
  function queued<T>(job: () => Promise<T>): Promise<T> {
    const result = tail.then(job, job);
    tail = result.catch(() => undefined);
    return result;
  }

  async function load(): Promise<Ready | null> {
    const { value } = await readRegisterSettings(database, config.identity);
    return value.printer ? { ...value, printer: value.printer } : null;
  }
  const required = async () => {
    const current = await load();
    if (!current) throw new TillError("PRINTER_UNCONFIGURED", "Add a printer in Settings");
    return current;
  };

  async function receiptOf(saleId: string) {
    const [sale] = await database.read((tx) =>
      tx.select({ receipt: localSale.receipt }).from(localSale).where(eq(localSale.id, saleId)),
    );
    if (!sale?.receipt) throw new TillError("SALE_UNKNOWN", "Sale receipt is unavailable");
    return v.parse(receiptDocument, sale.receipt);
  }

  /** Sends one job, records the attempt when it belongs to a sale, and throws PRINTER_OFFLINE on failure. */
  async function send(current: Ready, context: Context, job: Job, write: Write) {
    const { host, port } = current.printer.connection;
    let message: string | null = null;
    try {
      await write(networkPrinter({ host, port }), current);
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
    }
    offline = message !== null;
    lastJob = {
      kind: job.kind,
      saleId: job.saleId,
      outcome: message ? "failed" : "printed",
      message,
    };
    if (job.saleId && job.record)
      await recordReceiptPrint(
        database,
        context,
        job.saleId,
        message ? { error: message } : job.record,
      );
    await publishStatus();
    if (message) throw new TillError("PRINTER_OFFLINE", message);
  }

  const kick: Write = (printer, current) =>
    printerDrawer(printer, printerProfiles[current.printer.model]).open();
  const printReceipt = (
    receipt: ReceiptDocument,
    current: Ready,
    reprint: boolean,
    openDrawer: boolean,
  ) =>
    encodeReceipt(receipt, {
      profile: printerProfiles[current.printer.model],
      paperMm: current.paperMm,
      reprint,
      openDrawer,
    });

  /** A copy is a reprint only once a copy has printed; until then the next one is the original. */
  async function printedBefore(saleId: string) {
    const [output] = await database.read((tx) =>
      tx
        .select({ printedAt: receiptOutput.printedAt })
        .from(receiptOutput)
        .where(eq(receiptOutput.saleId, saleId)),
    );
    return !!output?.printedAt;
  }

  /** Renders the digital receipt and stores it. Never throws: the sale is committed and the PDF can be reprinted later. */
  async function storePdf(saleId: string, seller: Context) {
    try {
      const { value } = await readRegisterSettings(database, config.identity);
      const pdf = await (
        await renderer()
      ).receipt(await receiptOf(saleId), { paperMm: value.paperMm, reprint: false }, "pdf");
      await storeReceiptPdf(database, seller, { saleId, pdf });
      options.onPdfStored();
    } catch (error) {
      console.error("Receipt PDF after sale failed", error);
    }
  }

  return {
    printer(configured: boolean): PrinterStatus {
      return { state: !configured ? "unconfigured" : offline ? "offline" : "ready", lastJob };
    },
    /** Called when the printer configuration changed: the old printer's faults say nothing about the new one. */
    reset() {
      lastJob = null;
      offline = false;
    },
    /**
     * Fire and forget after a committed sale: prints (kicking for cash), or only kicks when printing is off.
     * The seller is captured now, so the print is attributed to them even if they sign out first.
     */
    afterSale(saleId: string) {
      const seller = auditContext(config);
      pdfTail = pdfTail.then(() => storePdf(saleId, seller));
      return queued(async () => {
        try {
          const current = await load();
          if (!current) return;
          const receipt = await receiptOf(saleId);
          const cash = receipt.tenders.some((tender) => tender.kind === "cash");
          if (current.printAutomatically)
            await send(current, seller, { kind: "receipt", saleId, record: "first" }, (printer) =>
              printer.print(printReceipt(receipt, current, false, cash)),
            );
          else if (cash) await send(current, seller, { kind: "drawer", saleId }, kick);
        } catch (error) {
          // The sale is committed. A printer fault is already on the status and in print_error;
          // anything else (a database or encoding fault) must still be visible to the operator.
          if (!(error instanceof TillError && error.code === "PRINTER_OFFLINE"))
            console.error("Receipt output after sale failed", error);
        }
      });
    },
    print(saleId: string) {
      const context = auditContext(config);
      return queued(async () => {
        const [current, receipt, reprint] = await Promise.all([
          required(),
          receiptOf(saleId),
          printedBefore(saleId),
        ]);
        const record = reprint ? "reprint" : "first";
        await send(current, context, { kind: "receipt", saleId, record }, (printer) =>
          printer.print(printReceipt(receipt, current, reprint, false)),
        );
      });
    },
    testPrint: () =>
      queued(async () =>
        send(
          await required(),
          auditContext(config),
          { kind: "test", saleId: null },
          (printer, current) => {
            const { model, connection } = current.printer;
            return printer.print(
              escpos(printerProfiles[model], current.paperMm)
                .init()
                .align("center")
                .bold(true)
                .text("Printer test")
                .bold(false)
                .text(`Model: ${model}`)
                .text(`Paper: ${current.paperMm} mm (${paper[current.paperMm].cols} columns)`)
                .text(`${connection.host}:${connection.port}`)
                .cut()
                .bytes(),
            );
          },
        ),
      ),
    openDrawer: () =>
      queued(async () =>
        send(await required(), auditContext(config), { kind: "drawer", saleId: null }, kick),
      ),
  };
}

/** The audit context of the signed-in cashier on this register. */
export function auditContext(config: HostConfiguration) {
  const { orgId, deviceId, branchId } = config.identity;
  return {
    orgId,
    deviceId,
    branchId,
    actorId: config.session?.userId,
    role: config.session?.roleName,
    appVersion: buildInfo.version,
  };
}
