import { sql } from "~/db";
import {
  normalizeExternalObservations,
  sanitizeExternalObservation,
  type EvidenceProvider,
  type EvidenceSourceDeclaration,
  type ExternalObservation,
} from "./external-evidence";

const TABLE_MIGRATION = `CREATE TABLE IF NOT EXISTS external_evidence_snapshots (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  provider text NOT NULL,
  connection_ref text NOT NULL,
  identity jsonb NOT NULL,
  source_state jsonb NOT NULL,
  observations jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id, provider, connection_ref)
)`;
const INDEX_MIGRATION = `CREATE INDEX IF NOT EXISTS external_evidence_user_product_idx ON external_evidence_snapshots (user_id, product_id, fetched_at DESC)`;

export interface ExternalEvidenceSnapshot {
  productId: string;
  provider: EvidenceProvider;
  connectionRef: string;
  identity: unknown;
  source: EvidenceSourceDeclaration;
  observations: ExternalObservation[];
  fetchedAt: number;
}

async function migrateExternalEvidence(): Promise<void> {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(TABLE_MIGRATION);
  await q.query(INDEX_MIGRATION);
}

export async function putExternalEvidenceSnapshot(userId: number, snapshot: ExternalEvidenceSnapshot): Promise<void> {
  await migrateExternalEvidence();
  const observations = normalizeExternalObservations(snapshot.observations
    .map((row) => sanitizeExternalObservation(row))
    .filter((row): row is ExternalObservation => row !== null));
  const fetchedAt = new Date(snapshot.fetchedAt);
  await sql()`insert into external_evidence_snapshots (
    user_id, product_id, provider, connection_ref, identity, source_state, observations, fetched_at, updated_at
  ) values (
    ${userId}, ${snapshot.productId}, ${snapshot.provider}, ${snapshot.connectionRef},
    ${JSON.stringify(snapshot.identity)}, ${JSON.stringify(snapshot.source)}, ${JSON.stringify(observations)}, ${fetchedAt}, now()
  ) on conflict (user_id, product_id, provider, connection_ref) do update set
    identity = excluded.identity, source_state = excluded.source_state,
    observations = excluded.observations, fetched_at = excluded.fetched_at, updated_at = now()`;
}

export async function readExternalEvidenceSnapshots(
  userId: number,
  productId: string,
  provider?: EvidenceProvider,
): Promise<ExternalEvidenceSnapshot[]> {
  await migrateExternalEvidence();
  const rows = provider
    ? await sql()`select product_id, provider, connection_ref, identity, source_state, observations, fetched_at
        from external_evidence_snapshots where user_id = ${userId} and product_id = ${productId} and provider = ${provider}
        order by fetched_at desc`
    : await sql()`select product_id, provider, connection_ref, identity, source_state, observations, fetched_at
        from external_evidence_snapshots where user_id = ${userId} and product_id = ${productId}
        order by fetched_at desc`;

  return rows.map((raw) => {
    const row = raw as {
      product_id: string; provider: EvidenceProvider; connection_ref: string; identity: unknown;
      source_state: EvidenceSourceDeclaration; observations: unknown; fetched_at: string | Date;
    };
    const observations = Array.isArray(row.observations)
      ? normalizeExternalObservations(row.observations
          .map((item) => sanitizeExternalObservation(item))
          .filter((item): item is ExternalObservation => item !== null))
      : [];
    return {
      productId: row.product_id,
      provider: row.provider,
      connectionRef: row.connection_ref,
      identity: row.identity,
      source: row.source_state,
      observations,
      fetchedAt: new Date(row.fetched_at).getTime(),
    };
  });
}
