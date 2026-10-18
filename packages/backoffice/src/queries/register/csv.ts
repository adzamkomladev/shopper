import { ApiError } from "../../api/client";
import { reportPath } from "../../lib/register/range";
import type { DayRange } from "../../lib/register/types";

/** Fetches the range as CSV and hands it to the browser as a file, so a failure can be explained. */
export async function downloadReportCsv(range: DayRange) {
  const response = await fetch(`/api${reportPath(range, ".csv")}`, {
    credentials: "include",
  }).catch(() => {
    throw new ApiError(0, "Can't reach the register. Check it is running and try again.");
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 403
        ? "Your account can't download reports."
        : "The report couldn't be built. Try again.",
    );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = `register-${range.from}-${range.to}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
