import { BrowserWindow } from "electron";
import { PDFDocument } from "pdf-lib";
import * as v from "valibot";
import { receiptDocument, type ReceiptDocument } from "@shopper/core/receipts";
import { paper } from "@shopper/hardware";
import { receiptHtml } from "@shopper/hardware/render";
import { renderRequest, type RenderReply, type RenderRequest } from "@shopper/hardware/schemas";

const MM_PER_INCH = 25.4;
const CSS_PX_PER_INCH = 96;
const PT_PER_INCH = 72;
const PAD_INCHES = 2 / PT_PER_INCH;
const RENDER_TIMEOUT_MS = 10_000;

// One render at a time, so a burst of requests cannot pile up hidden windows.
let queue: Promise<unknown> = Promise.resolve();

/** Answers one IPC message; never throws. Messages that are not render requests return undefined. */
export async function answerRender(message: unknown): Promise<RenderReply | undefined> {
  const request = v.safeParse(renderRequest, message);
  if (!request.success) {
    const id = (message as { id?: unknown } | null)?.id;
    const isRender = (message as { type?: unknown } | null)?.type === "render";
    return isRender && typeof id === "string"
      ? { type: "render-failed", id, message: "Invalid render request" }
      : undefined;
  }
  const { id } = request.output;
  try {
    const run = queue.then(() => renderReceipt(request.output));
    queue = run.catch(() => undefined);
    const bytes = await run;
    return { type: "rendered", id, data: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    return {
      type: "render-failed",
      id,
      message: error instanceof Error ? error.message : "Receipt rendering failed",
    };
  }
}

/**
 * Loads `receiptHtml` into a hidden, script-less window sized to the paper's dots (device scale
 * factor 1, set in main) and captures it: `capturePage` for PNG, `printToPDF` for PDF.
 */
export async function renderReceipt(request: RenderRequest): Promise<Uint8Array> {
  const receipt = v.parse(receiptDocument, request.receipt);
  const { dots } = paper[request.paperMm];
  const window = new BrowserWindow({
    show: false,
    width: dots,
    height: 100,
    useContentSize: true,
    webPreferences: {
      javascript: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  // A page that never loads or prints must not hold the queue.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Render timed out")), RENDER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([capture(window, request, receipt), timeout]);
  } finally {
    clearTimeout(timer);
    window.destroy();
  }
}

async function capture(window: BrowserWindow, request: RenderRequest, receipt: ReceiptDocument) {
  const { dots, mm } = paper[request.paperMm];
  const html = receiptHtml(receipt, { paperMm: request.paperMm, reprint: request.reprint });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const height = await contentHeight(window);
  if (request.format === "png") {
    window.setContentSize(dots, height);
    return (await window.webContents.capturePage({ x: 0, y: 0, width: dots, height })).toPNG();
  }
  // The page is laid out in CSS px at `dots` wide; scale it so 576 dots print exactly 72 mm.
  const widthInches = mm / MM_PER_INCH;
  const heightInches = (height / dots) * widthInches;
  const pdf = await window.webContents.printToPDF({
    // Chromium rounds a custom page size to its own grid (about 1 pt), so ask for a little more
    // and crop the media box back to the exact size below.
    pageSize: { width: widthInches + PAD_INCHES, height: heightInches + PAD_INCHES },
    scale: (widthInches * CSS_PX_PER_INCH) / dots,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    printBackground: true,
    preferCSSPageSize: false,
  });
  return cropPdf(pdf, widthInches * PT_PER_INCH, heightInches * PT_PER_INCH);
}

/** Content height in CSS px through the debugger, because scripts stay disabled in the window. */
async function contentHeight(window: BrowserWindow) {
  const { debugger: devtools } = window.webContents;
  devtools.attach("1.3");
  try {
    const metrics = (await devtools.sendCommand("Page.getLayoutMetrics")) as {
      cssContentSize: { height: number };
    };
    return Math.ceil(metrics.cssContentSize.height);
  } finally {
    devtools.detach();
  }
}

/** Keeps the top-left `width` x `height` pt, where Chromium anchors the content, and requires one page. */
async function cropPdf(pdf: Uint8Array, width: number, height: number) {
  const document = await PDFDocument.load(pdf);
  if (document.getPageCount() !== 1) throw new Error("Receipt did not fit one page");
  const page = document.getPage(0);
  const top = page.getSize().height;
  page.setMediaBox(0, top - height, width, height);
  page.setCropBox(0, top - height, width, height);
  return document.save();
}
