import { sql } from "drizzle-orm";
import type { ShopperTransaction } from "@shopper/db-pg";

/**
 * The archive's tables, each after every table it references, read from the database's own foreign keys so a new
 * table needs no hand-kept list. References inside one table resolve at the end of each insert statement.
 */
export async function tableOrder(tx: ShopperTransaction, tables: string[]) {
  const { rows } = await tx.execute<{ child: string; parent: string }>(sql`
    select child.relname as child, parent.relname as parent
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_class parent on parent.oid = c.confrelid
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and c.conrelid <> c.confrelid`);
  const parents = new Map(tables.map((table) => [table, new Set<string>()]));
  for (const row of rows) if (parents.has(row.parent)) parents.get(row.child)?.add(row.parent);
  const ordered: string[] = [];
  const visit = (table: string, path: string[]) => {
    if (ordered.includes(table)) return;
    if (path.includes(table))
      throw new Error(`Tables reference each other in a cycle: ${[...path, table].join(" → ")}`);
    for (const parent of [...parents.get(table)!].sort()) visit(parent, [...path, table]);
    ordered.push(table);
  };
  for (const table of [...tables].sort()) visit(table, []);
  return ordered;
}
