import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReceiptDocument } from "@shopper/core/receipts";
import type { StatementDocument } from "@shopper/core/schemas";
import { ReceiptView } from "../receipt/view";
import { paper } from "../profiles";
import { STATEMENT_WIDTH, StatementView } from "../statement/view";
import type { PaperMm } from "../types";
import { fontFaceCss } from "./fonts";

const page = (width: number, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss}*{box-sizing:border-box}body{margin:0;width:${width}px}</style></head><body>${body}</body></html>`;

/** Full HTML document for Electron/browser printing; same tree as the PNG. */
export function receiptHtml(
  receipt: ReceiptDocument,
  options: { paperMm: PaperMm; reprint: boolean },
) {
  return page(
    paper[options.paperMm].dots,
    renderToStaticMarkup(createElement(ReceiptView, { receipt, ...options })),
  );
}

/** Full HTML document for the cloud screenshot of a statement; same tree as the box PNG. */
export function statementHtml(statement: StatementDocument) {
  return page(STATEMENT_WIDTH, renderToStaticMarkup(createElement(StatementView, { statement })));
}
