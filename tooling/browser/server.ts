import { createServer, type IncomingMessage } from "node:http";
import { chromium } from "@playwright/test";

type Screenshot = {
  html: string;
  viewport: { width: number; height: number };
  screenshotOptions?: { fullPage?: boolean; omitBackground?: boolean };
};

/** Stand-in for Browser Run's `screenshot` quick action, backed by local Playwright Chromium. */
export async function startBrowserFake({ port = 0 } = {}) {
  const browser = await chromium.launch();
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/screenshot") {
      response.writeHead(404).end();
      return;
    }
    try {
      const { html, viewport, screenshotOptions } = JSON.parse(
        await readBody(request),
      ) as Screenshot;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        await page.setContent(html);
        const png = await page.screenshot({ type: "png", ...screenshotOptions });
        response.writeHead(200, { "content-type": "image/png" }).end(png);
      } finally {
        await context.close();
      }
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  const stop = async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await browser.close();
  };
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Browser fake has no port");
    return { baseUrl: `http://127.0.0.1:${address.port}`, stop };
  } catch (error) {
    await browser.close(); // never orphan Chromium: it would keep the test process alive
    throw error;
  }
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
