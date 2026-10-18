// The package's `exports` map has no `types` condition, so Bundler resolution cannot see its index.d.ts.
// A tsconfig `paths` alias would also be honoured by Bun at runtime and load the .d.ts, so declare the
// small surface the till database uses instead.
declare module "better-sqlite3-multiple-ciphers" {
  type Statement = {
    readonly reader: boolean;
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    raw(toggle?: boolean): Statement;
    columns(): { name: string }[];
  };
  class Database {
    constructor(path: string, options?: { timeout?: number; readonly?: boolean });
    prepare(sql: string): Statement;
    exec(sql: string): this;
    pragma(source: string): unknown;
    close(): this;
  }
  export = Database;
}
