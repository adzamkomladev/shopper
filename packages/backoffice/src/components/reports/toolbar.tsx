import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { OfflineNote } from "../register/states";
import { BranchPicker } from "../inventory/picker";
import type { Period } from "../../lib/reports/types";
import { reportScopeQuery } from "../../queries/reports/reports";
import type { ReportKind } from "../../schemas/reports/views";
import { ExportMenu } from "./export";
import { PeriodControls } from "./period";

type Props = {
  period: Period;
  branchId?: string;
  /** Leave out where the report compares branches itself. */
  onBranch?: (branchId: string | undefined) => void;
  /** What the Export menu downloads: this report with these parameters. */
  exporting: { kind: ReportKind; params: Record<string, string | undefined> };
  /** Controls of this report only (a grouping, a window), beside the shared ones. */
  controls?: React.ReactNode;
};

/**
 * What every report shares above its figures: the period (`[` and `]` step it), the branch (`B`, shown once there
 * is more than one) and the export menu (`E`).
 */
export function ReportToolbar({ period, branchId, onBranch, exporting, controls }: Props) {
  const online = useOnline();
  const [branchOpen, setBranchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const scope = useQuery({ ...reportScopeQuery(), enabled: onBranch !== undefined });
  const branches = (onBranch && scope.data?.branches) || [];
  const shortcuts = useShortcuts({
    "[": () => period.onStep(-1),
    "]": () => period.onStep(1),
    ...(branches.length > 1 && { B: () => setBranchOpen(true) }),
    ...(online && { E: () => setExportOpen(true) }),
  });
  return (
    <>
      {!online && (
        <OfflineNote>
          You're seeing figures loaded earlier. New sales show when you're back online.
        </OfflineNote>
      )}
      <div ref={shortcuts} className="flex flex-wrap items-end gap-3">
        <PeriodControls period={period} />
        {branches.length > 1 && (
          <BranchPicker
            branches={[{ id: "all", name: "All branches" }, ...branches]}
            branchId={branchId ?? "all"}
            onBranchChange={(picked) => onBranch!(picked === "all" ? undefined : picked)}
            open={branchOpen}
            onOpenChange={setBranchOpen}
          />
        )}
        {controls}
        <ExportMenu
          kind={exporting.kind}
          params={exporting.params}
          open={exportOpen}
          onOpenChange={setExportOpen}
          disabled={!online}
        />
      </div>
    </>
  );
}
