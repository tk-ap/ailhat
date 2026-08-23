import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";

export const Route = createFileRoute("/login")({
  component: () => (
    <AuthProvider>
      <Login />
    </AuthProvider>
  ),
});

function Login() {
  const { user, loading, signupOpen, login, signup, logout } = useAuth();
  const navigate = useNavigate();

  // First-login flow: when no owner exists yet we show the signup form (which
  // creates the account AND logs in). Once an owner exists we show login.
  const [mode, setMode] = useState<"signup" | "login">(signupOpen ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Once the auth status resolves, default to the signup form when no owner
  // exists yet (implicit first-login → signup). Never overrides a manual choice.
  useEffect(() => {
    if (!loading && signupOpen && !user) setMode("signup");
  }, [loading, signupOpen, user]);

  if (loading) {
    return (
      <Shell>
        <p className="py-20 text-center text-gray-400">Loading…</p>
      </Shell>
    );
  }

  if (user) {
    return (
      <Shell>
        <div className="mx-auto max-w-md silhat-panel p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-2xl dark:bg-emerald-950">
            ✅
          </div>
          <h1 className="mt-4 text-xl font-bold">You're logged in</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Signed in as <span className="font-medium text-gray-700 dark:text-gray-200">{user.email}</span>.
            Your portfolio is now saved to the server across devices.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/dashboard"
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              Open dashboard
            </Link>
            <button
              onClick={() => void logout()}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Log out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = mode === "signup" ? await signup(email, password) : await login(email, password);
    setSubmitting(false);
    if (res.ok) {
      void navigate({ to: "/dashboard" });
    } else {
      setError(res.error);
    }
  };

  const isSignup = mode === "signup";

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <div className="silhat-panel p-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {isSignup ? "Create your owner account" : "Log in to ailhat"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isSignup
              ? "This is the first account on ailhat. It becomes the owner — portfolio data is then saved server-side."
              : "Your portfolio is saved to your account and synced across devices."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
              <input
                type="password"
                required
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
            >
              {submitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
            </button>
          </form>

          {signupOpen && !isSignup && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No account yet?{" "}
              <button onClick={() => setMode("signup")} className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400">
                Create the owner account
              </button>
            </p>
          )}
          {!signupOpen && isSignup && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              An owner already exists.{" "}
              <button onClick={() => setMode("login")} className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400">
                Log in instead
              </button>
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gray-950 text-gray-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(34,211,238,0.14),transparent_70%)] blur-2xl"
      />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="silhat-brand">A</div>
          <span className="font-bold tracking-tight">ailhat</span>
        </Link>
      </header>
      <main className="relative z-10 px-6 py-12">{children}</main>
    </div>
  );
}
