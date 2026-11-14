import { boxArchiveExport } from "@shopper/adapters-box";

/** The box's archive workflow, with any archive the in-process engine forgot on restart started again from its row. */
export function bootArchiveExport(...args: Parameters<typeof boxArchiveExport>) {
  const archive = boxArchiveExport(...args);
  archive
    .relaunch()
    .catch((error: unknown) => console.error({ event: "export.relaunch_failed", error }));
  return archive;
}
