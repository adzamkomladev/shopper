import { Link } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";

/** The shop exists: the owner signs in next. */
export function InstallDone({ shopCode, email }: { shopCode: string; email: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
        <CircleCheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          Your shop <span className="font-medium">{shopCode}</span> is ready. Sign in as{" "}
          <span className="font-medium break-all">{email}</span> to add products, branches and
          tills.
        </p>
      </div>
      <Button asChild size="lg" className="w-full">
        <Link to="/login">Log in</Link>
      </Button>
    </div>
  );
}
