import * as v from "valibot";
import { eq } from "drizzle-orm";
import { localSale, receiptOutput, refund } from "@shopper/db-sqlite";
import { receiptDocument, type ReceiptDocument } from "@shopper/core/receipts";
import {
  readRegisterSettings,
  recordReceiptPrint,
  storeReceiptPdf,
  TillError,
} from "@shopper/core/till";
import type { XReport, ZReport } from "@shopper/core/schemas";
import {
  encodeReceipt,
  encodeShiftReport,
  encodeTestPage,
  printerProfiles,
} from "@shopper/hardware";
import { printerDrawer } from "@shopper/hardware/network";
import type { ReceiptPrinter } from "@shopper/hardware";
import type { Renderer } from "@shopper/ports";
import type { PrinterStatus } from "@shopper/sync/bridge";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { HostConfiguration } from "./config";
import { auditContext } from "./context";
import { describeConnection, printerFor } from "./peripherals/printers";

type Job = {
  kind: NonNullable<PrinterStatus["lastJob"]>["kind"];
  saleId: string | null;
  record?: "first" | "reprint" | undefined;
};
type Context = ReturnType<typeof auditContext>;
type Settings = Awaited<ReturnType<typeof readRegisterSettings>>["value"];
/** Settings with a printer; the type proves the unconfigured case was handled. */
type Ready = Settings & { printer: NonNullable<Settings["printer"]> };
type Write = (printer: ReceiptPrinter, current: Ready) => Promise<void>;

/** Prints receipts and kicks the drawer on the till's configured printer; a printer fault never fails a sale. */
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

  /** The stored receipt of a sale, or of a refund (which has no receipt output of its own). */
  async function receiptOf(id: string) {
    const [sale] = await database.read((tx) =>
      tx.select({ receipt: localSale.receipt }).from(localSale).where(eq(localSale.id, id)),
    );
    const [refunded] = sale
      ? []
      : await database.read((tx) =>
          tx.select({ receipt: refund.receipt }).from(refund).where(eq(refund.id, id)),
        );
    const stored = sale?.receipt ?? refunded?.receipt;
    if (!stored) throw new TillError("SALE_UNKNOWN", "Receipt is unavailable");
    return v.parse(receiptDocument, stored);
  }

  /** Sends one job, records the attempt when it belongs to a sale, and throws PRINTER_OFFLINE on failure. */
  async function send(current: Ready, context: Context, job: Job, write: Write) {
    let message: string | null = null;
    try {
      await write(printerFor(current.printer.connection), current);
    } catch (caught) {
      // The driver errors name the failure only in their cause (no such port, USB needs Windows).
      message =
        caught instanceof Error
          ? caught.cause instanceof Error
            ? `${caught.message}: ${caught.cause.message}`
            : caught.message
          : String(caught);
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

  /** A job that is not a sale's: needs a printer and is attributed to whoever is signed in. */
  const job = (kind: Job["kind"], write: Write) =>
    queued(async () => send(await required(), auditContext(config), { kind, saleId: null }, write));

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
     * Fire and forget after a committed sale or refund: prints (kicking for cash), or only kicks when printing
     * is off. A sale also stores its PDF and records the print in `receipt_output`; a refund has neither.
     * The seller is captured now, so the print is attributed to them even if they sign out first.
     */
    afterDocument(id: string, { sale }: { sale: boolean }) {
      const seller = auditContext(config);
      if (sale) pdfTail = pdfTail.then(() => storePdf(id, seller));
      return queued(async () => {
        try {
          const current = await load();
          if (!current) return;
          const receipt = await receiptOf(id);
          const cash = receipt.tenders.some((tender) => tender.kind === "cash");
          const record = sale ? ("first" as const) : undefined;
          if (current.printAutomatically)
            await send(current, seller, { kind: "receipt", saleId: id, record }, (printer) =>
              printer.print(printReceipt(receipt, current, false, cash)),
            );
          else if (cash) await send(current, seller, { kind: "drawer", saleId: id }, kick);
        } catch (error) {
          // The sale is committed. A printer fault is already on the status and in print_error;
          // anything else (a database or encoding fault) must still be visible to the operator.
          if (!(error instanceof TillError && error.code === "PRINTER_OFFLINE"))
            console.error("Receipt output after sale failed", error);
        }
      });
    },
    print(id: string) {
      const context = auditContext(config);
      return queued(async () => {
        const [current, receipt] = await Promise.all([required(), receiptOf(id)]);
        // A refund prints automatically when recorded, so any later copy is a reprint and is not recorded.
        const reprint = receipt.kind === "refund" || (await printedBefore(id));
        const record = receipt.kind === "refund" ? undefined : reprint ? "reprint" : "first";
        await send(current, context, { kind: "receipt", saleId: id, record }, (printer) =>
          printer.print(printReceipt(receipt, current, reprint, false)),
        );
      });
    },
    testPrint: () =>
      job("test", (printer, { printer: { model, connection }, paperMm }) =>
        printer.print(
          encodeTestPage(printerProfiles[model], paperMm, model, describeConnection(connection)),
        ),
      ),
    /** Prints an X or a Z; `names` names people the report knows only by id (the approver). */
    printReport: (report: XReport | ZReport, names: Record<string, string> = {}) =>
      job("report", (printer, current) =>
        printer.print(
          encodeShiftReport(report, {
            profile: printerProfiles[current.printer.model],
            paperMm: current.paperMm,
            names,
          }),
        ),
      ),
    openDrawer: () => job("drawer", kick),
  };
}
