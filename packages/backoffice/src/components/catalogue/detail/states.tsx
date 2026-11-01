import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Field, FieldContent, FieldGroup } from "@shopper/ui/components/field";
import { Separator } from "@shopper/ui/components/separator";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { usePermissions } from "../../../queries/session/permissions";

/** A label over a control, as the form draws every field. */
function TextFieldSkeleton() {
  return (
    <Field>
      <Skeleton className="h-4.75 w-20" />
      <Skeleton className="h-8" />
    </Field>
  );
}

/** A switch beside its label and a line of help. */
function SwitchFieldSkeleton() {
  return (
    <Field orientation="horizontal">
      <Skeleton className="h-4.5 w-8 shrink-0 rounded-full" />
      <FieldContent>
        <Skeleton className="h-4.75 w-28" />
        <Skeleton className="h-5.25 w-3/4" />
      </FieldContent>
    </Field>
  );
}

/** Same shape as the loaded page: back link, heading, then the cards in two columns. */
export function ProductSkeleton() {
  const canAudit = usePermissions()?.includes("audit.read");
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading product"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-33.5" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-70" />
          {canAudit && <Skeleton className="h-8 w-23" />}
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-16" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {Array.from({ length: 5 }, (_, index) => (
                  <TextFieldSkeleton key={index} />
                ))}
                <SwitchFieldSkeleton />
                <SwitchFieldSkeleton />
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end">
              <Skeleton className="h-8 w-29" />
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-20" />
              </CardTitle>
              <Skeleton className="h-5 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <Skeleton className="h-12.5 rounded-md" />
              <Separator />
              <div className="flex flex-col gap-4">
                <FieldGroup className="gap-7">
                  <TextFieldSkeleton />
                  <TextFieldSkeleton />
                </FieldGroup>
                <Skeleton className="ml-auto h-8 w-27" />
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-4 w-14" />
            </CardTitle>
            <Skeleton className="h-5 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-21" />
              <Skeleton className="h-8 w-31" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-5 w-56 max-w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
