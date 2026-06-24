import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  firstAllowedAdminPath,
  paginaIdForAdminPath,
} from "@/lib/admin-menu-manifest";

export function AdminPageGuard({ children }: { children: ReactNode }) {
  const { isLoading, hasPermission } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const paginaId = paginaIdForAdminPath(pathname);
  const allowed = !paginaId || hasPermission(paginaId);

  useEffect(() => {
    if (isLoading || allowed) return;

    const fallback = firstAllowedAdminPath(hasPermission);
    toast.error("Sem permissão para esta página", {
      description: "Seu perfil de acesso não inclui este módulo.",
    });

    if (fallback && fallback !== pathname) {
      void navigate({ to: fallback, replace: true });
    } else {
      void navigate({ to: "/", replace: true });
    }
  }, [isLoading, allowed, hasPermission, navigate, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
