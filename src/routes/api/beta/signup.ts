import { createFileRoute } from "@tanstack/react-router";
import {
  createSession,
  createUser,
  findUserByEmail,
  hashPassword,
  validateAuthInput,
} from "~/lib/auth";
import { redeemFoundingBetaInvite } from "~/lib/access";
import { sessionCookieForRequest } from "~/lib/request-auth";

export const Route = createFileRoute("/api/beta/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
        }

        const parsed = validateAuthInput(body);
        if (!parsed.ok) {
          return Response.json({ ok: false, error: parsed.error }, { status: 400 });
        }
        const inviteToken =
          typeof body === "object" && body !== null && !Array.isArray(body)
            ? String((body as Record<string, unknown>).inviteToken ?? "").trim()
            : "";
        if (!inviteToken) {
          return Response.json({ ok: false, error: "A Founding Beta invite is required." }, { status: 403 });
        }

        try {
          const existing = await findUserByEmail(parsed.email);
          if (existing) {
            return Response.json(
              { ok: false, error: "That email already has an ailhat account. Log in instead." },
              { status: 409 },
            );
          }

          const user = await createUser(parsed.email, await hashPassword(parsed.password));
          const redeemed = await redeemFoundingBetaInvite(inviteToken, user.email, user.id);
          if (!redeemed) {
            return Response.json(
              { ok: false, error: "That Founding Beta invite is invalid, expired, or belongs to another email." },
              { status: 403 },
            );
          }

          const sessionToken = await createSession(user.id);
          return Response.json(
            { ok: true, user },
            {
              status: 200,
              headers: { "set-cookie": sessionCookieForRequest(request, sessionToken) },
            },
          );
        } catch (error) {
          console.error("founding beta signup failed:", error);
          return Response.json(
            { ok: false, error: "We couldn't create your Founding Beta account right now." },
            { status: 503 },
          );
        }
      },
    },
  },
});
