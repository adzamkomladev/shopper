import { takeFocus } from "../../hooks/focus";

/** Where the back-office slice draws a register section; the shell only reserves the region. */
export function RegisterSlot({
  slot,
  title,
  active,
}: {
  slot: "register-dashboard" | "register-inventory" | "register-reports";
  title: string;
  active: boolean;
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
      <h1 className="text-3xl font-bold tracking-tight" id={`${slot}-title`}>
        {title}
      </h1>
    </section>
  );
}
