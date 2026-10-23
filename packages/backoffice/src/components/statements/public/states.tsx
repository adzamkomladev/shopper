import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { FileXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { ApiError } from "../../../api/client";

/** The one column every state of the public page sits in: phone first, no navigation. */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      {children}
    </main>
  );
}

/** The loaded page's own blocks, so nothing moves when the statement arrives. */
export function StatementSkeleton() {
  return (
    <PublicPage>
      <div
        className="flex flex-col gap-6"
        role="status"
        aria-busy="true"
        aria-label="Loading statement"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72 max-w-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-52 w-full" />
      </div>
    </PublicPage>
  );
}

/** A link that does not work says so and nothing more: whether it expired, was replaced or never existed is not told. */
export function StatementError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  if (error instanceof ApiError && error.status === 404)
    return (
      <PublicPage>
        <div className="flex flex-col items-start gap-3">
          <FileXIcon className="size-8 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">This statement link doesn't work</h1>
          <p className="text-muted-foreground">
            It may have expired or been replaced by a newer one. Ask the shop to send you a new
            link.
          </p>
        </div>
      </PublicPage>
    );
  return (
    <PublicPage>
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-bold tracking-tight">We couldn't load your statement</h1>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Try again in a moment."}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>
      </div>
    </PublicPage>
  );
}
