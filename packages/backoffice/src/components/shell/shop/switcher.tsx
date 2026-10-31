import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { SidebarMenuButton } from "@shopper/ui/components/sidebar/parts";
import type { Shop } from "../../../stores/shops";
import { usePickShop } from "../../../queries/shell";

type Props = { shops: Shop[]; currentId: string | null };

export function ShopSwitcher({ shops, currentId }: Props) {
  const [open, setOpen] = useState(false);
  const pick = usePickShop();
  const navigate = useNavigate();
  const current = shops.find((shop) => shop.id === currentId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          role="combobox"
          tooltip={current?.name ?? "Select a shop"}
          aria-label={`Shop: ${current?.name ?? "none selected"}`}
          aria-expanded={open}
          className="h-11 px-1.5 text-foreground group-data-[sidebar=collapsed]/sidebar:px-0.5"
        >
          {/* The shop's tile: a div, as the rail hides the button's span children (the labels). */}
          <div
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
          >
            {current?.name.charAt(0).toUpperCase() ?? "?"}
          </div>
          <span className="grid flex-1 leading-tight">
            <span className="truncate font-medium">{current?.name ?? "Select a shop"}</span>
            <span className="truncate text-xs text-foreground/70">
              {shops.length > 1 ? `${shops.length} shops on this device` : "Shop"}
            </span>
          </span>
          <ChevronsUpDownIcon
            aria-hidden
            className="ml-auto opacity-50 group-data-[sidebar=collapsed]/sidebar:hidden"
          />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Shops"
        align="start"
        side="bottom"
        className="w-(--radix-popover-trigger-width) min-w-60 p-0"
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
