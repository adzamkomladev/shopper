import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { currentOrgQuery } from "../../../queries/session/session";
import { AuthFrame } from "../../../components/auth/frame";
import { LoginForm } from "../../../components/auth/login/form";

export function LoginScreen() {
  const { data: box } = useSuspenseQuery(currentOrgQuery);
  const { shop } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  return (
    <AuthFrame>
      <LoginForm
        box={box}
        defaultShopCode={shop ?? ""}
        onSignedIn={() => void navigate({ to: "/" })}
      />
    </AuthFrame>
  );
}
