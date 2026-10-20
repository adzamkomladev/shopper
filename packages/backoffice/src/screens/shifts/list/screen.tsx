import { useSuspenseQuery } from "@tanstack/react-query";
import { SHIFT_LIST_LIMIT } from "@shopper/core/schemas";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { PageHeader } from "../../../components/admin/page/header";
import { NoShifts } from "../../../components/shifts/list/states";
import { ShiftTable } from "../../../components/shifts/list/table";
import { OfflineNote } from "../../../components/register/states";
import { shiftsQuery } from "../../../queries/shifts/list";

/** Closed shifts, newest first; a row opens that shift's Z report. */
export function ShiftsScreen() {
  const { data } = useSuspenseQuery(shiftsQuery());
  const online = useOnline();
  const { shifts } = data;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader title="Shifts" />
      {!online && (
        <OfflineNote>
          You're seeing the shifts loaded earlier. Newer ones appear when you're back online.
        </OfflineNote>
      )}
      {shifts.length === 0 ? <NoShifts /> : <ShiftTable shifts={shifts} />}
      {shifts.length >= SHIFT_LIST_LIMIT && (
        <p className="text-sm text-muted-foreground">
          Showing the newest {SHIFT_LIST_LIMIT} closed shifts.
        </p>
      )}
    </div>
  );
}
