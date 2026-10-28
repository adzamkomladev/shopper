import "./styles.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  RegisterDashboard,
  RegisterInventory,
  RegisterProvider,
  RegisterReports,
} from "@shopper/backoffice/register";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { DisplayScreen } from "./screens/display/screen";
import { ConnectionScreen } from "./screens/connection/screen";
import { SaleScreen } from "./screens/sale/screen";
import { PurchasesScreen } from "./screens/purchases/screen";
import { SettingsScreen } from "./screens/settings/screen";
import { ShiftScreen } from "./screens/shift/screen";
import { SignInScreen } from "./screens/signin/screen";
import { EnrolScreen } from "./screens/enrol/screen";
import { enrolTill } from "./enrol/store";
import { ShellFrame } from "./components/shell/frame";
import { shellLink } from "./components/shell/link";
import { RegisterSlot } from "./components/shell/slot";
import { AccountPaymentDialog } from "./components/accounts/payment";
import { CheckoutGate } from "./components/shift/gate";
import { ShiftDialogs } from "./components/shift/dialogs/host";
import { useShiftDialogs } from "./hooks/shift/dialog/state";
import type { ShellView } from "./components/shell/types";
import { landingView } from "./components/shell/views";
import { connectRegister, initializeConnection, useConnectionSnapshot } from "./connection/store";
import { initializeDisplay, useDisplaySnapshot } from "./display/store";
import { paymentActions } from "./sale/accounts";
import { saleActions, useSaleSnapshot } from "./sale/store";
import { purchaseOutput } from "./purchases/delivery";
import { purchaseActions, usePurchasesSnapshot } from "./purchases/store";
import { initializeSession, signIn, signOut, useSignInSnapshot } from "./session/store";
import { settingsActions, useSettingsSnapshot } from "./settings/store";
import { shiftActions, useShiftSnapshot } from "./shift/store";

const display = new URLSearchParams(window.location.search).has("display");
initializeConnection();
initializeSession();
if (display) initializeDisplay();

function Register() {
  const connection = useConnectionSnapshot();
  const signing = useSignInSnapshot();
  const [view, setView] = useState<"connection" | "till">("connection");
  const user = connection.status?.user;
  // A till fresh from the installer has no identity; enrolling it comes before signing anyone in.
  if (connection.unenrolled)
    return (
      <EnrolScreen host={connection.host} onReconnect={connectRegister} onSubmit={enrolTill} />
    );
  // A register with no signed-in user can do nothing else, so sign-in comes before every other screen.
  if (user === null)
    return (
      <SignInScreen
        host={connection.host}
        offline={connection.status?.server === "offline"}
        onReconnect={connectRegister}
        onSubmit={async (email, password) => {
          const signedIn = await signIn(email, password);
          if (signedIn) setView("till");
          return signedIn;
        }}
        snapshot={signing}
      />
    );
  return view === "till" ? (
    <Workspace key={user?.userId ?? "register"} onRegister={() => setView("connection")} />
  ) : (
    <AppBackdrop className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:px-13 lg:py-10">
      <ConnectionScreen onSell={() => setView("till")} />
    </AppBackdrop>
  );
}

function Workspace({ onRegister }: { onRegister: () => void }) {
  const connection = useConnectionSnapshot();
  const { status } = connection;
  const permissions = status?.user?.permissions ?? status?.permissions ?? [];
  const [chosen, setTab] = useState<ShellView | null>(null);
  const tab = chosen ?? landingView(permissions) ?? "purchases";
  const [saleFocus, setSaleFocus] = useState(0);
  const sale = useSaleSnapshot();
  const purchases = usePurchasesSnapshot();
  const settings = useSettingsSnapshot();
  const shift = useShiftSnapshot();
  const dialogs = useShiftDialogs(shift.phase);
  // A dialog owns the keys, so the screen under it stops listening until it closes.
  const modal = dialogs.dialog !== null;
  const can = (permission: string) => permissions.includes(permission);
  function navigate(next: ShellView) {
    setTab(next);
    if (next === "sale") setSaleFocus((value) => value + 1);
    if (next === "purchases") purchaseActions.list({ ...purchases.filters, page: 1 });
    if (next === "shift") shiftActions.loadReport(true);
  }
  const link = shellLink(connection.host, status);
  return (
    <RegisterProvider>
      <ShellFrame
        link={link}
        modal={modal}
        onAction={dialogs.start}
        onSignOut={() => void signOut()}
        onView={navigate}
        permissions={permissions}
        registerName={status?.identity.registerName ?? ""}
        user={status?.user?.name ?? ""}
        view={tab}
      >
        {can("report.read") && (
          <RegisterSlot active={tab === "dashboard"} slot="register-dashboard" title="Dashboard">
            <RegisterDashboard online={link.online} onOpen={navigate} />
          </RegisterSlot>
        )}
        {can("stock.read") && (
          <RegisterSlot active={tab === "inventory"} slot="register-inventory" title="Inventory">
            <RegisterInventory online={link.online} />
          </RegisterSlot>
        )}
        {can("report.read") && (
          <RegisterSlot active={tab === "reports"} slot="register-reports" title="Sales Reports">
            <RegisterReports online={link.online} />
          </RegisterSlot>
        )}
        {can("sale.create") && (
          <div hidden={tab !== "sale"} className="h-full min-h-0">
            <CheckoutGate
              active={tab === "sale" && !modal}
              canWrite={can("shift.write")}
              onClose={() => navigate("shift")}
              onOpen={() => dialogs.start("open")}
              phase={shift.phase}
            >
              <SaleScreen
                active={tab === "sale" && !modal}
                actions={saleActions}
                focusKey={saleFocus}
                onPurchases={() => navigate("purchases")}
                onRegister={onRegister}
                snapshot={sale}
              />
            </CheckoutGate>
          </div>
        )}
        {can("shift.write") && (
          <div hidden={tab !== "shift"} className="h-full min-h-0">
            <ShiftScreen
              active={tab === "shift" && !modal}
              actions={shiftActions}
              onOpen={() => dialogs.start("open")}
              snapshot={shift}
            />
          </div>
        )}
        <div hidden={tab !== "purchases"} className="h-full min-h-0">
          <PurchasesScreen
            active={tab === "purchases"}
            actions={purchaseActions}
            online={link.online}
            output={purchaseOutput(settings.current, sale.permissions)}
            snapshot={purchases}
          />
        </div>
        <div hidden={tab !== "settings"} className="h-full min-h-0">
          <SettingsScreen
            active={tab === "settings"}
            actions={settingsActions}
            snapshot={settings}
          />
        </div>
      </ShellFrame>
      <ShiftDialogs
        actions={shiftActions}
        dialog={dialogs.dialog}
        onClose={dialogs.close}
        onClosed={(event) => dialogs.restore(event, () => setSaleFocus((value) => value + 1))}
      />
      <AccountPaymentDialog
        actions={paymentActions}
        online={link.online}
        onClose={dialogs.close}
        onClosed={(event) => dialogs.restore(event, () => setSaleFocus((value) => value + 1))}
        open={dialogs.dialog === "payment"}
      />
    </RegisterProvider>
  );
}

function Display() {
  return <DisplayScreen snapshot={useDisplaySnapshot()} />;
}

// The Electron customer-display window opens this same UI with `?display`.
createRoot(document.getElementById("root")!).render(
  display ? (
    <Display />
  ) : (
    <ShortcutRoot>
      <Register />
      <Toaster position="top-right" />
    </ShortcutRoot>
  ),
);
