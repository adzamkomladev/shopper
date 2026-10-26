import * as v from "valibot";
import { assignMemberRole, createRole, deleteRole, updateRole } from "@shopper/auth";
import { roleAssignmentInput } from "@shopper/auth/schemas";
import type { ShopperDatabase } from "@shopper/db-pg";

type CommandContext = Parameters<typeof createRole>[1];

type Handler = (
  db: ShopperDatabase,
  context: CommandContext,
  id: string,
  body: unknown,
) => Promise<{ body?: unknown; status: 200 | 201 | 204 }>;

/** Every administration write: method, path, the permission the route needs, whether it reads a JSON body. */
export const administrationWrites: {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  code: string;
  json: boolean;
  run: Handler;
}[] = [
  {
    method: "POST",
    path: "/roles",
    code: "role.write",
    json: true,
    run: async (db, context, _id, body) => ({
      body: (await createRole(db, context, body)).after,
      status: 201,
    }),
  },
  {
    method: "PATCH",
    path: "/roles/:id",
    code: "role.write",
    json: true,
    run: async (db, context, id, body) => ({
      body: (await updateRole(db, context, { id, data: body })).after,
      status: 200,
    }),
  },
  {
    method: "DELETE",
    path: "/roles/:id",
    code: "role.write",
    json: false,
    run: async (db, context, id) => {
      await deleteRole(db, context, id);
      return { status: 204 };
    },
  },
  {
    method: "PATCH",
    path: "/users/:id/role",
    code: "role.write",
    json: true,
    run: async (db, context, id, body) => ({
      body: await assignMemberRole(db, context, {
        userId: id,
        ...v.parse(roleAssignmentInput, body),
      }),
      status: 200,
    }),
  },
];
