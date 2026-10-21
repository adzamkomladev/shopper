import { useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ShiftHeader } from "../../../components/shifts/detail/header";
import { ShiftReport } from "../../../components/shifts/report/report";
import { shiftQuery } from "../../../queries/shifts/detail";

/** One closed shift: where it ran and who closed it, then its stored Z report. */
export function ShiftScreen() {
  const { shiftId } = useParams({ from: "/_shop/shifts/$shiftId" });
  const { data: shift } = useSuspenseQuery(shiftQuery(shiftId));
  return (
    <div className="flex flex-col gap-8 pb-6">
      <ShiftHeader shift={shift} />
      <ShiftReport
        context={false}
        report={shift.report}
        approverName={shift.approverName}
        names={shift.names}
      />
    </div>
  );
}
