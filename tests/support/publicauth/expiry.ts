import { expect } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "../../../tooling/database/e2e";

/** Advance a disposable fixture's deadline; invitation fixtures can also persist expiry status. */
export async function expireLink(
  table: "registration_request" | "invitation",
  id: string,
  persistInvitationStatus = false,
) {
  if (persistInvitationStatus && table !== "invitation")
    throw new Error("Only invitation fixtures have a persisted expiry status");
  const target = new URL(E2E_DATABASE_URL);
  if (!/^[a-z0-9_]*_e2e$/.test(target.pathname.slice(1)))
    throw new Error("Link expiry fixtures require an *_e2e database");
  if (!process.env.CI && !["localhost", "127.0.0.1"].includes(target.hostname))
    throw new Error("Link expiry fixtures require a local database");
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const update = persistInvitationStatus
      ? "UPDATE invitation SET expires_at = now() - interval '1 second', status = 'expired' WHERE id = $1"
      : `UPDATE ${table} SET expires_at = now() - interval '1 second' WHERE id = $1`;
    const result = await client.query(update, [id]);
    expect(result.rowCount).toBe(1);
  } finally {
    await client.end();
  }
}
