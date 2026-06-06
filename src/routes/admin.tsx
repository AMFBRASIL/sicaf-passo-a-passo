import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur sm:px-5">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden items-center gap-2 md:flex">
                <Badge variant="secondary" className="rounded-sm">ADMIN</Badge>
                <span className="text-xs text-muted-foreground">
                  Central de Comando CADBRASIL
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
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  AD
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
