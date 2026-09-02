export interface AccessWindowInput {
  role: "owner" | "customer";
  betaExpiresAt?: string | Date | null;
  betaRevokedAt?: string | Date | null;
  now?: number;
}

export function activeFoundingBeta(input: AccessWindowInput): boolean {
  if (input.role === "owner") return false;
  if (input.betaRevokedAt) return false;
  if (!input.betaExpiresAt) return false;
  const expires = new Date(input.betaExpiresAt).getTime();
  return Number.isFinite(expires) && expires > (input.now ?? Date.now());
}

export function productAccessAllowed(input: AccessWindowInput): boolean {
  return input.role === "owner" || activeFoundingBeta(input);
}
