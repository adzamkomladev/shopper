import { expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { provisionTillReference, recordLocalSale } from "@shopper/core/till";
import { createPushFixture } from "../../../support/till/push";
import {
  appVersion,
  context,
  devices,
  principal,
  syncProtocol,
} from "../../../support/till/server";
import { config, ids, references } from "../../../support/till/sales";
import { tillFile } from "../../../support/till/pull";

test("enrollment codes number offline sales before the first handshake and refill normal numbers", async () => {
  const fixture = await createPushFixture();
  const till = await tillFile();
  try {
    const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
    const enrolled = await devices.enroll({
      orgId: context.orgId,
      code: challenge.code,
      name: "Offline start till",
    });
    const login = await devices.login({
      deviceId: enrolled.deviceId,
      deviceToken: enrolled.deviceToken,
      userId: principal.userId,
      pin: "1357",
    });
    const session = {
      id: login.id,
      orgId: context.orgId,
      deviceId: enrolled.deviceId,
      branchId: ids.branch,
      userId: principal.userId,
      roleName: login.roleName,
      issuedAt: login.issuedAt.toISOString(),
      expiresAt: login.expiresAt.toISOString(),
      permissions: login.permissions,
      proof: login.token,
    };
    const localConfig = {
      ...config,
      deviceId: enrolled.deviceId,
      receiptCodes: enrolled.receiptCodes,
      now: () => new Date(),
    };
    await provisionTillReference(
      till.database,
      { ...context, deviceId: enrolled.deviceId },
      references,
    );
    const record = () =>
      recordLocalSale(till.database, localConfig, session, {
        lines: [{ productId: ids.product, quantityThousandths: 1000 }],
      });
    const first = await record();
    const second = await record();
    expect(first.sale.receiptNumber).toMatch(/^BR\d+-T\d+-X000001$/);
    expect(second.sale.receiptNumber).toMatch(/-X000002$/);
    expect(first.sale.receiptOverflow).toBe(true);
    const worker = createPushWorker({
      database: till.database,
      config: {
        orgId: context.orgId,
        deviceId: enrolled.deviceId,
        deviceToken: enrolled.deviceToken,
        protocol: syncProtocol,
        appVersion,
        upstream: fixture.upstream.url,
      },
    });
    fixture.worker = worker;
    await worker.trigger();
    expect(worker.getStatus()).toMatchObject({
      server: "online",
      pendingCount: 0,
      blockedCount: 0,
    });
    const normal = await record();
    expect(normal.sale.receiptNumber).toMatch(/-000001$/);
    expect(normal.sale.receiptOverflow).toBe(false);
  } finally {
    await fixture.close();
    await till.close();
  }
});

test("a new till without enrollment codes refuses the sale and preserves an empty queue", async () => {
  const { hostConfiguration } = await import("../../../support/till/server");
  const { localSale, outbox } = await import("@shopper/db-sqlite");
  const till = await tillFile();
  try {
    const host = await hostConfiguration("unused", [], undefined, { freshSession: true });
    if (!host.session) throw new Error("Expected cashier session");
    await provisionTillReference(
      till.database,
      { ...context, deviceId: host.identity.deviceId },
      references,
    );
    await expect(
      recordLocalSale(
        till.database,
        {
          orgId: context.orgId,
          deviceId: host.identity.deviceId,
          branchId: ids.branch,
          storeId: config.storeId,
          appVersion,
        },
        host.session,
        { lines: [{ productId: ids.product, quantityThousandths: 1000 }] },
      ),
    ).rejects.toMatchObject({ code: "reference" });
    expect(await till.database.read((tx) => tx.select().from(localSale))).toHaveLength(0);
    expect(await till.database.read((tx) => tx.select().from(outbox))).toHaveLength(0);
  } finally {
    await till.close();
  }
});
