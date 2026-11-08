import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AuthFrame, AuthPanel } from "../../components/auth/frame";
import { InstallDone } from "../../components/install/done";
import { InstallProgress } from "../../components/install/progress";
import { CodeStep, LicenceStep, OwnerStep, ShopStep } from "../../components/install/steps";
import { ApiError } from "../../api/client";
import { installStateQuery, useInstall } from "../../queries/install/install";
import type { InstallValues } from "../../schemas/install/form";

const TITLES = {
  code: "Setup code",
  shop: "Your shop",
  owner: "Your account",
  licence: "Licence",
} as const;
const LEADS = {
  code: "Enter the code the installer showed. It proves you are the person setting this box up.",
  shop: "Tell us what to call the shop and the store this box serves.",
  owner: "The owner has every permission and can add everyone else.",
  licence: "This box checks a licence from Shopper. The code below lets support issue yours.",
} as const;

/** First boot: a box with no shop is set up in four short steps, or three where no licence is checked. */
export function InstallScreen() {
  const { data: state } = useSuspenseQuery(installStateQuery());
  const navigate = useNavigate();
  const install = useInstall();
  const [values, setValues] = useState<Partial<InstallValues>>({});
  const [step, setStep] = useState(0);
  if (!state) {
    // Another browser finished setup first.
    void navigate({ to: "/login" });
    return null;
  }
  const steps: Array<keyof typeof TITLES> = state.licence.enforced
    ? ["code", "shop", "owner", "licence"]
    : ["code", "shop", "owner"];
  const name = steps[step]!;
  const last = step === steps.length - 1;
  const submit = (next: Partial<InstallValues>) => {
    const merged = { ...values, ...next };
    setValues(merged);
    if (!last) return setStep(step + 1);
    install.mutate(merged as InstallValues, {
      onError: (error) => {
        // A wrong code is the first step's to fix; anything else the current step shows.
        if (error instanceof ApiError && error.status === 403) setStep(0);
      },
    });
  };
  const back = step > 0 ? () => setStep(step - 1) : undefined;
  const error = install.error?.message;
  const done = install.data;
  return (
    <AuthFrame>
      <AuthPanel
        title={done ? "All set" : TITLES[name]}
        description={done ? undefined : LEADS[name]}
      >
        {done ? (
          <InstallDone shopCode={done.shopCode} email={done.email} />
        ) : (
          <>
            <InstallProgress steps={steps.map((each) => TITLES[each])} current={step} />
            {name === "code" && <CodeStep values={values} onNext={submit} error={error} />}
            {name === "shop" && <ShopStep values={values} onNext={submit} onBack={back} />}
            {name === "owner" && (
              <OwnerStep
                values={values}
                onNext={submit}
                onBack={back}
                action={last ? "Install" : "Continue"}
                pending={last && install.isPending}
                error={last ? error : undefined}
              />
            )}
            {name === "licence" && (
              <LicenceStep
                values={values}
                onNext={submit}
                onBack={back}
                request={state.licence.request}
                pending={install.isPending}
                error={error}
              />
            )}
          </>
        )}
      </AuthPanel>
    </AuthFrame>
  );
}
