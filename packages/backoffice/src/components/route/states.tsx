import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { readSidebarOpen } from "@shopper/ui/components/sidebar/provider";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { ApiError } from "../../api/client";
import { AuthSkeleton } from "../auth/skeleton";

// A skeleton shows after this long, so a fast load never flashes one.
const PENDING_MS = 300;

/** Shared by every route: a layout-shaped skeleton while loading and one error screen. */
export const routeStates = {
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  pendingMs: PENDING_MS,
};

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// The nav's rows as the loaded sidebar draws them: Overview holds one page, Manage fills the rest.
const NAV_GROUPS = [1, 12] as const;

/** The shell's shape while the session loads: the sidebar as the member left it, the header and a page. */
export function ShellSkeleton({ app = "portal" }: { app?: string }) {
  const open = readSidebarOpen(app) ?? true;
  return (
    <div className="flex h-svh bg-background" role="status" aria-busy="true" aria-label="Loading">
      <nav
        className={`hidden shrink-0 flex-col border-r bg-card md:flex ${open ? "w-60" : "w-12"}`}
      >
        <div className="p-2">
          <Skeleton className="h-11" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-2">
          {NAV_GROUPS.map((rows, group) => (
            <div key={group} className="flex flex-col gap-0.5">
              {open && (
                <div className="flex h-7 items-center px-2">
                  <Skeleton className="h-3 w-16" />
                </div>
              )}
              {Array.from({ length: rows }, (_, row) => (
                <Skeleton key={row} className="h-8" />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-auto border-t p-2">
          <Skeleton className="h-11" />
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
          <Skeleton className="size-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-8 w-8 sm:w-56" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-4 py-5 md:px-8 md:py-6">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

/** The login card while the shop is looked up: the same compact card, with the shop code field and the sign-up line. */
export function LoginSkeleton() {
  return <AuthSkeleton fields={3} footer />;
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 403) {
    return (
      <Message
        title="You don't have permission"
        description="Ask the shop owner to give your role access to this page."
      />
    );
  }
  if (status === 404) {
    return (
      <Message
        title="Not found"
        description="This page or record doesn't exist, or it was removed."
      >
        <Button asChild variant="outline">
          <Link to="/products">Back to products</Link>
        </Button>
      </Message>
    );
  }
  return (
    <Message
      title="Something went wrong"
      description={error instanceof Error ? error.message : "Try again in a moment."}
    >
      <Button
        variant="outline"
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
    </Message>
  );
}

function Message({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
