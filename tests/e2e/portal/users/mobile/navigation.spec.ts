import { expect, test, type Locator } from "@playwright/test";
import { captureSizes } from "../../../../support/admin";
import { expectNoSeriousAxe } from "../../../../support/e2e";

test("main navigation stays on screen and keyboard reachable at phone and tablet widths", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Main" });
  const links = navigation.getByRole("link");
  await expect(links).toHaveCount(14);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  for (const link of await links.all()) await expect(link).toBeInViewport();

  await links.nth(0).focus();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  await expectNoSeriousAxe(page);

  await page.setViewportSize({ width: 960, height: 768 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(960);
  for (const link of await links.all()) await expect(link).toBeInViewport();
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
    for (const link of await links.all()) await expect(link).toBeInViewport();
    await expectNavControlsSeparated(navigation, links);
    await expectNoSeriousAxe(page);
  });
});

async function expectNavControlsSeparated(navigation: Locator, links: Locator) {
  const shop = navigation.getByRole("combobox", { name: /^Shop:/ });
  const searchField = navigation.getByRole("textbox", { name: "Search" });
  const search = (await searchField.isVisible())
    ? searchField
    : navigation.getByRole("button", { name: "Search" });
  const user = navigation.getByRole("button", { name: "E2E Owner" });
  const boxes = await Promise.all(
    [shop, links.first(), search, user].map((control) => control.boundingBox()),
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
      expect(separate, "shop, first link, search and user control don't overlap").toBe(true);
    }
  }
}
