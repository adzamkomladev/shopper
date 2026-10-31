import { Link } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";

/** Receive goods and Adjust stock, each with its key. Only members who can write stock are given them. */
export function RecordActions({ branchId }: { branchId?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link aria-keyshortcuts="A" to="/stock/adjust" search={{ branch: branchId }}>
          Adjust stock
        </Link>
      </Button>
      <Button asChild>
        <Link aria-keyshortcuts="R" to="/stock/receive" search={{ branch: branchId }}>
          Receive goods
          {/* The default key chip is under 4.5:1 on the primary; a fainter chip passes (as on Low stock). */}
        </Link>
      </Button>
    </div>
  );
}
