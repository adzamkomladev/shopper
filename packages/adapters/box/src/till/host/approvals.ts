import { verifyPin } from "@shopper/auth/devices";
import { approve, hostTime, readApprovers, TillError } from "@shopper/core/till";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { Approval } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";
import { auditContext } from "./receipts";

/** Manager approvals on this register: the host checks the PIN, so only a verified approver id reaches core. */
export function createApprovals(host: { database: TillDatabase; config: HostConfiguration }) {
  const { database, config } = host;
  const { identity } = config;
  return {
    /** Who could approve `permission`, as names and ids only. */
    async list(permission: string) {
      if (!config.session) throw new TillError("session", "Sign in on this register first");
      const at = await hostTime(database, identity, new Date());
      return readApprovers(database, identity.orgId, permission, at);
    },
    /** The verified approver id, or undefined when the request carries no approval. */
    async verify(approval: Approval | undefined, permission: string) {
      if (!approval) return undefined;
      if (!config.session) throw new TillError("session", "Sign in on this register first");
      const at = await hostTime(database, identity, new Date());
      return approve(
        database,
        auditContext(config),
        { approverId: approval.approverId.toLowerCase(), pin: approval.pin, permission, at },
        verifyPin,
      );
    },
  };
}
