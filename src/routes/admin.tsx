import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, LifeBuoy, Settings, LogOut, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditarPerfilModal } from "@/components/editar-perfil-modal";
import { useAuth } from "@/contexts/AuthContext";
import { AdminRouteGuard } from "@/components/admin/admin-route-guard";
import { AdminPageGuard } from "@/components/admin/admin-page-guard";
import { readAuthToken } from "@/lib/auth-cookie";
import { apiUrl } from "@/lib/api-config";
import { invalidateAuthSession } from "@/lib/auth-session";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;

    const token = readAuthToken();
    if (!token) {
      throw redirect({ to: "/auth" });
    }

    const res = await fetch(apiUrl("/api/auth/staff-access"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; isStaff?: boolean };

    if (res.status === 401) {
      invalidateAuthSession();
      throw redirect({ to: "/auth" });
    }

    if (!res.ok || !data.ok || !data.isStaff) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [editarOpen, setEditarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials =
    user?.avatar_iniciais ||
    user?.nome
      ?.split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    "AD";

  return (
    <AdminRouteGuard>
      <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur sm:px-5">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden items-center gap-2 md:flex">
                <Badge variant="secondary" className="rounded-sm">
                  {user?.perfil?.nome ?? "Equipe"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Central de Licitações
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, CNPJ, ticket..."
                  className="h-9 w-72 pl-8 text-sm"
                />
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificações">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Ajuda">
                <LifeBuoy className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="group flex items-center gap-2 rounded-full border border-transparent px-2 py-1 transition-all hover:border-border hover:bg-accent/40 data-[state=open]:border-border data-[state=open]:bg-accent/60"
                  >
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium sm:inline">
                      {user?.nome ?? "Administrador"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.nome ?? "Administrador"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email ?? "—"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setEditarOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Editar dados
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      logout();
                      void navigate({ to: "/auth" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1">
            <AdminPageGuard>
              <Outlet />
            </AdminPageGuard>
          </main>
        </div>
      </div>
      <EditarPerfilModal open={editarOpen} onOpenChange={setEditarOpen} />
    </SidebarProvider>
    </AdminRouteGuard>
  );
}
