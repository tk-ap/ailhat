// Client-side auth state for Ailhat. Talks to the plain REST auth endpoints in
// serve.ts using fetch() (same-origin), reading the httpOnly session cookie that
// the browser sends automatically. SSR-safe: no browser globals at import time.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
}

interface AuthStatus {
  authed: boolean;
  user: AuthUser | null;
  signupOpen: boolean; // users table empty -> first-run signup allowed
}

type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

interface AuthCtx extends AuthStatus {
  /** True until the initial /api/auth/status check has resolved. */
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>({
    authed: false,
    user: null,
    signupOpen: false,
  });
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      if (!res.ok) {
        if (alive.current) setStatus({ authed: false, user: null, signupOpen: false });
        return;
      }
      const data = (await res.json()) as AuthStatus;
      if (alive.current) setStatus(data);
    } catch {
      if (alive.current) setStatus({ authed: false, user: null, signupOpen: false });
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok) {
        await refresh();
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "Login failed. Please try again." };
    },
    [refresh],
  );

  const signup = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok) {
        await refresh();
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "Signup failed. Please try again." };
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the network call fails, clear client state.
    }
    await refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...status, loading, refresh, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
