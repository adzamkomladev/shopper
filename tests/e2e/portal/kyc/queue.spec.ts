import { expect, test, type Page } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { ghanaCard, seedCase } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. Cases are written to the database as the workflow leaves them.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const tab = (page: Page, name: string) => page.getByRole("tab", { name });

test("sorts checks into Awaiting approval, Open and Closed, and the keyboard moves between them", async ({
  page,
  request,
}, info) => {
  const waiting = await seedCase(request, { id: ghanaCard() });
  const open = await seedCase(request, { status: "id_needed" });
  const closed = await seedCase(request, { status: "approved" });
  await page.goto("/kyc");
  await expect(heading(page, "Identity checks")).toBeVisible();
  await expect(tab(page, "Awaiting approval")).toHaveAttribute("aria-selected", "true");
  const rows = page.getByRole("region", { name: "Identity checks" });
  const waitingRow = rows.getByRole("row", { name: new RegExp(waiting.phone) });
  await expect(waitingRow).toContainText("GH₵ 500.00");
  await expect(waitingRow).toContainText("Ghana Card");
  await expect(rows).not.toContainText(open.phone);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "kyc-queue");

  await tab(page, "Open").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/segment=open/);
  await expect(rows.getByRole("row", { name: new RegExp(open.phone) })).toContainText(
    "Waiting for the ID",
  );
  await tab(page, "Closed").focus();
  await page.keyboard.press("Enter");
  await expect(rows.getByRole("row", { name: new RegExp(closed.phone) })).toContainText("Approved");
  await expect(rows).not.toContainText(waiting.phone);
});

test("an empty segment says what it is for and offers the next step", async ({ page }, info) => {
  await page.route("**/api/kyc", (route) => route.fulfill({ json: { items: [] } }));
  await page.goto("/kyc");
  await expect(heading(page, "Nothing is waiting for approval", 2)).toBeVisible();
  await expect(page.getByRole("button", { name: /Start check/ })).toBeVisible();
  await shoot(page, info, "kyc-queue-empty", { sizes: [[1440, 900]] });
});

test("a slow queue shows a skeleton shaped like the page", async ({ page, request }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const check = await seedCase(request);
  await page.goto(`/kyc/${check.id}`);
  await expect(page.getByRole("link", { name: "Back to identity checks" })).toBeVisible();
  await page.route("**/api/kyc", async (route) => {
    await gate;
    return route.fallback();
  });
  await page.getByRole("link", { name: "Back to identity checks" }).click();
  try {
    await expect(
      page.getByRole("main").getByRole("status", { name: "Loading identity checks" }),
    ).toBeVisible();
    await shoot(page, info, "kyc-queue-loading", { sizes: [[1440, 900]] });
  } finally {
    release();
  }
  await expect(heading(page, "Identity checks")).toBeVisible();
});

test("when the server can't be reached the queue says so and Try again recovers", async ({
  page,
}, info) => {
  let failures = 1;
  await page.route("**/api/kyc", (route) =>
    failures-- > 0 ? route.abort("failed") : route.fallback(),
  );
  await page.goto("/kyc");
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await shoot(page, info, "kyc-queue-error", { sizes: [[1440, 900]] });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(heading(page, "Identity checks")).toBeVisible();
});

test("offline, the queue stays and says starting a check waits for a connection", async ({
  page,
  context,
}, info) => {
  await page.goto("/kyc");
  await expect(heading(page, "Identity checks")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("main").getByRole("status")).toContainText(/offline/i);
  await expect(page.getByRole("button", { name: /Start check/ })).toBeDisabled();
  await shoot(page, info, "kyc-queue-offline", { sizes: [[1440, 900]] });
  await context.setOffline(false);
});

test("a cashier is told the queue needs permission", async ({ page, request }, info) => {
  const cashier = await createStaff(request, "cashier", "Kyc");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/kyc");
  await expect(heading(page, "You don't have permission")).toBeVisible();
  await shoot(page, info, "kyc-queue-no-permission", { sizes: [[1440, 900]] });
});
