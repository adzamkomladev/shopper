import type { AnyFormApi } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { useShortcuts, type ShortcutMap } from "@shopper/ui/hooks/shortcuts";

/** Mod+Enter submits the step, and `extra` adds the step's own keys. Nothing fires while a request is out or offline. */
export function useStepShortcut(form: AnyFormApi, enabled: boolean, extra: ShortcutMap = {}) {
  return useShortcuts({
    "Mod+Enter": () => {
      if (enabled) void form.handleSubmit();
    },
    ...extra,
  });
}

type FormProps = {
  form: AnyFormApi;
  shortcuts: React.Ref<HTMLFormElement>;
  children: React.ReactNode;
};

/** The form of one step of the start sheet: fields scroll, the footer stays. */
export function StepForm({ form, shortcuts, children }: FormProps) {
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {children}
    </form>
  );
}

export function StartError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
