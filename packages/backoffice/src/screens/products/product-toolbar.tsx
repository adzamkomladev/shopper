import { SearchIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import { Kbd } from "@shopper/ui/components/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import type { CategoryView } from "./queries";

const ALL = "all";

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  searchRef: React.Ref<HTMLInputElement>;
  categories: CategoryView[];
  categoryId?: string;
  onCategoryChange: (categoryId?: string) => void;
};

export function ProductToolbar({
  text,
  onTextChange,
  searchRef,
  categories,
  categoryId,
  onCategoryChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <InputGroup className="min-w-0 flex-1 basis-64">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={searchRef}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Name, SKU or barcode"
          aria-label="Search products"
        />
        <InputGroupAddon align="inline-end">
          <Kbd aria-hidden>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      {categories.length > 0 && (
        <Select
          value={categoryId ?? ALL}
          onValueChange={(value) => onCategoryChange(value === ALL ? undefined : value)}
        >
          <SelectTrigger aria-label="Filter by category" className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
