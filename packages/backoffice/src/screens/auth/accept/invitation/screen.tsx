import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AuthFrame } from "../../../../components/auth/frame";
import { LoginSuccess } from "../../../../components/auth/login/success";
import { brokenLink } from "../../../../api/auth/public/api";
import { JoinForm } from "../../../../components/auth/accept/invitation/join/form";
import { invitationQuery } from "../../../../queries/auth/accept/invitation";

export function AcceptInvitationScreen() {
  const navigate = useNavigate();
  const [joined, setJoined] = useState(false);
  return (
    <AuthFrame>
      {joined ? (
        <LoginSuccess onContinue={() => void navigate({ to: "/" })} />
      ) : (
        <Invitation onJoined={() => setJoined(true)} />
      )}
    </AuthFrame>
  );
}

// Its own component, so signing in (which clears cached data) never re-reads the used link.
function Invitation({ onJoined }: { onJoined: () => void }) {
  const { id, token } = useSearch({ from: "/accept-invitation" });
  if (!id || !token) brokenLink();
  const link = { id, token };
  const { data: preview } = useSuspenseQuery(invitationQuery(link));
  return <JoinForm link={link} preview={preview} onJoined={onJoined} />;
}
