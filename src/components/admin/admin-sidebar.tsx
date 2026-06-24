import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  HandCoins,
  FileCheck2,
  FolderOpen,
  Ticket,
  PhoneCall,
  TrendingUp,
  Bot,
  UserCog,
  BarChart3,
  BellRing,
  Filter,
  Brain,
  ScrollText,
  Settings2,
  Shield,
  Building2,
  Cog,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const operacional = [
  { title: "Dashboard Executivo", url: "/admin", icon: LayoutDashboard },
  { title: "Gestão de Clientes", url: "/admin/clientes", icon: Users },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
  { title: "Cobrança", url: "/admin/cobranca", icon: HandCoins },
  { title: "Gestão SICAF", url: "/admin/sicaf", icon: FileCheck2 },
  { title: "Documentos", url: "/admin/documentos", icon: FolderOpen },
];

const atendimento = [
  { title: "Suporte (Kanban)", url: "/admin/suporte", icon: Ticket },
  { title: "Central de Atendimento", url: "/admin/atendimento", icon: PhoneCall },
  { title: "Central de Alertas", url: "/admin/alertas", icon: BellRing },
];

const inteligencia = [
  { title: "Google Ads", url: "/admin/google-ads", icon: TrendingUp },
  { title: "Processos", url: "/admin/processos", icon: Cog },
  { title: "Funil Comercial", url: "/admin/funil", icon: Filter },
  { title: "IA Gerencial", url: "/admin/ia", icon: Brain },
  { title: "Automações", url: "/admin/automacoes", icon: Bot },
];

const gestao = [
  { title: "Gestão de Equipe", url: "/admin/equipe", icon: UserCog },
  { title: "Gestão de Perfis", url: "/admin/perfis", icon: Shield },
  { title: "Relatórios", url: "/admin/relatorios", icon: BarChart3 },
  { title: "Auditoria", url: "/admin/auditoria", icon: ScrollText },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings2 },
];

function Group({
  label,
  items,
  currentPath,
  collapsed,
}: {
  label: string;
  items: { title: string; url: string; icon: any }[];
  currentPath: string;
  collapsed: boolean;
}) {
  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = currentPath === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">CADBRASIL</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Central de Comando
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Operação" items={operacional} currentPath={currentPath} collapsed={collapsed} />
        <Group label="Atendimento" items={atendimento} currentPath={currentPath} collapsed={collapsed} />
        <Group label="Inteligência" items={inteligencia} currentPath={currentPath} collapsed={collapsed} />
        <Group label="Gestão" items={gestao} currentPath={currentPath} collapsed={collapsed} />
      </SidebarContent>
    </Sidebar>
  );
}
