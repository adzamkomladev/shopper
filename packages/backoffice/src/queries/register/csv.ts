import { downloadFile } from "../../lib/download";
import { reportPath } from "../../lib/register/range";
import type { DayRange } from "../../lib/register/types";

/** Fetches the range as CSV and hands it to the browser as a file, so a failure can be explained. */
export function downloadReportCsv(range: DayRange) {
  return downloadFile(reportPath(range, ".csv"), `register-${range.from}-${range.to}.csv`, {
    unreachable: "Can't reach the register. Check it is running and try again.",
    denied: "Your account can't download reports.",
    failed: "The report couldn't be built. Try again.",
  });
}
