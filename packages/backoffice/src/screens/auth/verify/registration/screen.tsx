import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AuthFrame } from "../../../../components/auth/frame";
import { CompleteForm } from "../../../../components/auth/verify/registration/complete/form";
import { AlreadySetUp } from "../../../../components/auth/verify/registration/already/set/up";
import { brokenLink } from "../../../../api/auth/public/api";
import { registrationQuery } from "../../../../queries/auth/verify/registration";
import { VerifyStep } from "../../../../components/auth/verify/registration/verify/step";

export function VerifyRegistrationScreen() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  return (
    <AuthFrame>
      {/* Unmounted at once: signing in clears cached data, and the used link must not be read again. */}
      {!signedIn && (
        <Steps
          onSignedIn={() => {
            setSignedIn(true);
            void navigate({ to: "/" });
          }}
        />
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
