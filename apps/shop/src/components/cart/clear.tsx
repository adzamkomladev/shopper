import { useState } from "react";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { clearCart } from "../../stores/cart";

/** Clear cart, asked once: the basket is not kept anywhere else. */
export function ClearCart({ shop }: { shop: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        Clear cart
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear your cart?</DialogTitle>
            <DialogDescription>
              Everything in it is removed. Nothing has been ordered yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep my cart</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                clearCart(shop);
                setOpen(false);
              }}
            >
              Clear cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
