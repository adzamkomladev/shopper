import { Kbd } from "@shopper/ui/components/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";

type Props = {
  branches: { id: string; name: string }[];
  branchId: string;
  onBranchChange: (branchId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** The branch whose records, takes or valuation are shown, with its key. */
export function BranchPicker({ branches, branchId, onBranchChange, open, onOpenChange }: Props) {
  return (
    <Select value={branchId} onValueChange={onBranchChange} open={open} onOpenChange={onOpenChange}>
      <SelectTrigger aria-label="Branch" className="w-full sm:w-48">
        <SelectValue />
        <Kbd aria-hidden className="ml-auto">
          B
        </Kbd>
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
