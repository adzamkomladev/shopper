import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import { card, openProduct } from "../../../support/catalogue";
import { shoot } from "../../../support/customers/shots";

// Screenshots and axe at five sizes take a while on a busy runner.
test.describe.configure({ timeout: 180_000 });

// The product's photo for the online store, on the saved owner session: chosen by keyboard, sent straight to
// storage, shown from a short link, refused when it is not a photo, then removed.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("the owner adds, replaces and removes a product photo", async ({ page, request }, info) => {
  const product = await openProduct(page, request, "Shito");
  const photo = card(page, "Photo");
  await expect(photo).toContainText("No photo yet");

  await page.getByRole("heading", { level: 1 }).focus();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("i");
  await (await chooser).setFiles({ name: "shito.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Photo saved")).toBeVisible();
  await expect(photo.getByRole("img", { name: `Photo of ${product.name}` })).toBeVisible();
  await expect(photo.getByRole("button", { name: "Replace photo" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "product-photo");

  // A document is turned away before anything is uploaded.
  const second = page.waitForEvent("filechooser");
  await photo.getByRole("button", { name: "Replace photo" }).click();
  await (
    await second
  ).setFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(photo.getByText("Choose a JPEG, PNG or WebP photo.")).toBeVisible();

  await photo.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Photo removed")).toBeVisible();
  await expect(photo).toContainText("No photo yet");
});
