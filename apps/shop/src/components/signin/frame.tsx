/** The sign-in card: the shop's initial in a glowing badge, a bold heading and the step below it. */
export function SignInFrame({
  shopName,
  title,
  description,
  children,
}: {
  shopName: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-linear-to-b from-shop-glow to-transparent"
      />
      <section className="animate-rise space-y-7 rounded-panel bg-card p-6 shadow-xl shadow-shop-ink/10 sm:p-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground">
              {shopName.slice(0, 1).toUpperCase()}
            </span>
            <p className="font-semibold text-muted-foreground">{shopName}</p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-balance">{title}</h1>
          <p className="text-pretty text-muted-foreground">{description}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
