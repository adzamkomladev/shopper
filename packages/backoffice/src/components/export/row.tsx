import { DownloadIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { useArchiveDelete, useArchiveDownload } from "../../queries/export";
import type { ArchiveRow } from "../../schemas/export";

const STATUS = {
  running: { label: "Preparing", variant: "secondary" as const },
  ready: { label: "Ready", variant: "default" as const },
  failed: { label: "Failed", variant: "destructive" as const },
};

const megabytes = (bytes: number) =>
  bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;

/** One archive: when, by whom, how big, and Download / Delete once it is not being prepared. */
export function ArchiveRowItem({ archive }: { archive: ArchiveRow }) {
  const download = useArchiveDownload();
  const remove = useArchiveDelete();
  const made = new Date(archive.createdAt);
  const status = STATUS[archive.status];
  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {made.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="text-muted-foreground">
          {archive.status === "ready"
            ? `${megabytes(archive.bytes)} · ${archive.rows.toLocaleString("en-GB")} rows`
            : archive.status === "failed"
              ? (archive.error ?? "It could not be made.")
              : "Reading your data. This page updates by itself."}
          {archive.requestedBy ? ` · ${archive.requestedBy}` : ""}
        </span>
        {archive.missingBlobs > 0 && (
          <span className="text-muted-foreground">
            {archive.missingBlobs} uploaded file{archive.missingBlobs === 1 ? "" : "s"} no longer in
            storage, left out.
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {archive.status === "ready" && (
          <Button
            size="sm"
            aria-busy={download.isPending}
            onClick={() => download.mutate({ id: archive.id, day: archive.createdAt.slice(0, 10) })}
          >
            <DownloadIcon aria-hidden />
            Download
          </Button>
        )}
        {archive.status !== "running" && (
          <Button
            size="sm"
            variant="outline"
            disabled={remove.isPending}
            onClick={() => remove.mutate(archive.id)}
            aria-label={`Delete the archive from ${made.toLocaleDateString("en-GB")}`}
          >
            <Trash2Icon aria-hidden />
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}
