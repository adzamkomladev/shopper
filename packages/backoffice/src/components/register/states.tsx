import type { ReactNode } from "react";
import { CloudOff, ShieldOff, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { holds, type PermissionNeed } from "../../lib/roles/permissions";
import { ApiError } from "../../api/client";
import { permissionsQuery } from "../../queries/session/permissions";

/** Shows `children` once the signed-in user is known to hold `need` (or one of them); otherwise the reason it is hidden. */
export function Gate({
  need,
  what,
  verb,
  fallback,
  children,
}: {
  need: PermissionNeed;
  what: string;
  /** What the permission lets them do, when it is not just to view `what`. */
  verb?: string;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const { data, isPending } = useQuery(permissionsQuery());
  if (isPending) return fallback;
  return holds(data, need) ? children : <NoPermission what={what} verb={verb} />;
}

export function NoPermission({ what, verb = "view" }: { what: string; verb?: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldOff aria-hidden />
        </EmptyMedia>
        <EmptyTitle>
          You don't have permission to {verb} {what}
        </EmptyTitle>
        <EmptyDescription>Ask a manager to give your account access.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** What went wrong in the words of the API, with the way out. A 403 is the no-permission state. */
export function LoadError({
  error,
  what,
  onRetry,
}: {
  error: Error;
  what: string;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.status === 403) return <NoPermission what={what} />;
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>Couldn't load {what}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        <Button className="mt-2" onClick={onRetry} size="touch" variant="outline">
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** The register works on its own; this says what the missing connection changes. */
export function OfflineNote({ children }: { children: ReactNode }) {
  return (
    <Alert role="status">
      <CloudOff aria-hidden />
      <AlertTitle>Offline</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
