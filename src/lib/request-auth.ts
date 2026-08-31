import {
  SESSION_COOKIE,
  findUserByToken,
  parseCookies,
  type AuthUser,
} from "./auth";
import { isOwnerEmail } from "./access";

export async function requestUser(request: Request): Promise<AuthUser | null> {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE] ?? "";
  return token ? findUserByToken(token) : null;
}

export async function requireRequestUser(request: Request): Promise<AuthUser> {
  const user = await requestUser(request);
  if (!user) throw new Error("not_authenticated");
  return user;
}

export async function requireRequestOwner(request: Request): Promise<AuthUser> {
  const user = await requireRequestUser(request);
  if (!isOwnerEmail(user.email)) throw new Error("owner_required");
  return user;
}

export function sessionCookieForRequest(request: Request, token: string): string {
  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  const maxAge = 30 * 24 * 60 * 60;
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
    (secure ? "; Secure" : "")
  );
}
