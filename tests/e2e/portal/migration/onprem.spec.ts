import { expect, test, type Page, type Request } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// Day 43: Move on-prem in the cloud, as E2E Mart's owner. /migration/onprem is replayed through the move's states;
// the integration tests drive the real routes.
test.describe.configure({ timeout: 180_000 });

const BOX = "https://shopper.local";
const registers = [
  { id: "0197a000-0000-7000-8000-0000000000a1", name: "Till 1", deliveredAt: null },
  { id: "0197a000-0000-7000-8000-0000000000a2", name: "Till 2", deliveredAt: null },
];
const licence = { format: "lic/1", id: "0197a000-0000-7000-8000-0000000000c1", site: "E2E Mart" };
const move = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "0197a000-0000-7000-8000-0000000000b1",
  status,
  archive: "ready",
  exportJobId: "0197a000-0000-7000-8000-0000000000d1",
  licence: null,
  boxUpstream: null,
  report: null,
  startedAt: "2026-11-17T18:00:00.000Z",
  completedAt: null,
  ...extra,
});
const report = {
  ok: false,
  tables: [
    { table: "product", cloud: { rows: 120 }, box: { rows: 120 }, ok: true },
    { table: "sale", cloud: { rows: 4210 }, box: { rows: 4209 }, ok: false },
  ],
  days: [{ day: "2026-11-16", ok: false }],
};

async function inCloud(page: Page, state: unknown, seen: Request[] = []) {
  await page.route(
    (url) => url.pathname.endsWith("/api/migration/onprem"),
    (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: state });
      seen.push(route.request());
      return route.request().method() === "POST"
        ? route.fulfill({ status: 202, json: { exportJobId: move("open").exportJobId } })
        : route.fulfill({ json: { moveId: move("open").id } });
    },
  );
  await page.route(
    (url) => url.pathname.endsWith("/api/migration/onprem/licence"),
    (route) => {
      seen.push(route.request());
      return route.fulfill({ status: 201, json: licence });
    },
  );
}

test("an owner in the cloud starts the move from the keyboard, after typing MOVE", async ({
  page,
}, info) => {
  const seen: Request[] = [];
  await inCloud(page, { move: null, registers }, seen);
  await page.goto("/products");
  await page.getByRole("link", { name: "Move on-prem" }).click();
  await expect(heading(page, "Move on-prem")).toBeVisible();
  await page.keyboard.press("m");
  const dialog = page.getByRole("dialog", { name: "Move this shop onto its own box?" });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Start the move" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type MOVE to confirm").fill("MOVE");
  await expect(confirm).toBeEnabled();
  await shoot(page, info, "onprem-confirm", { sizes: SIZES });
  await page.keyboard.press("Control+Enter");
  await expect(dialog).toBeHidden();
  expect(seen.map((request) => request.method())).toEqual(["POST"]);
  await shoot(page, info, "onprem-start", { sizes: SIZES });
});

test("the sealed archive is downloaded, and the box's licence issued from its request code", async ({
  page,
}, info) => {
  const seen: Request[] = [];
  await inCloud(page, { move: move("open", { archive: "running" }), registers }, seen);
  await page.goto("/migration/onprem");
  await expect(page.getByRole("status").filter({ hasText: "Sealing" })).toBeVisible();
  await shoot(page, info, "onprem-sealing", { sizes: SIZES });

  await page.unrouteAll();
  await inCloud(page, { move: move("open"), registers }, seen);
  await page.reload();
  await expect(page.getByText("--import archive.shopper")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download archive" })).toBeVisible();
  await page.getByLabel("Box's request code").fill("eyJtYWNoaW5lIjoiYWJjIn0");
  await page.getByRole("button", { name: "Issue licence" }).click();
  await expect(page.getByLabel("Licence for the box")).toContainText('"site": "E2E Mart"');
  expect(seen.at(-1)!.postDataJSON()).toEqual({ request: "eyJtYWNoaW5lIjoiYWJjIn0" });
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await shoot(page, info, "onprem-licence", { sizes: SIZES });
});

test("a report that disagrees names what differs, and the move can be called off", async ({
  page,
}, info) => {
  const seen: Request[] = [];
  await inCloud(
    page,
    { move: move("claimed", { licence, boxUpstream: BOX, report }), registers },
    seen,
  );
  await page.goto("/migration/onprem");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("The copies differ");
  await expect(alert.getByRole("row", { name: /sale/ })).toContainText("4209");
  await expect(alert.getByRole("row", { name: /product/ })).toHaveCount(0);
  await expect(alert).toContainText("16 Nov 2026");
  await shoot(page, info, "onprem-mismatch", { sizes: SIZES });

  await page.getByRole("button", { name: "Call the move off" }).click();
  const dialog = page.getByRole("dialog", { name: "Call the move off?" });
  await dialog.getByRole("button", { name: "Call it off" }).click();
  await expect(dialog).toBeHidden();
  expect(seen.map((request) => request.method())).toEqual(["DELETE"]);
});

test("once moved, the cloud copy only reads and the tills follow", async ({ page }, info) => {
  await replay(page, "/billing/status", { readOnly: false, licence: null, onPrem: "archived" });
  await inCloud(page, {
    move: move("archived", {
      licence,
      boxUpstream: BOX,
      report: { ...report, ok: true, tables: [report.tables[0]], days: [] },
      completedAt: "2026-11-17T19:10:00.000Z",
    }),
    registers: [{ ...registers[0]!, deliveredAt: "2026-11-17T19:12:00.000Z" }, registers[1]],
  });
  await page.goto("/products");
  const banner = page.getByRole("status").filter({ hasText: "moved to its own box" });
  await expect(banner).toBeVisible();
  await banner.getByRole("link", { name: "See the move" }).click();
  await expect(page.getByText(`This shop now runs on its box at ${BOX}`)).toBeVisible();
  const tills = page.getByRole("list", { name: "Registers" });
  await expect(tills.getByRole("listitem").filter({ hasText: "Till 1" })).toContainText("Moved");
  await expect(tills.getByRole("listitem").filter({ hasText: "Till 2" })).toContainText(
    "Waiting for it to connect",
  );
  await expect(page.getByRole("button", { name: "Move on-prem" })).toHaveCount(0);
  await shoot(page, info, "onprem-moved", { sizes: SIZES });
});

test("a box offers no move on-prem", async ({ page }) => {
  await replay(page, "/billing/status", { readOnly: false, licence: { state: "valid" } });
  await page.goto("/products");
  await expect(heading(page, /Products/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Move on-prem" })).toHaveCount(0);
});
