import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls } from "../sale/harness";
import {
  openDetail,
  openReturn,
  quantity,
  refundButton,
  returnScreen,
  startReturn,
  toast,
} from "./harness";

const line = (n: number) => `10000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const refunds = async (page: Page) => (await calls(page, "refund")).map((call) => call.args[0]);

test("a partial return is recorded with the keyboard alone", async ({ page }) => {
  await openDetail(page, "return");
  await expect(startReturn(page)).toHaveAttribute("aria-keyshortcuts", "Alt+E");
  await expect(page.getByText("Return eligible until Nov 14, 2026")).toBeVisible();
  await page.keyboard.press("Alt+E");
  await expect(returnScreen(page)).toBeVisible();
  await expect(quantity(page, "Milo 400g tin")).toBeFocused();

  await page.keyboard.type("1");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0.25");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Customer changed their mind");
  await page.keyboard.press("Alt+1");
  await expect(page.getByRole("button", { name: /^Cash/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Refund summary" })).toContainText("GH₵ 76.00");
  await expect(refundButton(page)).toContainText("Refund GH₵ 76.00");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("ControlOrMeta+Enter");

  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
  await expect(toast(page)).toContainText("Refund of GH₵ 76.00 recorded");
  expect(await refunds(page)).toEqual([
    {
      lines: [
        { lineId: line(20), quantityThousandths: 1000 },
        { lineId: line(21), quantityThousandths: 2000 },
        { lineId: line(22), quantityThousandths: 250 },
      ],
      reason: "Customer changed their mind",
      tender: { kind: "cash" },
    },
  ]);
  const totals = page.getByRole("region", { name: "Order total" });
  await expect(totals).toContainText("Refunds");
  await expect(totals).toContainText("−GH₵ 76.00");
  await expect(page.getByRole("region", { name: "Return eligibility" })).toContainText(
    "Pending upload",
  );
});

test("Escape leaves the return screen for the detail, and the quantity is capped", async ({
  page,
}) => {
  await openReturn(page);
  await page.keyboard.type("9");
  await expect(quantity(page, "Milo 400g tin")).toHaveValue("1");
  await expect(page.getByText("Only 1 left to return")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(returnScreen(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
  expect(await refunds(page)).toEqual([]);
});

test("a card refund needs its reference, and Alt+3 chooses mobile money", async ({ page }) => {
  await openReturn(page);
  await page.keyboard.type("1");
  await page.getByRole("textbox", { name: "Reason" }).fill("Damaged");
  await page.keyboard.press("Alt+2");
  const reference = page.getByRole("textbox", { name: "Card reference" });
  await expect(reference).toBeVisible();
  await expect(refundButton(page)).toBeDisabled();
  await reference.fill("AUTH-4471");
  await expect(refundButton(page)).toBeEnabled();
  await page.keyboard.press("Alt+3");
  await expect(page.getByRole("textbox", { name: "MoMo reference" })).toHaveValue("");
  await page.getByRole("textbox", { name: "MoMo reference" }).fill("MP2210");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
  expect((await refunds(page))[0]).toMatchObject({
    tender: { kind: "momo", reference: "MP2210" },
  });
});

test("a manager and PIN are asked for when the policy needs them, keyboard only", async ({
  page,
}) => {
  await openReturn(page, "return-approval");
  await page.keyboard.type("1");
  await page.getByRole("textbox", { name: "Reason" }).fill("Wrong size");
  await page.keyboard.press("Alt+1");
  await expect(returnScreen(page)).toContainText("A manager must approve this return.");
  await expect(refundButton(page)).toBeDisabled();
  const manager = page.getByRole("combobox", { name: "Manager" });
  await manager.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(manager).toContainText("Kofi Mensah");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0000");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("alert")).toHaveText("Wrong PIN. 4 tries left");
  await expect(page.getByLabel("Manager PIN")).toBeFocused();
  await page.keyboard.type("4321");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
  expect((await refunds(page)).at(-1)).toMatchObject({
    approval: { approverId: line(20), pin: "4321" },
  });
});

test("a sale outside the window says so and needs a manager", async ({ page }) => {
  await openDetail(page, "return-window");
  await expect(page.getByText("Return window closed Sep 14, 2026")).toBeVisible();
  await page.keyboard.press("Alt+E");
  await expect(returnScreen(page)).toContainText("The return window closed on Sep 14, 2026");
  await expect(page.getByRole("combobox", { name: "Manager" })).toBeVisible();
});

test("without the refund permission Start return is disabled and says why", async ({ page }) => {
  await openDetail(page, "return-nopermission");
  await expect(startReturn(page)).toBeDisabled();
  await expect(startReturn(page)).toHaveAccessibleDescription(
    "Your role cannot refund. Ask a manager.",
  );
  await expect(page.getByRole("region", { name: "Return eligibility" })).toContainText(
    "Your role cannot refund. Ask a manager.",
  );
  await page.keyboard.press("Alt+E");
  await expect(toast(page)).toContainText("Your role cannot refund. Ask a manager.");
  await expect(returnScreen(page)).toHaveCount(0);
  await expectNoSeriousAxe(page);
});

test("a server rejection stays on the return screen with the entries kept", async ({ page }) => {
  await openReturn(page, "return-rejected");
  await page.keyboard.type("1");
  await page.getByRole("textbox", { name: "Reason" }).fill("Damaged");
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("ControlOrMeta+Enter");
  const alert = returnScreen(page).getByRole("alert");
  await expect(alert).toHaveText(
    "Another register refunded this line first. Check the purchase and try again.",
  );
  await expect(quantity(page, "Milo 400g tin")).toHaveValue("1");
  await expect(refundButton(page)).toBeEnabled();
  await expectNoSeriousAxe(page);
});
