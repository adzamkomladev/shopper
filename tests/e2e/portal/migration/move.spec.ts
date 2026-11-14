import { expect, test, type Page, type Request } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// Day 42: Move to cloud on a box, as E2E Mart's owner. The portal under test is the cloud, so the box is played by
// replaying its answers: a licence on /billing/status says "box", and /migration/move walks the move's states.
test.describe.configure({ timeout: 180_000 });

const CLOUD = "https://cloud.shopper.test";
const licence = { state: "valid" };
const registers = [
  { id: "0197a000-0000-7000-8000-0000000000a1", name: "Till 1", deliveredAt: null },
  { id: "0197a000-0000-7000-8000-0000000000a2", name: "Till 2", deliveredAt: null },
];
const move = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "0197a000-0000-7000-8000-0000000000b1",
  status,
  cloudUrl: CLOUD,
  error: null,
  startedAt: "2026-11-14T18:00:00.000Z",
  completedAt: null,
  ...extra,
});

async function onBox(page: Page, state: unknown, seen: Request[] = []) {
  await replay(page, "/billing/status", { readOnly: false, licence, move: null });
  await page.route(
    (url) => url.pathname.endsWith("/api/migration/move"),
    (route) => {
      if (route.request().method() === "POST") {
        seen.push(route.request());
        return route.fulfill({ status: 202, json: { id: move("sealing").id } });
      }
      return route.fulfill({ json: state });
    },
  );
}

test("an owner on a box starts the move from the keyboard, after typing MOVE", async ({
  page,
}, info) => {
  const seen: Request[] = [];
  await onBox(page, { move: null, registers }, seen);
  await page.goto("/products");
  await page.getByRole("link", { name: "Move to cloud" }).click();
  await expect(heading(page, "Move to cloud")).toBeVisible();
  await expect(page.getByText("Till 2")).toBeVisible();

  // M opens the move; the confirm stays off until the address and the word are right.
  await page.keyboard.press("m");
  const dialog = page.getByRole("dialog", { name: "Move this shop to the cloud?" });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Move now" });
  await dialog.getByLabel("Cloud address").fill("http://cloud.shopper.test");
  await dialog.getByLabel("Type MOVE to confirm").fill("MOVE");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Cloud address").fill(CLOUD);
  await expect(confirm).toBeEnabled();
  await shoot(page, info, "move-confirm", { sizes: SIZES });
  await page.keyboard.press("Control+Enter");
  await expect(dialog).toBeHidden();
  expect(seen).toHaveLength(1);
  expect(seen[0]!.postDataJSON()).toEqual({ cloudUrl: CLOUD });
  await shoot(page, info, "move-ready", { sizes: SIZES });
});

test("the move shows where it is, then which registers have followed it", async ({
  page,
}, info) => {
  await onBox(page, { move: move("uploading"), registers });
  await page.goto("/migration/move");
  const steps = page.getByRole("list", { name: "Steps" });
  await expect(steps.getByRole("listitem").filter({ hasText: "Sending" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByRole("button", { name: "Move to cloud" })).toHaveCount(0);
  await shoot(page, info, "move-uploading", { sizes: SIZES });

  await page.unrouteAll();
  await onBox(page, {
    move: move("moved", { completedAt: "2026-11-14T18:20:00.000Z" }),
    registers: [{ ...registers[0]!, deliveredAt: "2026-11-14T18:21:00.000Z" }, registers[1]],
  });
  await page.reload();
  await expect(page.getByText(`This shop now runs in the cloud at ${CLOUD}`)).toBeVisible();
  const tills = page.getByRole("list", { name: "Registers" });
  await expect(tills.getByRole("listitem").filter({ hasText: "Till 1" })).toContainText("Moved");
  await expect(tills.getByRole("listitem").filter({ hasText: "Till 2" })).toContainText(
    "Waiting for it to connect",
  );
  await shoot(page, info, "move-moved", { sizes: SIZES });
});

test("a failed move says why and can be tried again", async ({ page }, info) => {
  await onBox(page, {
    move: move("failed", { error: "The cloud refused the archive (403)." }),
    registers,
  });
  await page.goto("/migration/move");
  await expect(page.getByRole("alert")).toContainText("The cloud refused the archive (403).");
  await page.getByRole("button", { name: "Try again" }).click();
  const dialog = page.getByRole("dialog", { name: "Move this shop to the cloud?" });
  await expect(dialog.getByLabel("Cloud address")).toHaveValue(CLOUD);
  await shoot(page, info, "move-failed", { sizes: SIZES });
});

test("a move the cloud never confirmed keeps the box read-only and offers no retry", async ({
  page,
}) => {
  await onBox(page, {
    move: move("importing", { error: "The cloud did not confirm the move (reset)." }),
    registers,
  });
  await page.goto("/migration/move");
  await expect(page.getByRole("alert")).toContainText("The move is waiting on the cloud");
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("once moving, every page says the box is read-only", async ({ page }, info) => {
  await replay(page, "/billing/status", { readOnly: false, licence, move: move("importing") });
  await page.goto("/products");
  const banner = page.getByRole("status").filter({ hasText: "moving to the cloud" });
  await expect(banner).toBeVisible();
  await banner.getByRole("link", { name: "See the move" }).click();
  await expect(heading(page, "Move to cloud")).toBeVisible();
  await shoot(page, info, "move-banner", { sizes: SIZES });
});

test("the cloud has no move: the link is not offered", async ({ page }) => {
  await page.goto("/products");
  await expect(heading(page, /Products/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Move to cloud" })).toHaveCount(0);
});
