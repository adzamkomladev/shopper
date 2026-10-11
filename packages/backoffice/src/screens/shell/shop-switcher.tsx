import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, StoreIcon } from "lucide-react";
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
import type { Shop } from "../../shops/shop-store";
import { usePickShop } from "./queries";

type Props = { shops: Shop[]; currentId: string | null };

export function ShopSwitcher({ shops, currentId }: Props) {
  const [open, setOpen] = useState(false);
  const pick = usePickShop();
  const navigate = useNavigate();
  const current = shops.find((shop) => shop.id === currentId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label={`Shop: ${current?.name ?? "none selected"}`}
          aria-expanded={open}
          className="w-full justify-start font-medium sm:w-50"
        >
          <StoreIcon aria-hidden />
          <span className="flex-1 truncate text-left">{current?.name ?? "Select a shop"}</span>
          <ChevronsUpDownIcon aria-hidden className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Shops"
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 p-0"
      >
        <Command>
          <CommandInput placeholder="Find a shop" />
          <CommandList>
            <CommandEmpty>No shop found.</CommandEmpty>
            <CommandGroup heading="Shops on this device">
              {shops.map((shop) => (
                <CommandItem
                  key={shop.id}
                  value={`${shop.name} ${shop.slug}`}
                  onSelect={() => {
                    setOpen(false);
                    if (shop.id !== currentId) pick.mutate(shop);
                  }}
                >
                  <span className="flex-1 truncate">{shop.name}</span>
                  {shop.id === currentId && <CheckIcon aria-hidden />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-1">
          <Button
            variant="ghost"
            className="w-full justify-start font-normal"
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/login" });
            }}
          >
            <PlusIcon aria-hidden />
            Add another shop
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
