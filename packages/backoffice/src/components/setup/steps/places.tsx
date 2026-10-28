import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { usePanel } from "../../../hooks/admin/panel";
import { branchesQuery } from "../../../queries/branches";
import { useRefreshSetup } from "../../../queries/setup";
import { storesQuery } from "../../../queries/stores";
import { FormSheet } from "../../admin/form/sheet";
import { BranchForm } from "../../branches/form";
import { StoreForm } from "../../stores/form";
import { NameList } from "./list";

/** The shop's first store, in the stores screen's own sheet. */
export function StoreStep() {
  const { data: stores } = useSuspenseQuery(storesQuery());
  const addRef = useRef<HTMLButtonElement>(null);
  const panel = usePanel(addRef);
  const refresh = useRefreshSetup();
  return (
    <div className="flex flex-col gap-4">
      <NameList label="Your stores" names={stores.map((store) => store.name)} />
      <Button ref={addRef} className="self-start" onClick={() => panel.show()}>
        {stores.length ? "Add another store" : "Add store"}
      </Button>
      <FormSheet
        open={panel.open}
        onOpenChange={panel.setOpen}
        title="New store"
        description="Give the store a name."
        restoreFocus={panel.restoreFocus}
      >
        <StoreForm
          onSaved={() => {
            panel.setOpen(false);
            refresh();
          }}
        />
      </FormSheet>
    </div>
  );
}

/** The first branch, under a store; without a store there is nowhere to put it yet. */
export function BranchStep() {
  const { data: stores } = useSuspenseQuery(storesQuery());
  const { data: branches } = useSuspenseQuery(branchesQuery());
  const addRef = useRef<HTMLButtonElement>(null);
  const panel = usePanel(addRef);
  const refresh = useRefreshSetup();
  if (stores.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        A branch belongs to a store.{" "}
        <Link
          to="/setup"
          search={{ step: "store" }}
          className="font-medium text-foreground underline"
        >
          Add a store first
        </Link>
        .
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <NameList label="Your branches" names={branches.map((branch) => branch.name)} />
      <Button ref={addRef} className="self-start" onClick={() => panel.show()}>
        {branches.length ? "Add another branch" : "Add branch"}
      </Button>
      <FormSheet
        open={panel.open}
        onOpenChange={panel.setOpen}
        title="New branch"
        description="Name the branch and choose its store."
        restoreFocus={panel.restoreFocus}
      >
        <BranchForm
          stores={stores}
          onSaved={() => {
            panel.setOpen(false);
            refresh();
          }}
        />
      </FormSheet>
    </div>
  );
}
