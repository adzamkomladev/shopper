// Shared by the Day 23 management specs: the review sizes, the screenshot names and the page heading.
import type { Page, Request } from "@playwright/test";

export const SIZES = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
] as const;
export const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 });
/** Replays one API path's answer, recording each request it answers. */
export const replay = (page: Page, path: string, json: unknown, seen: Request[] = []) =>
  page.route(
    (url) => url.pathname.endsWith(`/api${path}`),
    (route) => {
      seen.push(route.request());
      return route.fulfill({ json });
    },
  );
