import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createElement, type ReactElement } from "react";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import satori from "satori";
import { receiptDocument } from "@shopper/core/receipts";
import { statementDocument } from "@shopper/core/schemas";
import { paper } from "@shopper/hardware";
import { ReceiptView } from "@shopper/hardware/receipt";
import { StatementView, STATEMENT_WIDTH } from "@shopper/hardware/statement";
import {
  A4_HEIGHT_POINTS,
  A4_POINTS,
  pngPage,
  pngPdf,
  receiptFonts,
} from "@shopper/hardware/render";
import type { Renderer } from "@shopper/ports";
import * as v from "valibot";

// ponytail: reads the wasm from node_modules; the sealed Bun binary (Day 37) must embed it.
let wasm: Promise<void> | undefined;
const ready = () =>
  (wasm ??= readFile(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"))
    .then((bytes) => initWasm(bytes))
    .catch((error: unknown) => {
      wasm = undefined; // let the next render retry instead of failing until restart
      throw error;
    }));

async function png(element: ReactElement, width: number) {
  const svg = await satori(element, { width, fonts: receiptFonts });
  await ready();
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

/** Satori → resvg-wasm → PNG, and pdf-lib for PDF. Same React tree as the HTML/Electron path. */
export function boxRenderer(): Renderer {
  return {
    async receipt(json, options, format) {
      const receipt = v.parse(receiptDocument, json);
      const image = await png(
        createElement(ReceiptView, { receipt, ...options }),
        paper[options.paperMm].dots,
      );
      return format === "png" ? image : pngPdf(image, options.paperMm);
    },
    async statement(json) {
      const statement = v.parse(statementDocument, json);
      return pngPage(
        await png(createElement(StatementView, { statement }), STATEMENT_WIDTH),
        A4_POINTS,
        A4_HEIGHT_POINTS,
      );
    },
  };
}
