import { Elysia } from "elysia";
import { createApi } from "@shopper/api";
export const app = new Elysia().mount(createApi().fetch);
if (import.meta.main) app.listen(Number(process.env.PORT ?? 3001));
