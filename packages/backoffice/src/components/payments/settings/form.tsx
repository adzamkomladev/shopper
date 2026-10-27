import { useForm } from "@tanstack/react-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@shopper/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio/group";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { useSavePaymentSettings } from "../../../queries/payments/settings";
import { MOMO_PROVIDERS, type PaymentSettingsView } from "../../../schemas/payments";
import { SaveBar } from "../../settings/page";

const PROVIDERS = {
  paystack: {
    label: "Paystack",
    description: "The customer approves a prompt on their phone, or types an OTP.",
  },
  hubtel: {
    label: "Hubtel",
    description:
      "The customer approves a prompt on their phone. Every result is checked with Hubtel first.",
  },
} as const;

/** Which provider collects the org's MoMo. A provider this server has no keys for cannot be picked. */
export function PaymentSettingsForm({ settings }: { settings: PaymentSettingsView }) {
  const online = useOnline();
  const save = useSavePaymentSettings();
  const form = useForm({
    defaultValues: { momoProvider: settings.momoProvider },
    onSubmit: ({ value }) => save.mutate(value.momoProvider),
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="momoProvider">
        {(field) => (
          <FieldSet>
            <FieldLegend variant="label">MoMo provider</FieldLegend>
            <FieldDescription>
              Charges started at a till after you save use this provider.
            </FieldDescription>
            <RadioGroup
              value={field.state.value}
              onValueChange={(value) => {
                field.handleChange(value as PaymentSettingsView["momoProvider"]);
                if (save.isError) save.reset();
              }}
              className="gap-3"
            >
              {MOMO_PROVIDERS.map((provider) => {
                const ready = settings.providers[provider];
                return (
                  <Field
                    key={provider}
                    orientation="horizontal"
                    data-disabled={!ready || undefined}
                  >
                    <RadioGroupItem
                      id={`provider-${provider}`}
                      value={provider}
                      disabled={!ready}
                      aria-describedby={`provider-${provider}-note`}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`provider-${provider}`}>
                        {PROVIDERS[provider].label}
                      </FieldLabel>
                      <FieldDescription id={`provider-${provider}-note`}>
                        {ready
                          ? PROVIDERS[provider].description
                          : `Not set up on this server: its API keys are missing.`}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                );
              })}
            </RadioGroup>
          </FieldSet>
        )}
      </form.Field>
      <SaveBar label="Save payment settings" pending={save.isPending} error={save.error?.message} />
    </form>
  );
}
