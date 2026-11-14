/** The workflow's business key: one per archive (the org id keeps it unique across tenants). */
export const exportArchiveId = (orgId: string, jobId: string) => `export-archive_${orgId}_${jobId}`;

/** Where an archive's parts live in the org's blobs. */
export const exportPrefix = (jobId: string) => `exports/${jobId}`;
