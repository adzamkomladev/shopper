import { expect, test, type Page, type Request } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading } from "../../../support/payments/screens";

// First boot of a box with no shop. The box's answers are replayed; the integration tests drive the real API.
test.describe.configure({ timeout: 120_000 });

const request = "eyJtYWNoaW5lIjoiYWJjZGVmIiwia2V5IjoiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoifQ";
const pending = (enforced: boolean) => ({
  needsInstall: true,
  licence: enforced ? { enforced, request } : { enforced },
});
const created = {
  orgId: "019a5e2c-7d1b-7c3e-9f2a-8b4d6e1f0a37",
  shopCode: "esi-mart",
  email: "esi@example.com",
};
const licenceText = '{"format":"lic/1","site":"Osu"}';

async function box(
  page: Page,
  state: { status: number; json: unknown },
  install: { status: number; json: unknown } = { status: 201, json: created },
) {
  const posts: Request[] = [];
  await page.route(
    (url) => url.pathname === "/api/install",
    (route) => {
      if (route.request().method() === "POST") {
        posts.push(route.request());
        return route.fulfill(install);
      }
      return route.fulfill(state);
    },
  );
  return posts;
}
const next = (page: Page, name: string | RegExp = "Continue") =>
  page.getByRole("button", { name }).click();

test("a box with a licence is set up in four steps, with the licence last", async ({
  page,
}, info) => {
  const posts = await box(page, { status: 200, json: pending(true) });
  await page.goto("/install");
  await expect(heading(page, "Setup code")).toBeVisible();
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  // The first field has focus, and Enter moves on.
  await expect(page.getByLabel("Setup code")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Enter the 12-character code")).toBeVisible();
  await shoot(page, info, "install-code-error", { sizes: SIZES });
  await page.getByLabel("Setup code").fill("k7m2-q9xp-4hwr");
  await page.keyboard.press("Enter");

  await expect(heading(page, "Your shop")).toBeVisible();
  await page.getByLabel("Shop name").fill("Esi Mart");
  // The shop code follows the name until it is edited.
  await expect(page.getByLabel("Shop code")).toHaveValue("esi-mart");
  await page.getByLabel("First store").fill("Osu");
  await shoot(page, info, "install-shop", { sizes: SIZES });
  await page.keyboard.press("Enter");

  await expect(heading(page, "Your account")).toBeVisible();
  await page.getByLabel("Owner's name").fill("Esi Mensah");
  await page.getByLabel("Email").fill("esi@example.com");
  await page.getByLabel("Password").fill("short");
  await next(page);
  await expect(page.getByText("Use at least 12 characters")).toBeVisible();
  await page.getByLabel("Password").fill("a long enough passphrase");
  await shoot(page, info, "install-owner", { sizes: SIZES });
  await next(page);

  await expect(heading(page, "Licence")).toBeVisible();
  await expect(page.getByText(request)).toBeVisible();
  await page.getByLabel("Licence").fill("not json");
  await next(page, "Install");
  await expect(page.getByText("Paste the whole contents of licence.json")).toBeVisible();
  await shoot(page, info, "install-licence-error", { sizes: SIZES });
  await page.getByLabel("Licence").fill(licenceText);
  await next(page, "Install");

  await expect(heading(page, "All set")).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]!.postDataJSON()).toEqual({
    code: "k7m2-q9xp-4hwr",
    shop: { name: "Esi Mart", code: "esi-mart" },
    store: { name: "Osu" },
    owner: { name: "Esi Mensah", email: "esi@example.com", password: "a long enough passphrase" },
    licence: JSON.parse(licenceText),
  });
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await shoot(page, info, "install-done", { sizes: SIZES });
});

test("a wrong setup code sends the person back to the first step with the reason", async ({
  page,
}) => {
  await box(
    page,
    { status: 200, json: pending(false) },
    {
      status: 403,
      json: { error: "That setup code is not right" },
    },
  );
  await page.goto("/install");
  await page.getByLabel("Setup code").fill("AAAA-BBBB-CCCC");
  await next(page);
  await page.getByLabel("Shop name").fill("Esi Mart");
  await page.getByLabel("First store").fill("Osu");
  await next(page);
  // Without a licence to check, the account step is the last: three steps.
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await page.getByLabel("Owner's name").fill("Esi Mensah");
  await page.getByLabel("Email").fill("esi@example.com");
  await page.getByLabel("Password").fill("a long enough passphrase");
  await next(page, "Install");
  await expect(heading(page, "Setup code")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("That setup code is not right");
  await page.getByRole("button", { name: "Back" }).waitFor({ state: "detached" });
});

test("Back keeps what was typed, and a box that is already set up goes to log in", async ({
  page,
}) => {
  await box(page, { status: 200, json: pending(false) });
  await page.goto("/install");
  await page.getByLabel("Setup code").fill("AAAA-BBBB-CCCC");
  await next(page);
  await page.getByLabel("Shop name").fill("Esi Mart");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Setup code")).toHaveValue("AAAA-BBBB-CCCC");
  await page.unroute(() => true).catch(() => undefined);
  await box(page, { status: 404, json: { error: "Not found" } });
  await page.goto("/install");
  await expect(page).toHaveURL(/\/login/);
});
