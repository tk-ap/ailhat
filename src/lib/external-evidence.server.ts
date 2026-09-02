import { sql } from "~/db";
import {
  normalizeExternalObservations,
  sanitizeExternalObservation,
  type EvidenceProvider,
  type EvidenceSourceDeclaration,
  type ExternalObservation,
} from "./external-evidence";

const MIGRATION = `
CREATE TABLE IF NOT EXISTS external_evidence_snapshots (
  user_id         bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id      text        NOT NULL,
  provider        text        NOT NULL,
  connection_ref  text        NOT NULL,
  identity         jsonb       NOT NULL,
  source_state     jsonb       NOT NULL,
  observations    jsonb       NOT NULL,
  fetched_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id, provider, connection_ref)
);
CREATE INDEX IF NOT EXISTS external_evidence_user_product_idx
  ON external_evidence_snapshots (user_id, product_id, fetched_at DESC);
`;

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
  await q.query(MIGRATION);
}

export async function putExternalEvidenceSnapshot(
  userId: number,
  snapshot: ExternalEvidenceSnapshot,
): Promise<void> {
  await migrateExternalEvidence();
  const observations = normalizeExternalObservations(
    snapshot.observations
      .map((row) => sanitizeExternalObservation(row))
      .filter((row): row is ExternalObservation => row !== null),
  );
  const fetchedAt = new Date(snapshot.fetchedAt);
  await sql()`
    INSERT INTO external_evidence_snapshots (
      user_id, product_id, provider, connection_ref,
      identity, source_state, observations, fetched_at, updated_at
    )
    VALUES (
      ${userId}, ${snapshot.productId}, ${snapshot.provider}, ${snapshot.connectionRef},
      ${JSON.stringify(snapshot.identity)}, ${JSON.stringify(snapshot.source)},
      ${JSON.stringify(observations)}, ${fetchedAt}, now()
    )
    ON CONFLICT (user_id, product_id, provider, connection_ref)
    DO UPDATE SET
      identity = excluded.identity,
      source_state = excluded.source_state,
      observations = excluded.observations,
      fetched_at = excluded.fetched_at,
      updated_at = now()
  `;
}

export async function readExternalEvidenceSnapshots(
  userId: number,
  productId: string,
  provider?: EvidenceProvider,
): Promise<ExternalEvidenceSnapshot[]> {
  await migrateExternalEvidence();
  const rows = provider
    ? await sql()`
        SELECT product_id, provider, connection_ref, identity, source_state, observations, fetched_at
        FROM external_evidence_snapshots
        WHERE user_id = ${userId} AND product_id = ${productId} AND provider = ${provider}
        ORDER BY fetched_at DESC
      `
    : await sql()`
        SELECT product_id, provider, connection_ref, identity, source_state, observations, fetched_at
        FROM external_evidence_snapshots
        WHERE user_id = ${userId} AND product_id = ${productId}
        ORDER BY fetched_at DESC
      `;

  return rows.map((raw) => {
    const row = raw as {
      product_id: string;
      provider: EvidenceProvider;
      connection_ref: string;
      identity: unknown;
      source_state: EvidenceSourceDeclaration;
      observations: unknown;
      fetched_at: string | Date;
    };
    const observations = Array.isArray(row.observations)
      ? normalizeExternalObservations(
          row.observations
            .map((item) => sanitizeExternalObservation(item))
            .filter((item): item is ExternalObservation => item !== null),
        )
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
