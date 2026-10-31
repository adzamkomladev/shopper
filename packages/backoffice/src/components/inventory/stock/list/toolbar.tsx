import { SearchIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import { Kbd } from "@shopper/ui/components/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  searchRef: React.Ref<HTMLInputElement>;
  branches: { id: string; name: string }[];
  branchId: string;
  onBranchChange: (branchId: string) => void;
  branchOpen: boolean;
  onBranchOpenChange: (open: boolean) => void;
  low: boolean;
  onToggleLow: () => void;
  negative: boolean;
  onToggleNegative: () => void;
};

/** Search, the branch whose stock is shown, and the low and negative stock filters, each with its key. */
export function StockToolbar(props: Props) {
  const { branches, branchId, low, negative } = props;
  return (
    <div className="flex flex-wrap gap-3">
      <InputGroup className="min-w-0 flex-1 basis-64">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={props.searchRef}
          value={props.text}
          onChange={(event) => props.onTextChange(event.target.value)}
          onKeyDown={props.onSearchKeyDown}
          placeholder="Name, SKU or barcode"
          aria-label="Search stock"
        />
        <InputGroupAddon align="inline-end">
          <Kbd aria-hidden>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      <Select
        value={branchId}
        onValueChange={props.onBranchChange}
        open={props.branchOpen}
        onOpenChange={props.onBranchOpenChange}
      >
        <SelectTrigger aria-label="Branch" aria-keyshortcuts="B" className="w-full sm:w-48">
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
      <Button
        aria-keyshortcuts="L"
        variant={low ? "default" : "outline"}
        aria-pressed={low}
        onClick={props.onToggleLow}
      >
        Low stock
        {/* The default key chip (20% white on the primary) is under 4.5:1 with its letter; a fainter chip passes. */}
      </Button>
      <Button
        aria-keyshortcuts="Z"
        variant={negative ? "default" : "outline"}
        aria-pressed={negative}
        onClick={props.onToggleNegative}
      >
        Negative
      </Button>
    </div>
  );
}
