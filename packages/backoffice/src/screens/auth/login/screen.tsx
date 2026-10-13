import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { currentOrgQuery } from "../../../session/queries";
import { AuthFrame } from "../frame";
import { LoginForm } from "./form";
import { LoginSuccess } from "./success";

export function LoginScreen() {
  const { data: box } = useSuspenseQuery(currentOrgQuery);
  const { shop } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  return (
    <AuthFrame>
      {signedIn ? (
        <LoginSuccess onContinue={() => void navigate({ to: "/products" })} />
      ) : (
        <LoginForm box={box} defaultShopCode={shop ?? ""} onSignedIn={() => setSignedIn(true)} />
      )}
    </AuthFrame>
  );
}
