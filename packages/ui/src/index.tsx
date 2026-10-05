import { buildInfo } from "@shopper/config";
export function About() {
  return (
    <section aria-label="About Shopper">
      <h1>Shopper</h1>
      <p>Version {buildInfo.version}</p>
      <dl>
        <dt>Build</dt>
        <dd>{buildInfo.gitSha}</dd>
        <dt>Built</dt>
        <dd>{buildInfo.buildDate}</dd>
      </dl>
    </section>
  );
}
