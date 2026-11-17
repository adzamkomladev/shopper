import { expect, test, type Page, type Request } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading } from "../../../support/payments/screens";

// Day 43: first boot on a box installed with a cloud shop's archive. The box's answers are replayed; the integration
// tests drive the real import.
test.describe.configure({ timeout: 120_000 });

const request = "eyJtYWNoaW5lIjoiYWJjZGVmIiwia2V5IjoiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoifQ";
const state = {
  needsInstall: true,
  licence: { enforced: true, request },
  import: { shop: "Kofi Mart" },
};
const licenceText = '{"format":"lic/1","site":"Kofi Mart"}';
const agreed = {
  shop: "Kofi Mart",
  ok: true,
  tables: [{ table: "sale", cloud: { rows: 10 }, box: { rows: 10 }, ok: true }],
  days: [{ day: "2026-11-16", ok: true }],
};

async function box(page: Page, answers: { status: number; json: unknown }[]) {
  const posts: Request[] = [];
  await page.route(
    (url) => url.pathname === "/api/install",
    (route) => route.fulfill({ json: state }),
  );
  await page.route(
    (url) => url.pathname === "/api/install/import",
    (route) => {
      posts.push(route.request());
      return route.fulfill(answers[Math.min(posts.length, answers.length) - 1]!);
    },
  );
  return posts;
}

test("a box installed with an archive takes the shop over with the setup code and the cloud's licence", async ({
  page,
}, info) => {
  const posts = await box(page, [
    { status: 403, json: { error: "That setup code is not right" } },
    {
      status: 200,
      json: {
        ...agreed,
        ok: false,
        tables: [{ table: "sale", cloud: { rows: 10 }, box: { rows: 9 }, ok: false }],
      },
    },
    { status: 200, json: agreed },
  ]);
  await page.goto("/install");
  await expect(heading(page, "Move Kofi Mart here")).toBeVisible();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await shoot(page, info, "import-code", { sizes: SIZES });
  await page.getByLabel("Setup code").fill("k7m2-q9xp-4hwr");
  await page.keyboard.press("Enter");

  await expect(heading(page, "Licence")).toBeVisible();
  await expect(page.getByText(request)).toBeVisible();
  await page.getByLabel("Licence").fill(licenceText);
  const move = page.getByRole("button", { name: "Move Kofi Mart here" });
  await move.click();
  // A wrong code goes back to the first step, which says so.
  await expect(page.getByText("That setup code is not right")).toBeVisible();
  await expect(heading(page, "Move Kofi Mart here")).toBeVisible();
  await expect(page.getByLabel("Setup code")).toHaveValue("k7m2-q9xp-4hwr");
  await page.getByLabel("Setup code").fill("K7M2-Q9XP-4HWT");
  await page.keyboard.press("Enter");
  // The licence pasted before is kept.
  await expect(page.getByLabel("Licence")).toHaveValue(licenceText);
  await move.click();
  await expect(page.getByRole("alert")).toContainText("The copies differ");
  await shoot(page, info, "import-mismatch", { sizes: SIZES });

  await move.click();
  await expect(heading(page, "All set")).toBeVisible();
  await expect(page.getByText("Kofi Mart runs on this box now")).toBeVisible();
  await shoot(page, info, "import-done", { sizes: SIZES });
  expect(posts.at(-1)!.postDataJSON()).toEqual({
    code: "K7M2-Q9XP-4HWT",
    licence: JSON.parse(licenceText),
  });
});
