import { useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input";
import { Label } from "@shopper/ui/components/label";
import { rangeError } from "../../lib/register/range";
import type { DayRange } from "../../lib/register/types";
import { downloadReportCsv } from "../../queries/register/csv";

const field = "flex flex-col gap-1.5";

/** Figma "Action": the date range (two native date fields) and Download, which saves the range as CSV. */
export function RangeBar({
  range,
  onChange,
}: {
  range: DayRange;
  onChange: (range: DayRange) => void;
}) {
  const id = useId();
  const error = rangeError(range);
  const download = useMutation({
    mutationFn: downloadReportCsv,
    onError: (failure) => toast.error(failure.message),
  });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className={field}>
          <Label htmlFor={`${id}-from`}>From</Label>
          <Input
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
            className="w-44 bg-card"
            id={`${id}-from`}
            onChange={(event) => onChange({ ...range, from: event.target.value })}
            touch
            type="date"
            value={range.from}
          />
        </div>
        <div className={field}>
          <Label htmlFor={`${id}-to`}>To</Label>
          <Input
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
            className="w-44 bg-card"
            id={`${id}-to`}
            onChange={(event) => onChange({ ...range, to: event.target.value })}
            touch
            type="date"
            value={range.to}
          />
        </div>
        <Button
          disabled={error !== null || download.isPending}
          onClick={() => download.mutate(range)}
          size="touch"
        >
          <Download aria-hidden /> {download.isPending ? "Preparing" : "Download"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
