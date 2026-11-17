import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { formatDay } from "@shopper/utils";
import type { Comparison } from "../../../schemas/migration";

/** What did not agree between the cloud and the box: each table by its rows, each trading day by its totals. */
export function Mismatches({ report, children }: { report: Comparison; children: string }) {
  const tables = report.tables.filter((row) => !row.ok);
  const days = report.days.filter((row) => !row.ok);
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>The copies differ</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{children}</p>
        {tables.length > 0 && (
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Tables that differ</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 font-medium">
                  Records
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Cloud
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Box
                </th>
              </tr>
            </thead>
            <tbody>
              {tables.map((row) => (
                <tr key={row.table}>
                  <td className="py-1 font-mono text-xs break-all">{row.table}</td>
                  <td className="py-1 text-right">{row.cloud.rows}</td>
                  <td className="py-1 text-right">{row.box.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {days.length > 0 && (
          <p>Sales or tax differ on {days.map((row) => formatDay(row.day)).join(", ")}.</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
