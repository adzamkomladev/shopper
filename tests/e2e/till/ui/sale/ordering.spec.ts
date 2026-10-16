import { expect, test, type TestInfo } from "@playwright/test";
import { v7 } from "uuid";
import { startSaleScenario } from "../../../../support/till/sale/scenario";

test("a newer draft broadcast is not replaced by its older delayed command reply", async ({
  page,
}, testInfo) => {
  const scenario = await startSaleScenario(appOrigin(testInfo));
  let observePush!: () => void;
  let observeReply!: () => void;
  const pushSeen = new Promise<void>((resolve) => (observePush = resolve));
  const oldReplyDelivered = new Promise<void>((resolve) => (observeReply = resolve));
  await page.routeWebSocket(
    (url) => new URL(url).pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      let firstRequestId: string | undefined;
      let secondId: string | undefined;
      let pendingOldReply: string | undefined;
      route.onMessage((raw) => {
        const request = JSON.parse(String(raw)) as { id: string; type: string };
        if (request.type === "tender.add" && !firstRequestId && !secondId)
          firstRequestId = request.id;
        host.send(raw);
      });
      host.onMessage((raw) => {
        const reply = JSON.parse(String(raw)) as {
          id?: string;
          type?: string;
          kind?: string;
          view?: { draft?: { revision: number } };
        };
        if (reply.id === firstRequestId && reply.type === "result" && reply.kind === "draft") {
          const draft = reply.view?.draft;
          if (!draft) throw new Error("Tender reply must include its draft view");
          pendingOldReply = String(raw);
          firstRequestId = undefined;
          secondId = v7();
          host.send(
            JSON.stringify({
              id: secondId,
              type: "tender.add",
              expectedRevision: draft.revision,
              kind: "cash",
              amount: 10_000,
            }),
          );
          return;
        }
        if (reply.id === secondId && reply.type === "result" && reply.kind === "draft") {
          route.send(JSON.stringify({ type: "draft", view: reply.view }));
          observePush();
          const delayed = pendingOldReply;
          pendingOldReply = undefined;
          secondId = undefined;
          if (delayed)
            setTimeout(() => {
              route.send(delayed);
              observeReply();
            }, 300);
          return;
        }
        route.send(raw);
      });
    },
  );
  try {
    await page.goto(scenario.url);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await page.keyboard.press("s");
    await page.getByRole("heading", { name: "Sale", exact: true }).waitFor();
    const scan = page.getByRole("combobox", { name: "Scan barcode or search items" });
    await scan.fill("MILO-400");
    await page.getByRole("option", { name: /Milo 400g tin/ }).click();
    // Typed amounts reset when the draft revision moves, so type only once the line has settled.
    await expect(page.getByRole("list", { name: "Basket lines" })).toContainText("Milo 400g tin");
    const amount = page.getByRole("textbox", { name: "Amount tendered" });
    await expect(amount).toHaveValue("425.00");
    await amount.fill("100.00");
    await expect(amount).toHaveValue("100.00");
    await page.getByRole("button", { name: "Split" }).click();

    const tender = page.getByRole("region", { name: "Tender" });
    await pushSeen;
    await expect(tender).toContainText("Received GH₵ 101.00");
    await oldReplyDelivered;
    await expect(tender).toContainText("Received GH₵ 101.00");
  } finally {
    await scenario.stop();
  }
});

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
