import { expect, test, type ConsoleMessage, type Page, type Request } from "@playwright/test";
import { post, unique } from "../../../support/admin";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// v1.5 Day 47: the Online store settings page. Categories are real (E2E Mart through the API); the box-only Online
// Orders card is drawn from replayed `/settings/online` answers, since the e2e box has no licence to publish with.
test.describe.configure({ timeout: 180_000 });

const settings = { box: false, onlineOrders: false, buffer: 0, publishedAt: null, error: null };
const category = (page: Page, name: string) =>
  page.getByRole("switch", { name: new RegExp(`^${name}`) });
const watch = (page: Page) => {
  const errors: ConsoleMessage[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message));
  return errors;
};

test("a department and its categories each switch on and off online, from the keyboard", async ({
  page,
  request,
}, info) => {
  const errors = watch(page);
  const tag = unique();
  const department = await post<{ id: string }>(request, "/categories", { name: `Pantry ${tag}` });
  await post(request, "/categories", { name: `Rice ${tag}`, parentId: department.id });

  await page.goto("/settings/online");
  await expect(heading(page, "Online store")).toBeVisible();
  // Not a box: there is no Online Orders switch to show.
  await expect(page.getByRole("switch", { name: "Sell online from this box" })).toHaveCount(0);
  await expect(category(page, `Pantry ${tag}`)).toBeChecked();
  await expect(category(page, `Rice ${tag}`)).toBeChecked();

  await category(page, `Pantry ${tag}`).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText(`Pantry ${tag} is hidden online`)).toBeVisible();
  await expect(category(page, `Pantry ${tag}`)).not.toBeChecked();
  // The category under it says why it is not shown, though its own switch is still on.
  await expect(page.getByText("Hidden with its department")).toBeVisible();
  await shoot(page, info, "settings-online-categories", { sizes: SIZES });

  await page.reload();
  await expect(category(page, `Pantry ${tag}`)).not.toBeChecked();
  await category(page, `Pantry ${tag}`).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText(`Pantry ${tag} is online`)).toBeVisible();
  await expect(category(page, `Pantry ${tag}`)).toBeChecked();
  expect(errors.map((message) => message.text())).toEqual([]);
});

test("on a box the Online Orders switch shows how the last update went", async ({ page }, info) => {
  const errors = watch(page);
  const sent: Request[] = [];
  await replay(
    page,
    "/settings/online",
    { ...settings, box: true, onlineOrders: true, publishedAt: "2026-11-24T09:41:00.000Z" },
    sent,
  );
  await page.goto("/settings/online");
  const toggle = page.getByRole("switch", { name: "Sell online from this box" });
  await expect(toggle).toBeChecked();
  await expect(page.getByText("The online store was last updated 24 Nov, 09:41.")).toBeVisible();
  await shoot(page, info, "settings-online-published", { sizes: SIZES });

  await page.unroute("**/*");
  await replay(page, "/settings/online", {
    ...settings,
    box: true,
    onlineOrders: true,
    error: "Online Orders is not switched on for this shop",
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Online Orders is not switched on for this shop",
  );
  await shoot(page, info, "settings-online-error", { sizes: SIZES });

  // Switching off sends just the switch, and the page shows what the API answers.
  await page.unroute("**/*");
  await replay(page, "/settings/online", { ...settings, box: true, onlineOrders: true }, sent);
  await page.reload();
  await expect(page.getByText("Sending your catalogue to the online store")).toBeVisible();
  await page.unroute("**/*");
  await replay(page, "/settings/online", { ...settings, box: true }, sent);
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Online Orders is off")).toBeVisible();
  await expect(toggle).not.toBeChecked();
  const put = sent.find((request) => request.method() === "PUT");
  expect(put?.postDataJSON()).toEqual({ onlineOrders: false });
  expect(errors.map((message) => message.text())).toEqual([]);
});

test("on a box the units kept back from the online store save from the keyboard", async ({
  page,
}, info) => {
  const errors = watch(page);
  const sent: Request[] = [];
  const on = {
    ...settings,
    box: true,
    onlineOrders: true,
    publishedAt: "2026-11-26T09:41:00.000Z",
  };
  await replay(page, "/settings/online", on, sent);
  await page.goto("/settings/online");
  const field = page.getByLabel("Keep back from the online store");
  await expect(field).toHaveValue("0");
  await field.fill("-1");
  await page.keyboard.press("Control+Enter");
  await expect(
    page.getByText("Enter a whole number, like 2, or 0 to keep nothing back"),
  ).toBeVisible();
  await expect(field).toBeFocused();
  await shoot(page, info, "settings-online-buffer-invalid", { sizes: SIZES });

  await page.unroute("**/*");
  await replay(page, "/settings/online", { ...on, buffer: 3 }, sent);
  await field.fill("3");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("The online store now keeps back 3 of every product")).toBeVisible();
  const put = sent.find((request) => request.method() === "PUT");
  expect(put?.postDataJSON()).toEqual({ onlineOrders: true, buffer: 3 });
  await shoot(page, info, "settings-online-buffer", { sizes: SIZES });
  // Switched off, there is nothing to keep back.
  await page.unroute("**/*");
  await replay(page, "/settings/online", { ...settings, box: true });
  await page.reload();
  await expect(page.getByRole("switch", { name: "Sell online from this box" })).not.toBeChecked();
  await expect(field).toHaveCount(0);
  expect(errors.map((message) => message.text())).toEqual([]);
});

test("with no categories yet the page says what to do", async ({ page }, info) => {
  await replay(page, "/categories", []);
  await page.goto("/settings/online");
  await expect(page.getByText("No categories yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to products" })).toBeVisible();
  await shoot(page, info, "settings-online-empty", { sizes: SIZES });
});
