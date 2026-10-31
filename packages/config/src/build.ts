declare const SHOPPER_VERSION: string;
declare const GIT_SHA: string;
declare const BUILD_DATE: string;
declare const SCHEMA_VERSION: number;
declare const SYNC_PROTOCOL: number;
declare const ARCHIVE_FORMAT: number;
declare const TILL_DOWNLOAD_URL: string;
declare const TILL_UPDATE_URL: string;
declare const TILL_UPSTREAM: string;

export const buildInfo = Object.freeze({
  version: SHOPPER_VERSION,
  gitSha: GIT_SHA,
  buildDate: BUILD_DATE,
  schemaVersion: SCHEMA_VERSION,
  syncProtocol: SYNC_PROTOCOL,
  archiveFormat: ARCHIVE_FORMAT,
  tillDownloadUrl: TILL_DOWNLOAD_URL,
  tillUpdateUrl: TILL_UPDATE_URL,
  tillUpstream: TILL_UPSTREAM,
});
