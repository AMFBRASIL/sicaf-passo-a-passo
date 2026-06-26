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
import { invalidateAuthSession, redirectToAuth, registerAuthStateSync } from "@/lib/auth-session";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => registerAuthStateSync({ onClear: clearSession }), [clearSession]);

  useEffect(() => {
    const stored = readAuthToken();
    if (stored) {
      setToken(stored);
      return;
    }
    setIsLoading(false);
    setSessionChecked(true);
  }, []);

  const verifyToken = useCallback(async (t: string, options?: { redirectOnFail?: boolean }) => {
    const redirectOnFail = options?.redirectOnFail ?? true;
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

      invalidateAuthSession();
      clearSession();
      if (redirectOnFail) redirectToAuth();
      return false;
    } catch {
      invalidateAuthSession();
      clearSession();
      if (redirectOnFail) redirectToAuth();
      return false;
    } finally {
      setIsLoading(false);
      setSessionChecked(true);
    }
  }, [clearSession]);

  useEffect(() => {
    if (token) {
      void verifyToken(token);
    }
  }, [token, verifyToken]);

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
