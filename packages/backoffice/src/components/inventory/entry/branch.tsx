import { Field, FieldLabel } from "@shopper/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { entryId } from "../../../lib/inventory/entry";

type Props = {
  branches: { id: string; name: string }[];
  value: string;
  onChange: (branchId: string) => void;
  /** Receiving and adjusting change one branch's stock, so it can't be switched while a save is in flight. */
  disabled?: boolean;
};

/** The branch whose stock changes. */
export function BranchField({ branches, value, onChange, disabled }: Props) {
  return (
    <Field>
      <FieldLabel htmlFor={entryId("branchId")}>Branch</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={entryId("branchId")} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
