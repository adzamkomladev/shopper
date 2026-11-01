import { useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@shopper/ui/components/button";
import { Label } from "@shopper/ui/components/label";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { rangeError } from "../../lib/register/range";
import type { DayRange } from "../../lib/register/types";
import { downloadReportCsv } from "../../queries/register/csv";
import { DatePicker } from "@shopper/ui/components/picker/date";

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
          <DatePicker
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
            className="w-44 bg-card"
            id={`${id}-from`}
            onValueChange={(value) => onChange({ ...range, from: value })}
            touch
            value={range.from}
          />
        </div>
        <div className={field}>
          <Label htmlFor={`${id}-to`}>To</Label>
          <DatePicker
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
            className="w-44 bg-card"
            id={`${id}-to`}
            onValueChange={(value) => onChange({ ...range, to: value })}
            touch
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

/** The range bar's fields and button, drawn in the same sizes while the figures load. */
export function RangeBarSkeleton() {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {[0, 1].map((index) => (
        <div key={index} className={field}>
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-11 w-44" />
        </div>
      ))}
      <Skeleton className="h-11 w-32" />
    </div>
  );
}
