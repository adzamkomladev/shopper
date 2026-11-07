import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Input } from "@shopper/ui/components/input/control";
import { Label } from "@shopper/ui/components/label";
import { productPage } from "@shopper/core/schemas";
import { apiFetch } from "../../../api/client";
import type { OrderLine, PickBody } from "../../../schemas/orders";
import { quantityText } from "../format";

type Choice = { id: string; name: string };

/**
 * Says what was found of a line that is short: how much, and what stands in for the rest. The shopper is charged the
 * substitute at no more than the missing goods would have cost, so the picker chooses freely.
 */
export function ShortDialog({
  line,
  onClose,
  onSave,
  pending,
  error,
}: {
  line: OrderLine | undefined;
  onClose: () => void;
  onSave: (body: PickBody) => void;
  pending: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Choice | undefined>();
  const results = useQuery({
    queryKey: ["order-substitutes", search],
    queryFn: () => apiFetch(`/products?limit=6&q=${encodeURIComponent(search)}`, productPage),
    enabled: search.trim().length > 1 && !chosen,
  });
  if (!line) return null;
  const unit = line.unit === "each" ? "" : ` (${line.unit})`;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const found = Math.round(Number(data.get("found")) * 1000);
            const wanted = Math.round(Number(data.get("extra") ?? 0) * 1000);
            onSave({
              pickedThousandths: found,
              ...(chosen && wanted > 0
                ? { substitute: { productId: chosen.id, quantityThousandths: wanted } }
                : {}),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{line.name}</DialogTitle>
            <DialogDescription>
              Wanted {quantityText(line.quantityThousandths, line.unit)}. Say how much you found
              and, if you like, what replaces the rest.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="found">Found{unit}</Label>
            <Input
              id="found"
              name="found"
              type="number"
              inputMode="decimal"
              min={0}
              max={line.quantityThousandths / 1000}
              step="any"
              defaultValue={(line.pick?.pickedThousandths ?? 0) / 1000}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replacement">Replace the rest with (optional)</Label>
            {chosen ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span>{chosen.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setChosen(undefined)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="replacement"
                  type="search"
                  autoComplete="off"
                  placeholder="Search products"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {results.data?.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">No products match.</p>
                )}
                <ul className="flex flex-col gap-1">
                  {results.data?.items.map((item) => (
                    <li key={item.id}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setChosen({ id: item.id, name: item.name })}
                      >
                        {item.name}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {chosen && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="extra">How many of {chosen.name}</Label>
              <Input
                id="extra"
                name="extra"
                type="number"
                inputMode="decimal"
                min={0.001}
                step="any"
                defaultValue={1}
                required
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
