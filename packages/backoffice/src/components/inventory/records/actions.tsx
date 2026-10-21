import { Link } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";

/** Receive goods and Adjust stock, each with its key. Only members who can write stock are given them. */
export function RecordActions({ branchId }: { branchId?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link to="/stock/adjust" search={{ branch: branchId }}>
          Adjust stock
          <Kbd aria-hidden>A</Kbd>
        </Link>
      </Button>
      <Button asChild>
        <Link to="/stock/receive" search={{ branch: branchId }}>
          Receive goods
          {/* The default key chip is under 4.5:1 on the primary; a fainter chip passes (as on Low stock). */}
          <Kbd aria-hidden className="bg-primary-foreground/5">
            R
          </Kbd>
        </Link>
      </Button>
    </div>
  );
}
