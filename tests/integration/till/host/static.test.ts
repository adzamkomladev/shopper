import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createHostFixture } from "../../../support/till/host/fixture";
import { connectBrowser } from "../../../support/till/host/socket";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let ui: string | undefined;
afterEach(async () => {
  await fixture?.close();
  if (ui) await rm(ui, { recursive: true, force: true });
  fixture = ui = undefined;
});

async function startWithUi(backoffice = true) {
  ui = await mkdtemp(join(tmpdir(), "shopper-till-ui-"));
  await mkdir(join(ui, "assets"));
  await writeFile(join(ui, "index.html"), "<title>till</title>");
  await writeFile(join(ui, "assets/app.js"), "export {}");
  if (backoffice) {
    await mkdir(join(ui, "backoffice"));
    await writeFile(join(ui, "backoffice/index.html"), "<title>back office</title>");
  }
  fixture = await createHostFixture({ freshSession: true });
  return fixture.start({ ...fixture.config, ui, origins: ["https://register.example"] });
}

describe("till host static UI", () => {
  it("serves the built till UI and its own origin passes the bridge check", async () => {
    const host = await startWithUi();
    const base = `http://127.0.0.1:${host.ready.port}`;
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("<title>till</title>");
    expect(await (await fetch(`${base}/assets/app.js`)).text()).toBe("export {}");
    expect((await fetch(`${base}/health`)).status).toBe(200);
    const browser = await connectBrowser(host.ready, base);
    expect(browser.open).toBe(true);
    browser.socket.close();
  });

  it("falls back to index.html for deep links, and /backoffice/* to backoffice/index.html", async () => {
    const host = await startWithUi();
    const base = `http://127.0.0.1:${host.ready.port}`;
    expect(await (await fetch(`${base}/sales/123`)).text()).toBe("<title>till</title>");
    expect(await (await fetch(`${base}/backoffice/products/42`)).text()).toBe(
      "<title>back office</title>",
    );
  });

  it("refuses a request with a non-loopback Host header", async () => {
    const host = await startWithUi();
    const status = await new Promise<number>((resolve, reject) => {
      request(
        { host: "127.0.0.1", port: host.ready.port, path: "/", headers: { host: "evil.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      )
        .on("error", reject)
        .end();
    });
    expect(status).toBe(421);
  });
});
