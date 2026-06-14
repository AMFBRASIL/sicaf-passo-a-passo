import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Headphones,
  FileSignature,
  HelpCircle,
  ShieldCheck,
  Building2,
  Gavel,
  Sparkles,
  Gauge,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Minhas Empresas", url: "/empresas", icon: Building2 },
  { title: "Prontidão", url: "/prontidao", icon: Gauge },
  { title: "Licitações", url: "/licitacoes", icon: Gavel },
  { title: "Serviços com IA", url: "/servicos-ia", icon: Sparkles },
  { title: "Meus Serviços", url: "/servicos", icon: FileSignature },
  { title: "Suporte", url: "/suporte", icon: Headphones },
  { title: "Central de Ajuda", url: "/ajuda", icon: HelpCircle },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const nomeUsuario = user?.nome?.trim() || "Usuário";
  const emailUsuario = user?.email?.trim();

  const handleLogout = () => {
    logout();
    void navigate({ to: "/auth" });
  };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-sidebar-foreground">CADBRASIL</span>
            <span className="text-[11px] text-sidebar-foreground/70">Portal do Fornecedor</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={handleLogout}
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Sair</TooltipContent>
          </Tooltip>
          <div className="min-w-0 flex-1 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            <p className="font-medium text-sidebar-foreground/90 truncate" title={nomeUsuario}>
              {nomeUsuario}
            </p>
            {emailUsuario ? (
              <p className="mt-0.5 truncate" title={emailUsuario}>
                {emailUsuario}
              </p>
            ) : (
              <p className="mt-0.5">Conta do fornecedor</p>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
