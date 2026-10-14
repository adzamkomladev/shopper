import { CardContent } from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { AuthFrame } from "./frame";

export function AuthSkeleton() {
  return (
    <AuthFrame>
      <CardContent
        className="flex flex-col gap-9 px-6 sm:px-22"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full rounded-full" />
      </CardContent>
    </AuthFrame>
  );
}
