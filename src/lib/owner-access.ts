import type { AuthUser } from "~/lib/useAuth";

/**
 * Current single-owner auth model: the first account created is the owner.
 * Keep this rule centralized so it can be replaced by persisted roles/tenant
 * membership without changing every owner-only surface.
 */
export function isOwnerUser(user: AuthUser | null | undefined): boolean {
  return user?.id === 1;
}
