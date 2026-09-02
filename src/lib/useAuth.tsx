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

export interface ClientAccountAccess {
  role: "owner" | "customer";
  planKey: string;
  planStatus: string;
  foundingBeta: boolean;
  betaExpiresAt: string | null;
  productAccess: boolean;
  accessReason: "owner" | "founding_beta" | "beta_expired_or_not_granted";
}

interface AuthStatus {
  authed: boolean;
  user: AuthUser | null;
  signupOpen: boolean;
  access: ClientAccountAccess | null;
}

type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthCtx extends AuthStatus {
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);
const EMPTY: AuthStatus = { authed: false, user: null, signupOpen: false, access: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(EMPTY);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      if (!res.ok) {
        if (alive.current) setStatus(EMPTY);
        return;
      }
      const data = (await res.json()) as Omit<AuthStatus, "access">;
      let access: ClientAccountAccess | null = null;
      if (data.authed && data.user) {
        try {
          const accessResponse = await fetch("/api/access", { cache: "no-store" });
          if (accessResponse.ok) {
            const accessData = (await accessResponse.json()) as { access?: ClientAccountAccess };
            access = accessData.access ?? null;
          }
        } catch {
          access = null;
        }
      }
      if (alive.current) setStatus({ ...data, access });
    } catch {
      if (alive.current) setStatus(EMPTY);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok) {
      await refresh();
      return { ok: true };
    }
    return { ok: false, error: data.error ?? "Login failed. Please try again." };
  }, [refresh]);

  const signup = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok) {
      await refresh();
      return { ok: true };
    }
    return { ok: false, error: data.error ?? "Signup failed. Please try again." };
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* clear locally anyway */ }
    await refresh();
  }, [refresh]);

  return <AuthContext.Provider value={{ ...status, loading, refresh, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
