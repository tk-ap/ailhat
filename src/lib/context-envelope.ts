export const CONTEXT_ENVELOPE_SCHEMA = "shared-context/v1" as const;

export type ContextSourceProduct = "ALVIRA" | "ailhat" | "LEDGATo" | "external";
export type ContextSubjectType =
  | "person"
  | "product"
  | "portfolio"
  | "business"
  | "goal"
  | "decision"
  | "domain";
export type ContextType =
  | "fact"
  | "preference"
  | "goal"
  | "constraint"
  | "focus"
  | "evidence"
  | "assertion"
  | "rationale";
export type VerificationStatus =
  | "user-supplied"
  | "observed"
  | "verified"
  | "disputed"
  | "stale";
export type ContextScope = "local" | "shared" | "private";
export type ContextSensitivity = "normal" | "sensitive" | "restricted";

export interface ContextProvenance {
  sourceProduct: ContextSourceProduct;
  sourceId?: string;
  sourceUrl?: string;
  suppliedBy?: "user" | "system" | "connected-source";
  observedAt?: string;
}

export interface ContextRelation {
  subjectType: ContextSubjectType;
  subjectId?: string;
  label?: string;
}

/**
 * Canonical transferable context object shared by ALVIRA and ailhat.
 * Transfer preserves meaning and provenance; receiving products must never
 * silently promote an assertion or user-supplied statement into verified fact.
 */
export interface ContextEnvelope {
  schema: typeof CONTEXT_ENVELOPE_SCHEMA;
  contextId: string;
  createdAt: string;
  updatedAt: string;
  subjectType: ContextSubjectType;
  subjectId?: string;
  contextType: ContextType;
  content: string;
  provenance: ContextProvenance;
  verificationStatus: VerificationStatus;
  confidence?: number;
  sensitivity: ContextSensitivity;
  scope: ContextScope;
  validFrom?: string;
  expiresAt?: string;
  relatedEntities?: ContextRelation[];
  domain?: string;
  extensions?: Record<string, unknown>;
}

export function isContextEnvelope(value: unknown): value is ContextEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ContextEnvelope>;
  return (
    candidate.schema === CONTEXT_ENVELOPE_SCHEMA &&
    typeof candidate.contextId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.subjectType === "string" &&
    typeof candidate.contextType === "string" &&
    typeof candidate.content === "string" &&
    !!candidate.provenance &&
    typeof candidate.verificationStatus === "string" &&
    typeof candidate.sensitivity === "string" &&
    typeof candidate.scope === "string"
  );
}
