/** Where the person is in the first-boot setup: the step's name and one bar segment per step. */
export function InstallProgress({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
        Step {current + 1} of {steps.length} · {steps[current]}
      </p>
      <div className="flex gap-1.5" aria-hidden>
        {steps.map((name, index) => (
          <span
            key={name}
            className={`h-1 flex-1 rounded-full ${index <= current ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}
