import { useState } from "react";
import { AuthFrame } from "../frame";
import { CheckEmail } from "./check-email";
import { SignupForm } from "./form";
import type { Started } from "./queries";

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
