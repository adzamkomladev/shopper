import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/pg/src/schemas/index.ts",
  out: "./packages/db/pg/migrations",
});
