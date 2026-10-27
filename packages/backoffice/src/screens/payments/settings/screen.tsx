import { useSuspenseQuery } from "@tanstack/react-query";
import { PaymentsPage } from "../../../components/payments/page";
import { PaymentSettingsForm } from "../../../components/payments/settings/form";
import { PaymentSettingsSkeleton } from "../../../components/payments/settings/states";
import { Gate } from "../../../components/register/states";
import { paymentSettingsQuery } from "../../../queries/payments/settings";

/** How the org collects MoMo: Paystack or Hubtel. Needs register.settings. */
export function PaymentSettingsScreen() {
  return (
    <PaymentsPage active="settings">
      <Gate
        need="register.settings"
        what="payment settings"
        verb="change"
        fallback={<PaymentSettingsSkeleton />}
      >
        <div className="max-w-2xl">
          <Settings />
        </div>
      </Gate>
    </PaymentsPage>
  );
}

function Settings() {
  const { data } = useSuspenseQuery(paymentSettingsQuery());
  return <PaymentSettingsForm settings={data} />;
}
