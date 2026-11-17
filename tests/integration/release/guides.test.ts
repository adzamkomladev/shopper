/// <reference types="node" />
// The v1.0 guides and release notes are what owners and support follow: a dead link or a renamed script strands them.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "vite-plus/test";

const folders = ["docs/guides", "docs/releases"];
const docs = folders.flatMap((folder) =>
  readdirSync(folder)
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({
      path: `${folder}/${name}`,
      text: readFileSync(`${folder}/${name}`, "utf8"),
    })),
);

test("there is a guide for cloud onboarding, box install, owners and migration", () => {
  for (const guide of ["cloud", "box", "admin", "migration"])
    expect(existsSync(`docs/guides/${guide}.md`), guide).toBe(true);
});

test("every relative link in the guides and release notes reaches a file", () => {
  const broken = docs.flatMap((doc) =>
    [...doc.text.matchAll(/\]\(([^)\s]+)\)/g)]
      .map((match) => match[1].split("#")[0])
      .filter((target) => target && !/^[a-z]+:/.test(target))
      .filter((target) => !existsSync(resolve(dirname(doc.path), target)))
      .map((target) => `${doc.path} → ${target}`),
  );
  expect(broken).toEqual([]);
});

test("every `vp run` script the guides name exists", () => {
  const scripts = new Set(
    ["package.json", ...["apps", "apps/till", "packages"].flatMap(packageFiles)].flatMap((file) =>
      Object.keys((JSON.parse(readFileSync(file, "utf8")) as { scripts?: object }).scripts ?? {}),
    ),
  );
  const missing = docs.flatMap((doc) =>
    [...doc.text.matchAll(/vp (?:-C \S+ )?run ([\w:-]+)/g)]
      .map((match) => match[1])
      .filter((name) => !scripts.has(name))
      .map((name) => `${doc.path} → ${name}`),
  );
  expect(missing).toEqual([]);
});

function packageFiles(folder: string) {
  return readdirSync(folder)
    .map((name) => `${folder}/${name}/package.json`)
    .filter((file) => existsSync(file));
}
