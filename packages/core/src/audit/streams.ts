import { sql } from "drizzle-orm";
import type { Queryable } from "../types";

/** The org chain and each register that uploaded one: length, head, and the last anchor published for it. */
export async function auditStreams(db: Queryable, orgId: string) {
  const result = await db.execute<{
    stream: string;
    name: string | null;
    count: string;
    seq: string | null;
    hash: string | null;
    anchor_day: string | null;
    anchor_seq: string | null;
    anchor_hash: string | null;
  }>(sql`
    WITH heads AS (
      SELECT 'org'::text AS stream, count(*) AS count, max(chain_seq) AS seq
        FROM audit_log WHERE org_id = ${orgId} AND chain_seq IS NOT NULL
      UNION ALL
      SELECT stream_id::text, count(*), max(chain_seq) FROM device_audit
       WHERE org_id = ${orgId} GROUP BY stream_id
    )
    SELECT h.stream, d.name, h.count, h.seq,
           coalesce(l.hash, r.hash) AS hash,
           a.day::text AS anchor_day, a.chain_seq AS anchor_seq, a.hash AS anchor_hash
      FROM heads h
      LEFT JOIN device d ON d.org_id = ${orgId} AND d.id::text = h.stream
      LEFT JOIN audit_log l ON h.stream = 'org' AND l.org_id = ${orgId} AND l.chain_seq = h.seq
      LEFT JOIN device_audit r ON r.org_id = ${orgId} AND r.stream_id::text = h.stream AND r.chain_seq = h.seq
      LEFT JOIN LATERAL (
        SELECT day, chain_seq, hash FROM audit_anchor
         WHERE org_id = ${orgId} AND stream = h.stream ORDER BY day DESC LIMIT 1
      ) a ON TRUE
     ORDER BY h.stream = 'org' DESC, d.name`);
  return result.rows.map((row) => ({
    stream: row.stream,
    name: row.name,
    count: Number(row.count),
    head: row.seq === null ? null : { seq: Number(row.seq), hash: row.hash! },
    anchor:
      row.anchor_day === null
        ? null
        : { day: row.anchor_day, seq: Number(row.anchor_seq), hash: row.anchor_hash! },
  }));
}
