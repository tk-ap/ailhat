import type { ClientAccountAccess } from "~/lib/useAuth";

export default function ProductAccessBlocked({ access, onLogout }: { access: ClientAccountAccess | null; onLogout: () => void }) {
  const betaDate = access?.betaExpiresAt ? new Date(access.betaExpiresAt).toLocaleDateString() : null;
  return (
    <div className="min-h-dvh bg-gray-950 px-6 py-16 text-gray-100">
      <section className="silhat-panel mx-auto max-w-xl p-8 text-center">
        <p className="silhat-eyebrow">Account active · product access inactive</p>
        <h1 className="mt-2 text-2xl font-bold">Your Founding Beta access is not active.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          Your login identity still exists, but ailhat will not load portfolio, evidence, Direct, or connection data without an active entitlement.{betaDate ? ` The most recent beta window ended on ${betaDate}.` : ""}
        </p>
        <p className="mt-3 text-xs leading-5 text-gray-600">No cached portfolio is shown while access is inactive. A later access grant can restore the same account and its server-side portfolio.</p>
        <div className="mt-6 flex justify-center gap-2">
          <a href="/" className="silhat-btn silhat-btn-ghost">Public site</a>
          <button type="button" onClick={onLogout} className="silhat-btn silhat-btn-primary">Log out</button>
        </div>
      </section>
    </div>
  );
}
