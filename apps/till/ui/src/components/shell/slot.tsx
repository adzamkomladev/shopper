import type { ReactNode } from "react";
import { takeFocus } from "../../hooks/focus";

/** A register section: the shell owns the region and its heading, the back-office screen fills it. */
export function RegisterSlot({
  slot,
  title,
  active,
  children,
}: {
  slot: "register-dashboard" | "register-inventory" | "register-reports";
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${slot}-title`}
      className="h-full min-h-0 overflow-y-auto pt-4 outline-none"
      data-slot={slot}
      hidden={!active}
      id={slot}
      ref={(node) => takeFocus(node, active)}
      tabIndex={-1}
    >
      <h1 className="mb-6 text-3xl font-bold tracking-tight" id={`${slot}-title`}>
        {title}
      </h1>
      {children}
    </section>
  );
}
