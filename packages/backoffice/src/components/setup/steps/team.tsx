import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { usePanel } from "../../../hooks/admin/panel";
import { rolesQuery } from "../../../queries/roles";
import { permissionsQuery } from "../../../queries/session/permissions";
import { useRefreshSetup } from "../../../queries/setup";
import type { Revealed } from "../../../queries/types";
import { FormSheet } from "../../admin/form/sheet";
import { InviteForm } from "../../users/invite/form";
import { SetupLinkDialog } from "../../users/setup/link/dialog";

/** Invite the first teammates with the users screen's own form; each invitation's link is shown once. */
export function TeamStep() {
  const { data: roles } = useSuspenseQuery(rolesQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const addRef = useRef<HTMLButtonElement>(null);
  const invite = usePanel(addRef);
  const link = usePanel<Revealed>(addRef);
  const refresh = useRefreshSetup();
  // Only roles whose every permission the owner holds, and never a second owner.
  const grantable = roles.filter(
    (role) => !role.protectedOwner && role.permissionCodes.every((code) => held.includes(code)),
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cashiers sign in on the till with a PIN; managers and admins also get the back office.
      </p>
      <Button ref={addRef} className="self-start" onClick={() => invite.show()}>
        Invite someone
      </Button>
      <FormSheet
        open={invite.open}
        onOpenChange={invite.setOpen}
        title="Invite a user"
        description="They get a link to choose a password and sign in with the role you pick."
        // The setup-link dialog opens as this sheet closes and keeps focus.
        restoreFocus={() => !link.open && invite.restoreFocus()}
      >
        <InviteForm
          roles={grantable}
          reveal={(revealed) => link.show(revealed)}
          onDone={() => {
            invite.setOpen(false);
            refresh();
          }}
        />
      </FormSheet>
      <SetupLinkDialog
        revealed={link.value}
        open={link.open}
        onOpenChange={link.setOpen}
        restoreFocus={link.restoreFocus}
      />
    </div>
  );
}
