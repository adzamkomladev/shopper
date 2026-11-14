/**
 * What a Shopper Archive leaves out. Every table with an `org_id` is exported unless it is named here, so a new table
 * is in the archive by default; the coverage test fails when a name below no longer exists.
 */
export const EXCLUDED_TABLES: Record<string, string> = {
  session: "Back-office sign-in sessions are live credentials.",
  verification: "One-time sign-in codes.",
  session_key:
    "The secret that signs cashier sessions. A move to the cloud carries it on its own signed channel.",
  cashier_pin:
    "PIN hashes. A move to the cloud carries them on its own signed channel, never in the file.",
  device_credential: "Register credentials. Registers relocate with a one-time code after a move.",
  device_enrollment: "One-time register enrolment codes.",
  enrollment_attempt: "Register enrolment lockout counters.",
  shop_login: "One-time shopper sign-in links.",
  shop_session: "Live shopper sessions.",
  shopper_meta: "The deployment's own bookkeeping, not the business's.",
  archive_key: "The key archives are signed with; it never leaves the database.",
  export_job: "The archives' own bookkeeping.",
  archive_import: "The cloud's record of a box moving in, with credentials in transit.",
  cloud_move: "The box's record of moving to the cloud.",
};

/** Columns dropped from tables that are otherwise exported: secrets and tokens, never business data. */
export const HIDDEN_COLUMNS: Record<string, string[]> = {
  account: ["password", "access_token", "refresh_token", "id_token"],
  invitation: ["token_digest"],
  online_order: ["view_token_digest"],
  registration_request: ["verification_digest"],
  kyc_case: ["otp_digest"],
  // Sales, refunds and shifts name the session they were made in; the session moves, its token never does.
  cashier_session: ["token_hash"],
};

/** Blobs an archive carries: files people uploaded. Receipt PDFs and sync snapshots are rebuilt from table rows. */
export const ARCHIVED_ASSET_PURPOSES = ["product_image", "kyb_document"] as const;

/** The largest blob an archive will hold in memory while it is measured. */
export const MAX_BLOB_BYTES = 64 * 1024 * 1024;
