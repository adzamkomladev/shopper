// Basket operations over the host bridge. Scope and cashier come from the host configuration only; every reply is
// correlated by request id and a domain rejection is an error reply, never a closed connection.
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createHostFixture } from "../../../../support/till/host/fixture";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());

const productOf = (f: NonNullable<typeof fixture>) => f.config.references.products[0].id;

describe("till host basket bridge", () => {
  it("reads, adds, edits and removes draft lines for the configured cashier", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const host = await fixture.start();
    const empty = await host.request({ type: "readDraft" });
    expect(empty).toMatchObject({
      type: "result",
      kind: "draft",
      view: { draft: null, quote: { lines: [], totals: { gross: 0 }, changed: false } },
    });

    const added = await host.request({
      type: "add",
      expectedRevision: 0,
      productId: productOf(fixture),
    });
    expect(added).toMatchObject({
      type: "result",
      kind: "draft",
      view: {
        draft: { revision: 1, lines: [{ quantityThousandths: 1000 }] },
        quote: { totals: { gross: 12_000 } },
      },
    });
    const lineId = (added as { view: { draft: { lines: { id: string }[] } } }).view.draft.lines[0]!
      .id;

    const edited = await host.request({
      type: "setQuantity",
      expectedRevision: 1,
      lineId,
      quantityThousandths: 2_500,
    });
    expect(edited).toMatchObject({
      kind: "draft",
      view: { draft: { revision: 2, lines: [{ id: lineId, quantityThousandths: 2_500 }] } },
    });
    expect(edited).toMatchObject({ view: { quote: { totals: { gross: 30_000 } } } });

    const removed = await host.request({ type: "removeLine", expectedRevision: 2, lineId });
    expect(removed).toMatchObject({
      kind: "draft",
      view: { draft: { revision: 3, lines: [] }, quote: { totals: { gross: 0 } } },
    });
    expect(await host.request({ type: "readDraft" })).toMatchObject({
      view: { draft: { revision: 3, lines: [] } },
    });
    expect(await fixture.localSales()).toEqual([]);
    expect(await fixture.queued()).toEqual([]);
  });

  it("answers a stale revision or an unknown code with its TillError code and keeps serving", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const host = await fixture.start();
    const productId = productOf(fixture);
    await host.request({ type: "add", expectedRevision: 0, productId });

    const stale = await host.request({ type: "add", expectedRevision: 0, productId });
    expect(stale).toMatchObject({ type: "error", code: "REVISION_STALE" });
    const unknown = await host.request({ type: "add", expectedRevision: 1, code: "4000000000006" });
    expect(unknown).toMatchObject({ type: "error", code: "PRODUCT_UNKNOWN" });
    const quantity = await host.request({
      type: "add",
      expectedRevision: 1,
      code: "4000000000006",
      quantityThousandths: 2_000,
    });
    expect(quantity).toMatchObject({ type: "error", code: "QUANTITY_INVALID" });

    expect(await host.request({ type: "add", expectedRevision: 1, productId })).toMatchObject({
      kind: "draft",
      view: { draft: { revision: 2, lines: [{ quantityThousandths: 2_000 }] } },
    });
  });

  it("takes scope from the host and needs exactly one of a code or a product", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const host = await fixture.start();
    const scope = {
      orgId: fixture.config.identity.orgId,
      deviceId: fixture.config.identity.deviceId,
      branchId: fixture.config.identity.branchId,
      cashierId: fixture.config.session!.userId,
    };
    expect(await host.request({ type: "readDraft", scope })).toMatchObject({
      type: "error",
      code: "INVALID_MESSAGE",
    });
    expect(
      await host.request({
        type: "add",
        expectedRevision: 0,
        productId: productOf(fixture),
        scope,
      }),
    ).toMatchObject({ type: "error", code: "INVALID_MESSAGE" });
    for (const add of [{}, { code: "4000000000006", productId: productOf(fixture) }])
      expect(await host.request({ type: "add", expectedRevision: 0, ...add })).toMatchObject({
        type: "error",
        code: "INVALID_MESSAGE",
      });
  });

  it("refuses basket operations without a valid cashier session and writes nothing", async () => {
    fixture = await createHostFixture({ session: null });
    const signedOut = await fixture.start();
    for (const request of [
      { type: "readDraft" },
      { type: "add", expectedRevision: 0, productId: productOf(fixture) },
    ])
      expect(await signedOut.request(request)).toMatchObject({
        type: "error",
        code: "SESSION_REQUIRED",
      });
    await fixture.close();

    // The default fixture session expired on 1 January 2026.
    fixture = await createHostFixture();
    const expired = await fixture.start();
    expect(
      await expired.request({ type: "add", expectedRevision: 0, productId: productOf(fixture) }),
    ).toMatchObject({ type: "error", code: "session" });
    expect(await fixture.localSales()).toEqual([]);
  });
});
