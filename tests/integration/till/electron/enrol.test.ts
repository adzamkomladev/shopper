import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { v7 } from "uuid";
import { afterEach, expect, test } from "vite-plus/test";
import { buildInfo } from "@shopper/config";
import { api, context, devices, principal } from "../../../support/till/server";
import { ids } from "../../../support/till/sales";
import { healthy, register } from "../../../support/hardware/register";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

// A fresh install has no identity or token. Its page enrols through the bridge; the register stores the
// registration, seals the token out of register.json and restarts the host as an enrolled till.
test("an unenrolled register enrols from its page, seals the token and boots enrolled", async () => {
  const { userData, port, start, directory } = await register(cleanup);
  const configPath = join(userData, "register.json");
  const installed = JSON.parse(await readFile(configPath, "utf8"));
  const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
  await writeFile(join(directory, "ui", "index.html"), enrolPage(challenge.code));
  await writeFile(
    configPath,
    JSON.stringify({
      sqlitePath: installed.sqlitePath,
      upstream: api.url,
      origins: [`http://127.0.0.1:${port}`],
      ui: installed.ui,
      port,
    }),
  );
  await start();
  await healthy(port);
  const stored = await waitFor(async () => {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    return config.identity && !("deviceToken" in config) ? config : undefined;
  });
  expect(stored.identity).toMatchObject({ orgId: context.orgId, registerName: "Electron till" });
  const sealed = await readFile(join(userData, "register.secret"));
  expect(sealed.length).toBeGreaterThan(0);
  // The enrolled host answers on the same port.
  await healthy(port);
}, 180_000);

/** A page that does what the till UI does: hello with the capability from the fragment, then device.enrol. */
function enrolPage(code: string) {
  const [hello, enrol] = [JSON.stringify(v7()), JSON.stringify(v7())];
  return `<title>till</title><script>
const capability = location.hash.slice(1);
const socket = new WebSocket("ws://" + location.host + "/bridge");
socket.onopen = () => socket.send(JSON.stringify({ id: ${hello}, type: "hello", capability, appVersion: ${JSON.stringify(buildInfo.version)}, protocol: ${buildInfo.syncProtocol} }));
socket.onmessage = (event) => {
  if (JSON.parse(event.data).id !== ${hello}) return;
  socket.send(JSON.stringify({ id: ${enrol}, type: "device.enrol", shopCode: "sync-shop", code: ${JSON.stringify(code)}, name: "Electron till" }));
};
</script>`;
}

async function waitFor<T>(read: () => Promise<T | undefined>) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const value = await read().catch(() => undefined);
    if (value) return value;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("The register never stored its enrolment");
}
