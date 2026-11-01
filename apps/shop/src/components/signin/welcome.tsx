/** The moment between the right code and the account: the check draws itself. */
export function Welcome({ shopName }: { shopName: string }) {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center"
      role="status"
    >
      <span className="flex size-24 animate-pop items-center justify-center rounded-full bg-success text-success-foreground shadow-xl shadow-success/30">
        <svg aria-hidden viewBox="0 0 24 24" className="draw-stroke size-12" fill="none">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">You are in</h1>
        <p className="text-muted-foreground">Opening your receipts from {shopName}</p>
      </div>
    </main>
  );
}
