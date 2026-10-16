import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createElement } from "react";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import satori from "satori";
import { receiptDocument } from "@shopper/core/receipts";
import { paper } from "@shopper/hardware";
import { ReceiptView } from "@shopper/hardware/receipt";
import { pngPdf, receiptFonts } from "@shopper/hardware/render";
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

/** Satori → resvg-wasm → PNG, and pdf-lib for PDF. Same React tree as the HTML/Electron path. */
export function boxRenderer(): Renderer {
  return {
    async receipt(json, options, format) {
      const receipt = v.parse(receiptDocument, json);
      const width = paper[options.paperMm].dots;
      const svg = await satori(createElement(ReceiptView, { receipt, ...options }), {
        width,
        fonts: receiptFonts,
      });
      await ready();
      const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
      return format === "png" ? png : pngPdf(png, options.paperMm);
    },
  };
}
