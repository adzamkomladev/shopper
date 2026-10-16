import { receiptDocument } from "@shopper/core/receipts";
import { paper } from "@shopper/hardware";
import { pngPdf, receiptHtml } from "@shopper/hardware/render";
import type { Renderer } from "@shopper/ports";
import * as v from "valibot";

export class RendererError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Browser Run screenshot failed with status ${status}: ${detail.slice(0, 500)}`);
  }
}

type Browser = Pick<BrowserRun, "quickAction">;

/** Browser Run screenshot of the shared receipt HTML; PDF wraps the PNG like the box renderer. */
export function cloudflareRenderer(browser: Browser): Renderer {
  return {
    async receipt(json, options, format) {
      const receipt = v.parse(receiptDocument, json);
      const response = await browser.quickAction("screenshot", {
        html: receiptHtml(receipt, options),
        viewport: { width: paper[options.paperMm].dots, height: 100 },
        screenshotOptions: { fullPage: true, omitBackground: false },
        setJavaScriptEnabled: false,
      });
      if (!response.ok) throw new RendererError(response.status, await response.text());
      const png = new Uint8Array(await response.arrayBuffer());
      return format === "png" ? png : pngPdf(png, options.paperMm);
    },
  };
}
