declare const SHOPPER_VERSION: string;
declare const GIT_SHA: string;
declare const BUILD_DATE: string;
declare const SCHEMA_VERSION: number;
declare const SYNC_PROTOCOL: number;
declare const ARCHIVE_FORMAT: number;

export const buildInfo = Object.freeze({
  version: SHOPPER_VERSION,
  gitSha: GIT_SHA,
  buildDate: BUILD_DATE,
  schemaVersion: SCHEMA_VERSION,
  syncProtocol: SYNC_PROTOCOL,
  archiveFormat: ARCHIVE_FORMAT,
});
