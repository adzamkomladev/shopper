import { receiptDocument } from "@shopper/core/receipts";
import { statementDocument } from "@shopper/core/schemas";
import { paper } from "@shopper/hardware";
import { A4_POINTS, pngPage, pngPdf, receiptHtml, statementHtml } from "@shopper/hardware/render";
import { STATEMENT_WIDTH } from "@shopper/hardware/statement";
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

/** Browser Run screenshot of the shared HTML; PDF wraps the PNG like the box renderer. */
export function cloudflareRenderer(browser: Browser): Renderer {
  const screenshot = async (html: string, width: number) => {
    const response = await browser.quickAction("screenshot", {
      html,
      viewport: { width, height: 100 },
      screenshotOptions: { fullPage: true, omitBackground: false },
      setJavaScriptEnabled: false,
    });
    if (!response.ok) throw new RendererError(response.status, await response.text());
    return new Uint8Array(await response.arrayBuffer());
  };
  return {
    async receipt(json, options, format) {
      const receipt = v.parse(receiptDocument, json);
      const png = await screenshot(receiptHtml(receipt, options), paper[options.paperMm].dots);
      return format === "png" ? png : pngPdf(png, options.paperMm);
    },
    async statement(json) {
      const statement = v.parse(statementDocument, json);
      return pngPage(await screenshot(statementHtml(statement), STATEMENT_WIDTH), A4_POINTS);
    },
  };
}
