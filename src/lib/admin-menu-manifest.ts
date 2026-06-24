import type { LucideIcon } from "lucide-react";
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
  Cog,
} from "lucide-react";

export type AdminMenuCategory = "Operação" | "Atendimento" | "Inteligência" | "Gestão";

export type AdminMenuItem = {
  paginaId: string;
  title: string;
  url: string;
  category: AdminMenuCategory;
  icon: LucideIcon;
};

/** Alinhado a backend/sicaf-agent/services/admin-menus-sync.service.js */
export const ADMIN_MENU_MANIFEST: AdminMenuItem[] = [
  { paginaId: "dashboard", title: "Dashboard Executivo", url: "/admin", category: "Operação", icon: LayoutDashboard },
  { paginaId: "clients", title: "Gestão de Clientes", url: "/admin/clientes", category: "Operação", icon: Users },
  { paginaId: "financeiro", title: "Financeiro", url: "/admin/financeiro", category: "Operação", icon: DollarSign },
  { paginaId: "cobranca", title: "Cobrança", url: "/admin/cobranca", category: "Operação", icon: HandCoins },
  { paginaId: "sicaf", title: "Gestão SICAF", url: "/admin/sicaf", category: "Operação", icon: FileCheck2 },
  { paginaId: "documents", title: "Documentos", url: "/admin/documentos", category: "Operação", icon: FolderOpen },
  { paginaId: "tickets-admin", title: "Suporte (Kanban)", url: "/admin/suporte", category: "Atendimento", icon: Ticket },
  { paginaId: "atendimento", title: "Central de Atendimento", url: "/admin/atendimento", category: "Atendimento", icon: PhoneCall },
  { paginaId: "alerts", title: "Central de Alertas", url: "/admin/alertas", category: "Atendimento", icon: BellRing },
  { paginaId: "google-ads-tracking", title: "Google Ads", url: "/admin/google-ads", category: "Inteligência", icon: TrendingUp },
  { paginaId: "processos", title: "Processos", url: "/admin/processos", category: "Inteligência", icon: Cog },
  { paginaId: "funil", title: "Funil Comercial", url: "/admin/funil", category: "Inteligência", icon: Filter },
  { paginaId: "ia-gerencial", title: "IA Gerencial", url: "/admin/ia", category: "Inteligência", icon: Brain },
  { paginaId: "automacoes", title: "Automações", url: "/admin/automacoes", category: "Inteligência", icon: Bot },
  { paginaId: "system-users", title: "Gestão de Equipe", url: "/admin/equipe", category: "Gestão", icon: UserCog },
  { paginaId: "access-profiles", title: "Gestão de Perfis", url: "/admin/perfis", category: "Gestão", icon: Shield },
  { paginaId: "reports", title: "Relatórios", url: "/admin/relatorios", category: "Gestão", icon: BarChart3 },
  { paginaId: "auditoria", title: "Auditoria", url: "/admin/auditoria", category: "Gestão", icon: ScrollText },
  { paginaId: "settings", title: "Configurações", url: "/admin/configuracoes", category: "Gestão", icon: Settings2 },
];

export const ADMIN_MENU_CATEGORIES: AdminMenuCategory[] = [
  "Operação",
  "Atendimento",
  "Inteligência",
  "Gestão",
];

export function paginaIdForAdminPath(pathname: string): string | null {
  const path = pathname.replace(/\/$/, "") || "/admin";

  const exact = ADMIN_MENU_MANIFEST.find((m) => m.url === path);
  if (exact) return exact.paginaId;

  const nested = [...ADMIN_MENU_MANIFEST]
    .filter((m) => m.url !== "/admin")
    .sort((a, b) => b.url.length - a.url.length)
    .find((m) => path.startsWith(`${m.url}/`));

  return nested?.paginaId ?? null;
}

export function filterAdminMenu(hasPermission: (pageId: string) => boolean): AdminMenuItem[] {
  return ADMIN_MENU_MANIFEST.filter((item) => hasPermission(item.paginaId));
}

export function groupAdminMenu(items: AdminMenuItem[]): Partial<Record<AdminMenuCategory, AdminMenuItem[]>> {
  const groups: Partial<Record<AdminMenuCategory, AdminMenuItem[]>> = {};
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category]!.push(item);
  }
  return groups;
}

export function firstAllowedAdminPath(hasPermission: (pageId: string) => boolean): string | null {
  const item = ADMIN_MENU_MANIFEST.find((m) => hasPermission(m.paginaId));
  return item?.url ?? null;
}
