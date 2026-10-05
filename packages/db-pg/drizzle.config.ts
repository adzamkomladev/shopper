import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db-pg/src/schema.ts",
  out: "./packages/db-pg/migrations",
});
