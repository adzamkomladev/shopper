// Shopper issues a box's licence from the request code its Settings → Licence page shows.
import { expect, test } from "vite-plus/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v7 } from "uuid";
import { boxLicence } from "@shopper/box";
import { generateKey } from "@shopper/core/licence";
import { issueFromRequest } from "../../../../tooling/licence/issue";

test("a licence issued from the box's request code is valid on that box", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shopper-issue-"));
  try {
    await writeFile(join(dir, "machine-id"), "fedcba9876543210fedcba9876543210\n");
    const issuer = await generateKey();
    const box = boxLicence(
      { SHOPPER_LICENCE_DIR: dir, SHOPPER_MACHINE_ID_FILE: join(dir, "machine-id") },
      { issuer: issuer.publicKey },
    )!;
    const before = await box.status();
    expect(before).toMatchObject({ state: "locked", reason: "missing" });
    const licence = await issueFromRequest(issuer.privateKey, before.request, {
      org: v7(),
      site: "Kumasi branch",
      terminals: 4,
      maintenanceUntil: "2027-11-01",
    });
    await writeFile(join(dir, "licence.json"), JSON.stringify(licence));
    expect(await box.status()).toMatchObject({
      state: "valid",
      licence: { site: "Kumasi branch", terminals: 4 },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
