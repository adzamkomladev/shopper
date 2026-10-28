import { Link } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { useSetupMove } from "../../../queries/setup";

/** Products come from the catalogue screens; the wizard points there, or lets the owner skip for now. */
export function ProductsStep({ done }: { done: boolean }) {
  const online = useOnline();
  const move = useSetupMove();
  return (
    <div className="flex flex-col gap-4">
      {done && (
        <p className="text-sm text-muted-foreground">
          Your catalogue is started. Come back to it any time from Products.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/imports">Import spreadsheet</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/products">Add products one by one</Link>
        </Button>
        {!done && (
          <Button
            variant="ghost"
            disabled={!online || move.isPending}
            onClick={() => move.mutate("products/skip")}
          >
            Skip for now
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        A spreadsheet needs a name and a price for each product; a barcode, category and stock count
        are optional.
      </p>
    </div>
  );
}
