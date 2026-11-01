import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { toast } from "@shopper/ui/components/sonner";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { shopFetch } from "../../queries/api";
import { addressesQuery } from "../../queries/account";
import { noContent, type ShopAddress } from "../../schemas/shop";
import { AddressForm } from "./address";

/** Delivery addresses: the default first; add, edit or remove one in place. */
export function Addresses({ shop, phone }: { shop: string; phone: string }) {
  const queryClient = useQueryClient();
  const query = addressesQuery(shop);
  const addresses = useQuery(query);
  const [editing, setEditing] = useState<ShopAddress | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) =>
      shopFetch(`/account/addresses/${id}`, noContent, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: query.queryKey });
      toast.success("Address removed");
    },
    onError: (error) => toast.error(error.message),
  });
  const saved = () => {
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: query.queryKey });
  };
  return (
    <section aria-labelledby="addresses-title" className="space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <h3 id="addresses-title" className="font-bold">
          Delivery addresses
        </h3>
        {editing === null ? (
          <Button
            variant="ghost"
            className="rounded-full font-semibold"
            onClick={() => setEditing("new")}
          >
            <Plus aria-hidden /> Add
          </Button>
        ) : null}
      </div>
      {editing === "new" ? (
        <AddressForm phone={phone} onDone={saved} onCancel={() => setEditing(null)} />
      ) : null}
      {addresses.isPending ? <Skeleton className="h-20 rounded-2xl" /> : null}
      {addresses.isError ? (
        <p className="text-sm text-destructive">{addresses.error.message}</p>
      ) : null}
      {addresses.data?.items.length === 0 && editing !== "new" ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Add where you want orders delivered. It is kept for when the shop starts delivering.
        </p>
      ) : null}
      <ul className="space-y-2">
        {addresses.data?.items.map((address, index) =>
          editing !== "new" && editing?.id === address.id ? (
            <li key={address.id}>
              <AddressForm
                phone={phone}
                address={address}
                onDone={saved}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={address.id}
              className="rise-stagger flex items-start gap-3 rounded-2xl bg-muted/60 p-4"
              style={{ "--rise-index": index } as React.CSSProperties}
            >
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold">
                  {address.label}
                  {address.isDefault ? (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      Default
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground">
                  {[address.line1, address.area, address.city].join(", ")}
                </p>
                {address.landmark ? (
                  <p className="text-muted-foreground">{address.landmark}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${address.label}`}
                onClick={() => setEditing(address)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${address.label}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(address.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
