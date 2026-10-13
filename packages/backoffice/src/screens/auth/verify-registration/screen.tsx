import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AuthFrame } from "../frame";
import { LoginSuccess } from "../login/success";
import { CompleteForm } from "./complete-form";
import { AlreadySetUp } from "./already-set-up";
import { brokenLink } from "../public-api";
import { registrationQuery } from "./queries";
import { VerifyStep } from "./verify-step";

export function VerifyRegistrationScreen() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  return (
    <AuthFrame>
      {signedIn ? (
        <LoginSuccess onContinue={() => void navigate({ to: "/products" })} />
      ) : (
        <Steps onSignedIn={() => setSignedIn(true)} />
      )}
    </AuthFrame>
  );
}

// Its own component, so signing in (which clears cached data) never re-reads the finished link.
function Steps({ onSignedIn }: { onSignedIn: () => void }) {
  const { id, token } = useSearch({ from: "/verify-registration" });
  if (!id || !token) brokenLink();
  const link = { id, token };
  const { data: view } = useSuspenseQuery(registrationQuery(link));
  if (view.completed) return <AlreadySetUp shopCode={view.shopCode} />;
  if (!view.verified) return <VerifyStep link={link} email={view.email} shopName={view.shopName} />;
  return (
    <CompleteForm link={link} email={view.email} shopCode={view.shopCode} onSignedIn={onSignedIn} />
  );
}
