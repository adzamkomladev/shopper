import { Label } from "@shopper/ui/components/label";
import { DatePicker } from "@shopper/ui/components/picker/date";

type Props = {
  from?: string;
  to: string;
  onChange: (change: { from?: string; to?: string }) => void;
  /** The label of the last day: "To", or "As of" for a statement at a day. */
  toLabel?: string;
};

/** The shop dates a ledger view covers; a statement "as of" a day shows only the second picker. */
export function LedgerRange({ from, to, onChange, toLabel = "To" }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {from !== undefined && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="ledger-from">From</Label>
          <DatePicker
            id="ledger-from"
            value={from}
            max={to}
            onValueChange={(value) => value && onChange({ from: value })}
            className="w-44"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="ledger-to">{toLabel}</Label>
        <DatePicker
          id="ledger-to"
          value={to}
          min={from}
          onValueChange={(value) => value && onChange({ to: value })}
          className="w-44"
        />
      </div>
    </div>
  );
}
