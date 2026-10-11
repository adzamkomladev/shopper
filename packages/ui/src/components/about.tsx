import { buildInfo } from "@shopper/config";

export function About() {
  return (
    <section aria-label="About Shopper" className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Shopper</h1>
        <p className="text-sm text-muted-foreground">Version {buildInfo.version}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Build</dt>
        <dd className="truncate font-medium">{buildInfo.gitSha}</dd>
        <dt className="text-muted-foreground">Built</dt>
        <dd className="font-medium">{buildInfo.buildDate}</dd>
      </dl>
    </section>
  );
}
