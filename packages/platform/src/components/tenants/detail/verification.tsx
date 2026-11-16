import { Link } from "@tanstack/react-router";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { formatDate, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { CHECK_LABELS, STATUS_LABELS, statusVariant } from "../../../lib/kyb/status";
import { Section } from "../../kyb/review/details";
import type { TenantDetail } from "../../../schemas/types";
import { Facts, Stats } from "./header";

type Verification = TenantDetail["verification"];

const columns: DataTableColumn<Verification["workflows"][number]>[] = [
  {
    id: "workflow",
    header: "Workflow",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{row.original.type}</span>
        <span className="text-xs break-all text-muted-foreground">{row.original.instanceId}</span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "failed" ? "destructive" : "outline"}>
        <span className="capitalize">{row.original.status}</span>
      </Badge>
    ),
  },
  { id: "step", header: "Step", cell: ({ row }) => row.original.currentStep },
  {
    id: "moved",
    header: "Last moved",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => shiftTime(row.original.updatedAt),
  },
];

/** The business verification as it stands, its checks, and every workflow the shop has run. */
export function TenantVerification({
  orgId,
  verification,
}: {
  orgId: string;
  verification: Verification;
}) {
  const kyb = verification.kyb;
  const failed = verification.workflows.filter((run) => run.status === "failed").length;
  return (
    <>
      <Stats
        items={[
          ["Verification", kyb ? STATUS_LABELS[kyb.status] : "Not started"],
          ["Payouts", kyb?.payouts ? "Set up" : "Not set up"],
          ["Workflows", verification.workflows.length],
          ["Failed workflows", failed],
        ]}
      />
      <Section label="Business verification">
        {kyb ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={statusVariant(kyb.status)}>{STATUS_LABELS[kyb.status]}</Badge>
              <span className="text-sm text-muted-foreground">Submission {kyb.version}</span>
              {kyb.version > 0 && (
                <Button asChild variant="outline" size="sm" className="ml-auto">
                  <Link to="/kyb/$orgId" params={{ orgId }}>
                    Open the case
                  </Link>
                </Button>
              )}
            </div>
            <Facts
              rows={[
                ["Business name", kyb.businessName ?? "Not given"],
                ["Submitted", kyb.submittedAt ? shiftTime(kyb.submittedAt) : "Not yet"],
                ["Decided", kyb.decidedAt ? shiftTime(kyb.decidedAt) : "Not yet"],
                ["Approval lapses", kyb.expiresOn ? formatDate(kyb.expiresOn) : "No expiry"],
                ["Decision note", kyb.decisionNote ?? "None"],
              ]}
            />
            {kyb.checks.length > 0 && (
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {kyb.checks.map((check) => (
                  <li key={check.check} className="flex items-start gap-2">
                    {check.ok ? (
                      <CircleCheckIcon
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-label="Passed"
                      />
                    ) : (
                      <CircleXIcon
                        className="mt-0.5 size-4 shrink-0 text-destructive"
                        aria-label="Failed"
                      />
                    )}
                    <span>
                      {CHECK_LABELS[check.check] ?? check.check}
                      {check.reason && (
                        <span className="block text-muted-foreground">{check.reason}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The shop has not started verifying its business, so it cannot take payouts yet.
          </p>
        )}
      </Section>
      <h2 className="text-base font-semibold">Workflows</h2>
      {verification.workflows.length ? (
        <DataTable
          label="Workflows"
          columns={columns}
          data={verification.workflows}
          getRowId={(run) => run.instanceId}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No workflows have run for this shop.
        </p>
      )}
    </>
  );
}
