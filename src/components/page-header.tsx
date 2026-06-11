import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PAGE_CONTAINER_CLASS =
  "w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10";

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(PAGE_CONTAINER_CLASS, className)}>{children}</div>;
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && (
            <div className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatusDot({ status }: { status: "ok" | "warn" | "danger" | "idle" }) {
  const map = {
    ok: "bg-success",
    warn: "bg-warning",
    danger: "bg-danger",
    idle: "bg-muted-foreground/30",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[status]}`} />;
}

export function StatusBadge({
  status,
  children,
}: {
  status: "ok" | "warn" | "danger" | "idle";
  children: ReactNode;
}) {
  const map = {
    ok: "bg-success/10 text-success border-success/20",
    warn: "bg-warning/15 text-warning-foreground border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/20",
    idle: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      <StatusDot status={status} />
      {children}
    </span>
  );
}
