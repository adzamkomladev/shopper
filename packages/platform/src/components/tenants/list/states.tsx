import { StoreIcon } from "lucide-react";
import { EmptyList } from "@shopper/backoffice/kit";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { FROM_LG, FROM_MD } from "./table";

export function NoTenants() {
  return (
    <EmptyList
      icon={StoreIcon}
      title="No shops yet"
      description="A shop appears here as soon as its owner verifies their email at signup."
    />
  );
}

const SKELETON_ROWS = 6;
const COLUMNS = [
  ["Shop", "", "h-9 w-40"],
  ["Onboarding", "", "h-6 w-24 rounded-full"],
  ["First sale", FROM_MD, "h-5 w-32"],
  ["Verification", "", "h-6 w-24 rounded-full"],
  ["Till updates", "", "h-8 w-28"],
  ["Joined", FROM_LG, "h-5 w-32"],
] as const;

export function TenantsSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading shops">
      <Skeleton className="h-9 w-32" />
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map(([label, only]) => (
                <TableHead
                  key={label}
                  className={`h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground ${only}`}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <TableRow key={row} className="h-16.5 hover:bg-transparent">
                {COLUMNS.map(([label, only, size]) => (
                  <TableCell key={label} className={`px-4 ${only}`}>
                    <Skeleton className={size} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
