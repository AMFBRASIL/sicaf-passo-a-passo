import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffUser } from "@/lib/auth-roles";
import { fetchStaffAccess } from "@/lib/staff-access-api";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [accessChecked, setAccessChecked] = useState(false);
  const [staffAllowed, setStaffAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      if (isLoading) return;

      if (!isAuthenticated) {
        void navigate({ to: "/auth" });
        return;
      }

      if (!isStaffUser(user)) {
        toast.error("Acesso negado", {
          description: "Esta área é restrita à equipe administrativa.",
        });
        void navigate({ to: "/" });
        setAccessChecked(true);
        setStaffAllowed(false);
        return;
      }

      try {
        const res = await fetchStaffAccess();
        if (cancelled) return;

        if (!res.ok || !res.isStaff) {
          toast.error("Acesso negado", {
            description:
              res.perfilTipo === "cliente"
                ? "Seu perfil de acesso é Cliente — use o portal do fornecedor."
                : "Esta área é restrita à equipe administrativa.",
          });
          setStaffAllowed(false);
          void navigate({ to: "/" });
        } else {
          setStaffAllowed(true);
        }
      } catch {
        if (!cancelled) {
          toast.error("Não foi possível validar seu acesso ao painel administrativo.");
          setStaffAllowed(false);
          void navigate({ to: "/" });
        }
      } finally {
        if (!cancelled) setAccessChecked(true);
      }
    }

    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !accessChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!staffAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
