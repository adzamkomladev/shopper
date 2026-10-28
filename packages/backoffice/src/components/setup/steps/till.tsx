import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { buildInfo } from "@shopper/config";
import { Button } from "@shopper/ui/components/button";
import { usePanel } from "../../../hooks/admin/panel";
import { branchesQuery } from "../../../queries/branches";
import { useRefreshSetup } from "../../../queries/setup";
import { FormSheet } from "../../admin/form/sheet";
import { EnrolForm } from "../../devices/enrol/form";

/** Install the till app, then enrol it with a one-time code; the step is done once a till has enrolled. */
export function TillStep({ done }: { done: boolean }) {
  const { data: branches } = useSuspenseQuery(branchesQuery());
  const addRef = useRef<HTMLButtonElement>(null);
  const enrol = usePanel(addRef);
  const refresh = useRefreshSetup();
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm">
        <li className="pl-1">
          <div className="flex flex-col items-start gap-2">
            <span>Install Shopper on the till computer (Windows 10 or later).</span>
            {buildInfo.tillDownloadUrl ? (
              <Button asChild variant="outline">
                <a href={buildInfo.tillDownloadUrl} download>
                  <DownloadIcon aria-hidden />
                  Download the till app {buildInfo.version}
                </a>
              </Button>
            ) : (
              <span className="text-muted-foreground">
                The installer is coming soon. You can create the till's code now.
              </span>
            )}
          </div>
        </li>
        <li className="pl-1">
          <div className="flex flex-col items-start gap-2">
            <span>
              Create a code for the till's branch, then type it on the till or scan its QR. A code
              works once, for one till.
            </span>
            {branches.length ? (
              <Button ref={addRef} onClick={() => enrol.show()}>
                Create enrolment code
              </Button>
            ) : (
              <span className="text-muted-foreground">
                Add a branch first: a till works in one.
              </span>
            )}
          </div>
        </li>
      </ol>
      <p className="text-sm text-muted-foreground" role="status">
        {done
          ? "A till is enrolled. Add more from Devices any time."
          : "This step is done once a till enrols with its code."}
      </p>
      <FormSheet
        open={enrol.open}
        onOpenChange={(open) => {
          enrol.setOpen(open);
          if (!open) refresh();
        }}
        title="Enrol a device"
        description="Choose the branch the till will work in. You get a code to enter on the till."
        restoreFocus={enrol.restoreFocus}
      >
        <EnrolForm branches={branches} />
      </FormSheet>
    </div>
  );
}
