// Catalogue search over the host bridge: replies echo their query so the screen can drop stale answers.
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createHostFixture } from "../../../../support/till/host/fixture";
import { connectBrowser } from "../../../../support/till/host/socket";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());

describe("till host catalogue search", () => {
  it("finds products by SKU and name and echoes the query", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const host = await fixture.start();
    const product = fixture.config.references.products[0];

    expect(await host.request({ type: "search", query: product.sku })).toMatchObject({
      type: "result",
      kind: "search",
      query: product.sku,
      matches: [{ productId: product.id, sku: product.sku, name: product.name, match: "sku" }],
    });
    expect(await host.request({ type: "search", query: "milk" })).toMatchObject({
      query: "milk",
      matches: [{ productId: product.id, match: "name" }],
    });
    expect(await host.request({ type: "search", query: "sardines" })).toMatchObject({
      query: "sardines",
      matches: [],
    });
  });

  it("serves search to the browser socket, answers concurrent queries by id and rejects oversized ones", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const host = await fixture.start();
    const browser = await connectBrowser(host.ready);
    const [first, second] = await Promise.all([
      browser.ask({ type: "search", query: "mi" }),
      browser.ask({ type: "search", query: "milk" }),
    ]);
    expect(first).toMatchObject({ type: "result", kind: "search", query: "mi" });
    expect(second).toMatchObject({ type: "result", kind: "search", query: "milk" });

    expect(await browser.ask({ type: "search", query: "x".repeat(201) })).toMatchObject({
      type: "error",
      code: "INVALID_MESSAGE",
    });
    expect(browser.open).toBe(true);
    browser.socket.close();
  });
});
