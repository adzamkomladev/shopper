import { useState } from "react";
import { AuthFrame } from "../../../components/auth/frame";
import { CheckEmail } from "../../../components/auth/signup/check/email";
import { SignupForm } from "../../../components/auth/signup/form";
import type { Started } from "../../../queries/auth/signup";

export function SignupScreen() {
  // The resend capability lives in memory only: it is never written to the URL or to storage.
  const [started, setStarted] = useState<Started | null>(null);
  return (
    <AuthFrame>
      {started ? (
        <CheckEmail started={started} onChangeEmail={() => setStarted(null)} />
      ) : (
        <SignupForm onStarted={setStarted} />
      )}
    </AuthFrame>
  );
}
