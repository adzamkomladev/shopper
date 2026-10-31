import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Button } from "@shopper/ui/components/button";
import { Card, CardContent } from "@shopper/ui/components/card";
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

/** The shell's shape while the session loads: the sidebar as the member left it, the header and a page. */
export function ShellSkeleton({ app = "portal" }: { app?: string }) {
  const open = readSidebarOpen(app) ?? true;
  return (
    <div className="flex h-svh bg-background" role="status" aria-busy="true" aria-label="Loading">
      <div
        className={`hidden shrink-0 flex-col gap-1 border-r bg-card p-2 md:flex ${open ? "w-60" : "w-12"}`}
      >
        <Skeleton className="mb-1 h-11 w-full" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
        <Skeleton className="mt-auto h-11 w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
          <Skeleton className="size-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-8 w-8 sm:w-56" />
        </div>
        <div className="px-4 py-5 md:px-8 md:py-6">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <AppBackdrop
      className="grid place-items-center bg-transparent p-0 shadow-none"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Card className="w-full max-w-3xl rounded-3xl border-0 p-10">
        <CardContent className="flex flex-col gap-9">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </CardContent>
      </Card>
    </AppBackdrop>
  );
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
