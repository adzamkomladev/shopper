import { Skeleton } from "@shopper/ui/components/skeleton";

type Props = { label: string; fields: number };

/** A settings page's heading, one line of help, and a label, input and help line per field. */
export function SettingsSkeleton({ label, fields }: Props) {
  return (
    <div
      className="flex max-w-2xl flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="flex flex-col gap-6">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-52" />
    </div>
  );
}
