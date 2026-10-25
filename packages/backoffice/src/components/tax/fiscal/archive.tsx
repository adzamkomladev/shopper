import { DownloadIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input";
import { Label } from "@shopper/ui/components/label";
import type { FiscalArchive } from "../../../schemas/tax/fiscal";

type Props = { date: string; archives: FiscalArchive[]; onDate: (date: string) => void };

/** One day of the six-year archive: each store's hourly bundle of accepted documents, to download. */
export function FiscalArchiveList({ date, archives, onDate }: Props) {
  return (
    <section
      aria-labelledby="fiscal-archive"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="fiscal-archive" className="font-semibold">
            Archive
          </h2>
          <p className="text-sm text-muted-foreground">
            Accepted documents are bundled each hour per store and kept for six years.
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="fiscal-archive-date">Day</Label>
          <Input
            id="fiscal-archive-date"
            type="date"
            className="w-44"
            value={date}
            onChange={(event) => event.target.value && onDate(event.target.value)}
          />
        </div>
      </div>
      {archives.length ? (
        <ul className="divide-y text-sm">
          {archives.map((bundle) => (
            <li key={bundle.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium tabular-nums">{bundle.hour.slice(11, 16)}</span>{" "}
                {bundle.storeName}{" "}
                <span className="text-muted-foreground">
                  · {bundle.docCount} {bundle.docCount === 1 ? "document" : "documents"}
                </span>
              </span>
              {bundle.url ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={bundle.url}
                    download
                    aria-label={`Download ${bundle.storeName} ${bundle.hour.slice(11, 16)}`}
                  >
                    <DownloadIcon aria-hidden />
                    Download
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Stored on the box</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No bundles for this day yet.</p>
      )}
    </section>
  );
}
