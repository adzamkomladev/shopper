// Day 34: filling one order. Busy answers are replayed for each status; the buttons' calls are checked against what the
// API is sent, and the keyboard path (scan, found all, finish) works without the mouse.
import { expect, test, type Page } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { expectNoSeriousAxe } from "../../../support/e2e";
import { ORDER_ID, staffOrder } from "../../../support/orders/busy";

test.describe.configure({ timeout: 180_000 });

/** Serves the order in `state.status` and moves it on when a step is posted. */
async function serve(page: Page, state: { status: string; calls: string[] }) {
  const next: Record<string, string> = {
    accept: "accepted",
    start: "picking",
    ready: "ready",
    handover: "completed",
    decline: "refunded",
    cancel: "refunded",
  };
  const picked = new Set<string>();
  const body = () => {
    const order = staffOrder(state.status);
    return {
      ...order,
      lines: order.lines.map((line) =>
        picked.has(line.id)
          ? { ...line, pick: { outcome: "picked", pickedThousandths: line.quantityThousandths } }
          : line,
      ),
    };
  };
  await page.route(
    (url) => url.pathname.startsWith(`/api/orders/${ORDER_ID}`),
    async (route) => {
      const url = new URL(route.request().url());
      const step = url.pathname.split("/").pop()!;
      if (route.request().method() === "PUT") {
        picked.add(url.pathname.split("/").pop()!);
        state.calls.push(`pick ${JSON.stringify(route.request().postDataJSON())}`);
      } else if (route.request().method() === "POST") {
        state.calls.push(step);
        state.status = next[step] ?? state.status;
      }
      await route.fulfill({ json: body() });
    },
  );
}
const open = async (page: Page, status: string) => {
  const state = { status, calls: [] as string[] };
  await serve(page, state);
  await page.goto(`/orders/${ORDER_ID}`);
  await expect(page.getByRole("heading", { name: "Order #1004", level: 1 })).toBeVisible();
  return state;
};

test("a new order is accepted from the keyboard and moves to being picked", async ({
  page,
}, info) => {
  const state = await open(page, "paid");
  await expect(page.getByRole("button", { name: /Accept order/ })).toBeVisible();
  await expect(page.getByText("Ama Mensah")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Frytol oil 1L" })).toBeVisible();
  await shoot(page, info, "orders-new");
  await page.keyboard.press("a");
  await expect(page.getByRole("button", { name: /Start picking/ })).toBeVisible();
  await page.keyboard.press("s");
  await expect(page.getByRole("button", { name: /Finish picking/ })).toBeDisabled();
  expect(state.calls).toEqual(["accept", "start"]);
});

test("picking: scan an item, tick the others, then finish after a confirmation", async ({
  page,
}, info) => {
  const state = await open(page, "picking");
  await expect(page.getByText("Check every item before you finish.")).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.getByLabel("Scan an item")).toBeFocused();
  await page.keyboard.type("6001234567891");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Frytol oil 1L ticked off" }),
  ).toBeVisible();
  await page.keyboard.type("0000000000000");
  await page.keyboard.press("Enter");
  await expect(page.getByText("0000000000000 is not on this order")).toBeVisible();
  const tick = page.getByRole("listitem").filter({ hasText: "Jasmine rice" });
  await tick.getByRole("button", { name: "Found all" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Milo tin 400g" })
    .getByRole("button", { name: "Found all" })
    .click();
  await expect(page.getByRole("button", { name: /Finish picking/ })).toBeEnabled();
  await shoot(page, info, "orders-picking");
  await page.getByRole("button", { name: /Finish picking/ }).click();
  await expect(page.getByRole("dialog", { name: "Finish picking?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("f");
  await page.getByRole("button", { name: "Finish picking" }).last().click();
  await expect(page.getByRole("button", { name: /Mark handed over/ })).toBeVisible();
  expect(state.calls.filter((call) => call === "ready")).toHaveLength(1);
  expect(state.calls.filter((call) => call.startsWith("pick"))).toHaveLength(3);
});

test("a short item can be recorded with how much was found", async ({ page }) => {
  const state = await open(page, "picking");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Jasmine rice" })
    .getByRole("button", { name: "Short or substitute…" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/Found/)).toBeVisible();
  await dialog.getByLabel(/Found/).fill("1");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.calls).toEqual([`pick {"pickedThousandths":1000}`]);
});

test("declining and cancelling ask first and hand over ends the order", async ({ page }) => {
  const declined = await open(page, "paid");
  await page.getByRole("button", { name: /^Decline/ }).click();
  await expect(page.getByRole("dialog", { name: "Decline this order?" })).toBeVisible();
  await page.getByRole("button", { name: "Decline order" }).click();
  await expect(page.getByText("This order has ended.")).toBeVisible();
  expect(declined.calls).toEqual(["decline"]);

  const ready = await open(page, "ready");
  await page.getByRole("button", { name: /Mark handed over/ }).click();
  await expect(page.getByText("This order was handed over.")).toBeVisible();
  expect(ready.calls).toEqual(["handover"]);
  await expectNoSeriousAxe(page);
});

test("a changed order shows what the shopper pays now", async ({ page }, info) => {
  const state = { status: "ready", calls: [] as string[] };
  await page.route(
    (url) => url.pathname.startsWith(`/api/orders/${ORDER_ID}`),
    (route) =>
      route.fulfill({
        json: staffOrder("ready", {
          fulfilledGross: 77_5000,
          adjustment: { beforeGross: 87_5000, afterGross: 77_5000, refundAmount: 10_0000 },
        }),
      }),
  );
  await page.goto(`/orders/${ORDER_ID}`);
  await expect(page.getByText(/This order was changed in picking/)).toBeVisible();
  await shoot(page, info, "orders-changed");
  expect(state.calls).toEqual([]);
});

test("a pick that is refused says why and the order is read again", async ({ page }) => {
  await open(page, "picking");
  await page.unroute((url) => url.pathname.startsWith(`/api/orders/${ORDER_ID}`));
  await page.route(
    (url) => url.pathname.startsWith(`/api/orders/${ORDER_ID}`),
    (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 409, json: { error: "This order is not being picked." } })
        : route.fulfill({ json: staffOrder("picking") }),
  );
  await page
    .getByRole("listitem")
    .filter({ hasText: "Jasmine rice" })
    .getByRole("button", { name: "Found all" })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "not being picked" })).toBeVisible();
});
