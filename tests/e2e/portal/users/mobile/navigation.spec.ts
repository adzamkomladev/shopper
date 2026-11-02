import { expect, test, type Locator } from "@playwright/test";
import { captureSizes } from "../../../../support/admin";
import { expectNoSeriousAxe } from "../../../../support/e2e";

// Every page the owner may open, one link each in the sidebar.
const PAGES = 20;

test("main navigation stays on screen and keyboard reachable at phone and tablet widths", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  // On a phone the sidebar is a sheet behind the header's toggle.
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = page.getByRole("dialog", { name: "Main" });
  const sheetLinks = sheet.getByRole("link");
  await expect(sheetLinks).toHaveCount(PAGES);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await expectAllInView(sheetLinks);
  // Reports, then the Sales section button, then its first page.
  await sheetLinks.nth(0).focus();
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: "Sales" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sheetLinks.nth(1)).toBeFocused();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");

  const navigation = page.getByRole("navigation", { name: "Main" });
  const links = navigation.getByRole("link");
  await page.setViewportSize({ width: 960, height: 768 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(960);
  await expectAllInView(links);
  await expectNavControlsSeparated(navigation, links);
  await expectNoSeriousAxe(page);
  const tabletPath = info.outputPath("main-navigation-960x768.png");
  await page.screenshot({ path: tabletPath, fullPage: true });
  await info.attach("main-navigation-960x768", { path: tabletPath, contentType: "image/png" });

  await captureSizes(page, info, "main-navigation", async () => {
    const width = await page.evaluate(() => window.innerWidth);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    // Below md the sidebar is the sheet checked above.
    if (width >= 768) await expectAllInView(links);
    if (width >= 768) await expectNavControlsSeparated(navigation, links);
    await expectNoSeriousAxe(page);
  });
});

/** Each link can be brought on screen: the sidebar scrolls on its own when the page list is taller than it. */
async function expectAllInView(links: Locator) {
  for (const link of await links.all()) {
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport();
  }
}

async function expectNavControlsSeparated(navigation: Locator, links: Locator) {
  const shop = navigation.getByRole("combobox", { name: /^Shop:/ });
  const user = navigation.getByRole("button", { name: "E2E Owner" });
  // expectAllInView leaves the list scrolled to its end, under the fixed shop picker.
  await links.first().scrollIntoViewIfNeeded();
  const boxes = await Promise.all(
    [shop, links.first(), user].map((control) => control.boundingBox()),
  );
  expect(boxes.every((box) => box !== null)).toBe(true);
  const rectangles = boxes.filter((box): box is NonNullable<typeof box> => box !== null);
  for (let left = 0; left < rectangles.length; left += 1) {
    for (let right = left + 1; right < rectangles.length; right += 1) {
      const a = rectangles[left];
      const b = rectangles[right];
      const separate =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(separate, "shop, first link and user control don't overlap").toBe(true);
    }
  }
}
