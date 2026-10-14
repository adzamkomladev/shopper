import { afterEach, expect, test } from "vite-plus/test";
import { createHostFixture } from "../../support/till/host/fixture";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());

test("the host reports offline pull and receipt status without exposing credentials", async () => {
  fixture = await createHostFixture({ upstream: "http://127.0.0.1:1" });
  const host = await fixture.start();
  const result = await host.request({ type: "status" });
  expect(result.status).toMatchObject({
    mode: "offline",
    cursor: "0",
    head: null,
    lastPullAt: null,
    receiptsLeft: 0,
    overflow: false,
    syncing: false,
  });
  expect(JSON.stringify(result)).not.toContain(fixture.config.deviceToken);
});
