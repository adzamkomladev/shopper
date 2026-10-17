import { afterEach, expect, test } from "vite-plus/test";
import { register } from "../../../support/hardware/register";

type DisplayMessage = { type: "display"; bounds: Record<string, number> | null };
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

/** Starts the register and resolves with the first `display` message main sends once the till is open. */
async function firstDisplay() {
  const { start } = await register(cleanup);
  const child = await start([], {});
  return new Promise<DisplayMessage>((resolve, reject) => {
    child.on(
      "message",
      (message: DisplayMessage) => message.type === "display" && resolve(message),
    );
    child.once("close", () => reject(new Error("Electron exited before opening the till")));
  });
}

// Two monitors can't be faked on Xvfb 21.1 (Chromium sees one display); the till PC checks it (windows-handoff.md).
test("with one monitor no display window opens", async () => {
  expect((await firstDisplay()).bounds).toBeNull();
}, 120_000);
