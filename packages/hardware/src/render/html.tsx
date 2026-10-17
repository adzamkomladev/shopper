import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReceiptDocument } from "@shopper/core/receipts";
import { ReceiptView } from "../receipt/view";
import { paper } from "../profiles";
import type { PaperMm } from "../types";
import { fontFaceCss } from "./fonts";

/** Full HTML document for Electron/browser printing; same tree as the PNG. */
export function receiptHtml(
  receipt: ReceiptDocument,
  options: { paperMm: PaperMm; reprint: boolean },
) {
  const body = renderToStaticMarkup(createElement(ReceiptView, { receipt, ...options }));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss}*{box-sizing:border-box}body{margin:0;width:${paper[options.paperMm].dots}px}</style></head><body>${body}</body></html>`;
}
