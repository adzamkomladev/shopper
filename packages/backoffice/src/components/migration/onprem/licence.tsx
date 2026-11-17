import { useState } from "react";
import { CopyIcon, DownloadIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Textarea } from "@shopper/ui/components/textarea";
import { useOnPremLicence } from "../../../queries/migration/onprem";

/**
 * The box's licence: its first-boot screen shows a request code, the owner pastes it here, and the licence the cloud
 * issues goes back to the box. Issuing again (a reinstalled box) replaces the licence the move accepts.
 */
export function LicencePanel({ issued }: { issued: unknown }) {
  const issue = useOnPremLicence();
  const [request, setRequest] = useState("");
  const licence = issue.data ?? issued;
  const text = licence ? JSON.stringify(licence, null, 2) : "";
  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => toast.success("Licence copied"),
      () => toast.error("Couldn't copy. Use Download instead."),
    );
  const download = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    link.download = "licence.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (request.trim()) issue.mutate(request.trim(), { onSuccess: () => setRequest("") });
        }}
      >
        <Field data-invalid={!!issue.error}>
          <FieldLabel htmlFor="onprem-request">Box's request code</FieldLabel>
          <Textarea
            id="onprem-request"
            rows={3}
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
            value={request}
            aria-describedby={issue.error ? "onprem-request-error" : "onprem-request-help"}
            onChange={(event) => setRequest(event.target.value)}
          />
          {issue.error ? (
            <FieldError id="onprem-request-error">{issue.error.message}</FieldError>
          ) : (
            <FieldDescription id="onprem-request-help">
              Shown on the box's first-boot screen at https://shopper.local/install.
            </FieldDescription>
          )}
        </Field>
        <div>
          <Button
            type="submit"
            variant={licence ? "outline" : "default"}
            disabled={issue.isPending}
          >
            <KeyRoundIcon aria-hidden />
            {licence ? "Issue again" : "Issue licence"}
          </Button>
        </div>
      </form>
      {licence !== null && licence !== undefined && (
        <div className="flex flex-col gap-2">
          <span id="onprem-licence" className="font-medium">
            Licence for the box
          </span>
          <pre
            aria-labelledby="onprem-licence"
            className="max-h-40 overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap select-all"
          >
            {text}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy()}>
              <CopyIcon aria-hidden />
              Copy
            </Button>
            <Button variant="outline" onClick={download}>
              <DownloadIcon aria-hidden />
              Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
