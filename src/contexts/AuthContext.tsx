import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api-fetch";
import { persistAuthToken, readAuthToken } from "@/lib/auth-cookie";
import {
  handleSessionExpired,
  invalidateAuthSession,
  redirectToAuth,
  registerAuthStateSync,
} from "@/lib/auth-session";
import { isTokenExpired } from "@/lib/auth-token";
import { isPortalRouteProtected } from "@/lib/require-portal-auth";

interface UserProfile {
  id: number;
  nome: string;
  tipo: string;
}

export interface AuthUser {
  id: number;
  nome: string;
  email: string;
  telefone?: string | null;
  avatar_iniciais?: string | null;
  departamento?: string | null;
  boas_vindas_visto_em?: string | null;
  tipo_usuario?: string | null;
  perfil?: UserProfile | null;
  permissoes?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionChecked: boolean;
  permissoes: string[];
  login: (email: string, password: string) => Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  hasPermission: (pageId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_POLL_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const endExpiredSession = useCallback((redirect = true) => {
    invalidateAuthSession();
    clearSession();
    setIsLoading(false);
    setSessionChecked(true);
    if (redirect && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (isPortalRouteProtected(path)) {
        handleSessionExpired(path);
      }
    }
  }, [clearSession]);

  useEffect(() => registerAuthStateSync({ onClear: clearSession }), [clearSession]);

  useEffect(() => {
    const stored = readAuthToken();
    if (stored && !isTokenExpired(stored)) {
      setToken(stored);
      return;
    }
    if (stored) {
      invalidateAuthSession();
    }
    setIsLoading(false);
    setSessionChecked(true);
  }, []);

  const verifyToken = useCallback(async (t: string, options?: { redirectOnFail?: boolean }) => {
    const redirectOnFail = options?.redirectOnFail ?? true;

    if (isTokenExpired(t)) {
      endExpiredSession(redirectOnFail);
      return false;
    }

    try {
      const res = await apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
        auth: false,
        skipUnauthorizedRedirect: true,
      });
      const data = await res.json();

      if (res.ok && data.ok && data.user) {
        persistAuthToken(t);
        setUser(data.user);
        setToken(t);
        return true;
      }

      endExpiredSession(redirectOnFail);
      return false;
    } catch {
      endExpiredSession(redirectOnFail);
      return false;
    } finally {
      setIsLoading(false);
      setSessionChecked(true);
    }
  }, [endExpiredSession]);

  useEffect(() => {
    if (token) {
      void verifyToken(token);
    }
  }, [token, verifyToken]);

  useEffect(() => {
    if (!sessionChecked || !token) return;

    const checkSessionLocal = () => {
      const t = readAuthToken();
      if (!t || isTokenExpired(t)) {
        endExpiredSession(true);
      }
    };

    const intervalId = window.setInterval(checkSessionLocal, SESSION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const t = readAuthToken();
      if (!t || isTokenExpired(t)) {
        endExpiredSession(true);
        return;
      }
      void verifyToken(t, { redirectOnFail: true });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionChecked, token, endExpiredSession, verifyToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        auth: false,
        skipUnauthorizedRedirect: true,
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.ok && data.token && data.user) {
        persistAuthToken(data.token);
        setToken(data.token);
        setUser(data.user);
        setSessionChecked(true);
        setIsLoading(false);
        return { ok: true, user: data.user as AuthUser };
      }

      return { ok: false, error: data.error || "Falha no login" };
    } catch {
      return { ok: false, error: "Não foi possível conectar ao servidor" };
    }
  }, []);

  const logout = useCallback(() => {
    invalidateAuthSession();
    clearSession();
    setSessionChecked(true);
    setIsLoading(false);
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const t = readAuthToken();
    if (!t) return;
    await verifyToken(t, { redirectOnFail: false });
  }, [verifyToken]);

  const permissoes = useMemo(() => user?.permissoes ?? [], [user?.permissoes]);

  const hasPermission = useCallback(
    (pageId: string) => {
      if (!user) return false;
      if (user.perfil?.tipo === "admin") return true;
      return permissoes.includes(pageId);
    },
    [user, permissoes],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        sessionChecked,
        permissoes,
        login,
        logout,
        refreshUser,
        setUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
