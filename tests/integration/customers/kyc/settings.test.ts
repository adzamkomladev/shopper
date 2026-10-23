// Org KYC settings: GET/PUT /settings/kyc { idRequired, idTypes }, managed with customer.manage.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { allAuditRows, as, db, expectChainValid } from "../../../support/kyc/world";
import { context } from "../../catalogue/support";

const types = ["ghana_card", "passport", "voter_id", "drivers_licence"];
const orgRow = async () =>
  (await db.select().from(schema.org).where(eq(schema.org.id, context.orgId)))[0]!;

test("by default an ID is not required and all four ID types are accepted", async () => {
  const read = await as("accountant").settings();
  expect(read.status).toBe(200);
  expect(read.body.idRequired).toBe(false);
  expect(read.body.idTypes).toHaveLength(4);
  expect(read.body.idTypes).toEqual(expect.arrayContaining(types));
});

test("reading and writing the settings need customer.manage", async () => {
  expect((await as("cashier").settings()).status).toBe(403);
  expect((await as("cashier").setSettings({ idRequired: true, idTypes: types })).status).toBe(403);
  expect((await as("inventory").settings()).status).toBe(403);
  expect((await as("no-session").settings()).status).toBe(401);
  expect((await as("admin").settings()).status).toBe(200);
  expect((await orgRow()).kycIdRequired).toBe(false);
});

test("a PUT stores the setting, answers with it, audits it and is read back", async () => {
  const before = (await allAuditRows()).filter((row) => row.command === "kyc.settings.set").length;
  const put = await as("accountant").setSettings({
    idRequired: true,
    idTypes: ["ghana_card", "passport"],
  });
  expect(put.status).toBe(200);
  expect(put.body).toMatchObject({ idRequired: true, idTypes: ["ghana_card", "passport"] });
  expect(await orgRow()).toMatchObject({
    kycIdRequired: true,
    kycIdTypes: ["ghana_card", "passport"],
  });
  expect((await as("admin").settings()).body).toMatchObject({
    idRequired: true,
    idTypes: ["ghana_card", "passport"],
  });
  const audit = (await allAuditRows()).filter((row) => row.command === "kyc.settings.set");
  expect(audit).toHaveLength(before + 1);
  await expectChainValid();

  const off = await as("accountant").setSettings({ idRequired: false, idTypes: types });
  expect(off.status).toBe(200);
  expect((await orgRow()).kycIdRequired).toBe(false);
});

test("invalid settings are refused with 400 and change nothing", async () => {
  const stored = async () => JSON.stringify((await as("admin").settings()).body);
  const before = await stored();
  for (const body of [
    { idRequired: true, idTypes: [] },
    { idRequired: true, idTypes: ["nin"] },
    { idRequired: false, idTypes: ["nin"] },
    { idRequired: "yes", idTypes: types },
    { idRequired: true, idTypes: "ghana_card" },
  ]) {
    expect((await as("accountant").setSettings(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(await stored()).toBe(before);
});
