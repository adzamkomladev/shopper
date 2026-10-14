import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Browser requests share one IP; a quiet window prevents shifted server windows from overlapping groups.
// Persist the count because Playwright may restart its worker.
const LIMIT = 3;
// The request leaves the browser a little after this is called, so the window gets some slack.
const WINDOW_MS = 10_000 + 3_000;
const COUNT_FILE = "tests/e2e/.auth/public-requests.json";

/** Call right before every request that posts to /onboarding or /invitations/:id/accept. */
export async function waitForPublicSlot(requests = 1) {
  const { count, start } = existsSync(COUNT_FILE)
    ? (JSON.parse(readFileSync(COUNT_FILE, "utf8")) as { count: number; start: number })
    : { count: 0, start: 0 };
  const open = Date.now() - start < WINDOW_MS;
  if (open && count + requests > LIMIT)
    await new Promise((resolve) => setTimeout(resolve, start + WINDOW_MS - Date.now()));
  const stillOpen = Date.now() - start < WINDOW_MS;
  mkdirSync(dirname(COUNT_FILE), { recursive: true });
  writeFileSync(
    COUNT_FILE,
    JSON.stringify({ count: stillOpen ? count + requests : requests, start: Date.now() }),
  );
}
