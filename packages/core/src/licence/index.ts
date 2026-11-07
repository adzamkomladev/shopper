export { generateKey, publicKeyOf } from "./keys";
export {
  confirmLicence,
  GRACE_AFTER_DAYS,
  issueLicence,
  licenceStatus,
  LOCK_AFTER_DAYS,
} from "./licence";
export { signedRequest, verifySignedRequest } from "./requests";
export { confirmation, licence, type Confirmation, type Licence } from "./schemas/base";
export type { LicenceReason, LicenceStatus } from "./types";
