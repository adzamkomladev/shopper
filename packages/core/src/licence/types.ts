import type { Licence } from "./schemas/base";

/** Why a licence does not count: none on disk, not lic/1, not the issuer's, another machine, or 60 days unconfirmed. */
export type LicenceReason = "missing" | "unreadable" | "forged" | "machine" | "expired";

export type LicenceStatus = {
  state: "valid" | "grace" | "locked";
  reason?: LicenceReason;
  licence?: Licence;
  checkedInAt?: string;
  locksAt?: string;
};
