import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { ApiError } from "../../api/client";
import { useInstallImport } from "../../queries/install/install";
import { Mismatches } from "../migration/onprem/report";
import { AuthPanel } from "../auth/frame";
import { InstallProgress } from "./progress";
import { CodeStep, LicenceStep } from "./steps";

const STEPS = ["Setup code", "Licence"];

/**
 * First boot on a box installed with a cloud shop's archive: the setup code, then the licence the cloud issued from
 * this box's request code. The box takes the shop over and the cloud checks every record before it lets go.
 */
export function ImportInstall({ shop, request }: { shop: string; request?: string }) {
  const move = useInstallImport();
  const [code, setCode] = useState("");
  const [licence, setLicence] = useState("");
  const [onLicence, setOnLicence] = useState(false);
  const done = move.data;
  if (done?.ok)
    return (
      <AuthPanel title="All set">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
            <CircleCheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              <span className="font-medium">{done.shop}</span> runs on this box now, and every
              record matches the cloud. Sign in with your usual email and password. Tills move here
              the next time they connect.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </AuthPanel>
    );
  return (
    <AuthPanel
      title={onLicence ? "Licence" : `Move ${shop} here`}
      description={
        onLicence
          ? "Paste the licence the cloud issued for this box on its Move on-prem page."
          : "This box was installed to take over your cloud shop. Enter the code the installer showed."
      }
    >
      <InstallProgress steps={STEPS} current={onLicence ? 1 : 0} />
      {done && !done.ok && (
        <Mismatches report={done}>
          The cloud kept the shop. Try again; if it still differs, call the move off in the cloud
          and reinstall this box.
        </Mismatches>
      )}
      {onLicence ? (
        <LicenceStep
          values={{ licence }}
          request={request}
          help="Copy the request code into the cloud's Move on-prem page, then paste the licence it gives you."
          action={`Move ${shop} here`}
          pending={move.isPending}
          error={move.error?.message}
          onBack={(draft) => {
            setLicence(draft.licence ?? "");
            setOnLicence(false);
          }}
          onNext={(value) => {
            setLicence(value.licence ?? "");
            move.mutate(
              { code, licence: value.licence },
              {
                // A wrong code is the first step's to fix; anything else the licence step shows.
                onError: (error) =>
                  error instanceof ApiError && error.status === 403 && setOnLicence(false),
              },
            );
          }}
        />
      ) : (
        <CodeStep
          values={{ code }}
          error={
            move.error instanceof ApiError && move.error.status === 403
              ? move.error.message
              : undefined
          }
          onNext={(value) => {
            move.reset();
            setCode(value.code);
            setOnLicence(true);
          }}
        />
      )}
    </AuthPanel>
  );
}
