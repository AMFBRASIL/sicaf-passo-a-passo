import { Link, useRouterState } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import {
  ADMIN_MENU_CATEGORIES,
  filterAdminMenu,
  groupAdminMenu,
  type AdminMenuItem,
} from "@/lib/admin-menu-manifest";

function Group({
  label,
  items,
  currentPath,
  collapsed,
}: {
  label: string;
  items: AdminMenuItem[];
  currentPath: string;
  collapsed: boolean;
}) {
  if (!items.length) return null;

  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              currentPath === item.url ||
              (item.url !== "/admin" && currentPath.startsWith(`${item.url}/`));
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
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
  const { hasPermission } = useAuth();

  const visibleItems = filterAdminMenu(hasPermission);
  const groups = groupAdminMenu(visibleItems);

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight text-white">
              <span className="text-sm font-extrabold tracking-tight">
                CADBRASIL | Oficial
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Central de Licitações
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {ADMIN_MENU_CATEGORIES.map((category) => (
          <Group
            key={category}
            label={category}
            items={groups[category] ?? []}
            currentPath={currentPath}
            collapsed={collapsed}
          />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
