import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@shopper/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@shopper/ui/components/popover";
import { categoriesQuery, useCreateCategory } from "./queries";

type Props = { id: string; value: string | null; onChange: (categoryId: string | null) => void };

/** Pick a category, or type a new name and create it without leaving the product form. */
export function CategoryCombobox({ id, value, onChange }: Props) {
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const create = useCreateCategory((category) => choose(category.id));
  const name = term.trim();
  const exists = categories.some((item) => item.name.toLowerCase() === name.toLowerCase());

  function choose(categoryId: string | null) {
    onChange(categoryId);
    setOpen(false);
    setTerm("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {categories.find((item) => item.id === value)?.name ?? "No category"}
          <ChevronsUpDownIcon aria-hidden className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Categories"
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput value={term} onValueChange={setTerm} placeholder="Find or add a category" />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="No category" onSelect={() => choose(null)}>
                No category
              </CommandItem>
              {categories.map((item) => (
                <CommandItem key={item.id} value={item.name} onSelect={() => choose(item.id)}>
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.id === value && <CheckIcon aria-hidden />}
                </CommandItem>
              ))}
            </CommandGroup>
            {name && !exists && (
              <CommandGroup>
                <CommandItem
                  forceMount
                  value={`create ${name}`}
                  disabled={create.isPending}
                  onSelect={() => create.mutate(name)}
                >
                  <PlusIcon aria-hidden />
                  Create "{name}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
