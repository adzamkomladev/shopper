"use no memo";
import { Link } from "@tanstack/react-router";
import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import type { AuditStream, Verdict } from "../../../schemas/audit";

const REASONS: Record<string, string> = {
  hash: "an entry was changed after it was written",
  sequence: "an entry is missing or out of order",
  "previous-hash": "an entry no longer follows the one before it",
  anchor: "the chain no longer matches a published daily anchor",
  tenant: "an entry belongs to another organisation",
  "legacy-unhashed": "an entry was written before the chain was hashed",
};

const label = (stream: AuditStream) =>
  stream.stream === "org"
    ? "Back office"
    : (stream.name ?? `Register ${stream.stream.slice(0, 8)}`);

type Props = {
  streams: AuditStream[];
  verdicts: Record<string, Verdict>;
  onVerify: (stream: string) => void;
  disabled: boolean;
};

/** The back office chain and each register's, with its length, head, last anchor and verdict. */
export function StreamsTable({ streams, verdicts, onVerify, disabled }: Props) {
  const columns: DataTableColumn<AuditStream>[] = [
    {
      id: "chain",
      header: "Chain",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{label(row.original)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.count.toLocaleString("en-GB")} entries
          </span>
        </div>
      ),
    },
    {
      id: "head",
      header: "Head",
      meta: { className: "hidden md:table-cell tabular-nums" },
      cell: ({ row }) =>
        row.original.head ? (
          <span title={row.original.head.hash}>
            #{row.original.head.seq}{" "}
            <span className="font-mono text-muted-foreground">
              {row.original.head.hash.slice(0, 12)}
            </span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "anchor",
      header: "Last anchor",
      meta: { className: "hidden lg:table-cell tabular-nums" },
      cell: ({ row }) =>
        row.original.anchor
          ? `${row.original.anchor.day} · #${row.original.anchor.seq}`
          : "None yet",
    },
    {
      id: "verdict",
      header: "Check",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <VerdictCell
          name={label(row.original)}
          verdict={verdicts[row.original.stream]}
          onVerify={() => onVerify(row.original.stream)}
          disabled={disabled}
        />
      ),
    },
  ];
  return (
    <DataTable
      label="Audit chains"
      columns={columns}
      data={streams}
      getRowId={(row) => row.stream}
      className="min-h-0"
    />
  );
}

type CellProps = { name: string; verdict: Verdict; onVerify: () => void; disabled: boolean };

function VerdictCell({ name, verdict, onVerify, disabled }: CellProps) {
  if (verdict === "checking")
    return (
      <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
        Checking…
      </span>
    );
  const again = (
    <Button
      variant="outline"
      size="sm"
      onClick={onVerify}
      disabled={disabled}
      aria-label={`Verify ${name}`}
    >
      {verdict ? "Verify again" : "Verify"}
    </Button>
  );
  if (!verdict) return again;
  if ("failed" in verdict)
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-sm text-destructive">
          Could not check: {verdict.failed}
        </p>
        {again}
      </div>
    );
  return (
    <div className="flex flex-col items-start gap-2">
      {verdict.valid ? (
        <Badge variant="secondary">
          <CircleCheckIcon aria-hidden />
          Pass
        </Badge>
      ) : (
        <>
          <Badge variant="destructive">
            <CircleXIcon aria-hidden />
            Fail
          </Badge>
          <span className="text-sm">
            {verdict.seq !== null ? `At #${verdict.seq}: ` : ""}
            {REASONS[verdict.reason] ?? verdict.reason}.
          </span>
          {verdict.entryId && (
            <Link
              to="/audit"
              search={{ entry: verdict.entryId }}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the entry
            </Link>
          )}
        </>
      )}
      {again}
    </div>
  );
}
