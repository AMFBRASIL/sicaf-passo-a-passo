import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  ScrollText,
  Building2,
  Users,
  DollarSign,
  Scale,
  type LucideIcon,
} from "lucide-react";

export interface LicitacaoStatsBucket {
  label: string;
  count: number;
}

export interface LicitacaoStats {
  total_licitacoes: number;
  total_orgaos: number;
  total_contratos: number;
  total_fornecedores: number;
  valor_estimado_total: number;
  por_lei: LicitacaoStatsBucket[];
  por_esfera: LicitacaoStatsBucket[];
  por_uf: LicitacaoStatsBucket[];
  por_modalidade: LicitacaoStatsBucket[];
  por_origem: LicitacaoStatsBucket[];
}

interface LicitacoesIndicatorsProps {
  stats: LicitacaoStats | null;
  loading?: boolean;
}

const formatNumber = (n: number): string => n.toLocaleString("pt-BR");

const formatCurrency = (n: number): string => {
  if (!n) return "R$ 0";
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(2).replace(".", ",")} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
};

interface BarItem {
  label: string;
  value: number;
  color: string;
}

function HorizontalBarChart({
  title,
  items,
  maxValue,
}: {
  title: string;
  items: BarItem[];
  maxValue: number;
}) {
  return (
    <Card>
      <CardHeader className="px-5 pb-2 pt-4">
        <CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 px-5 pb-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="min-w-[110px] truncate text-right text-xs text-muted-foreground"
                title={item.label}
              >
                {item.label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-muted/60">
                <div
                  className={`h-full rounded ${item.color}`}
                  style={{ width: `${Math.max((item.value / maxValue) * 100, 6)}%` }}
                />
              </div>
              <span className="min-w-[2.5rem] text-right text-xs font-bold text-foreground">
                {formatNumber(item.value)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function IndicatorCard({
  label,
  value,
  Icon,
  bg,
  iconColor,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
}) {
  return (
    <Card className="border border-border/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight text-foreground" title={value}>
            {value}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LicitacoesIndicators({ stats, loading }: LicitacoesIndicatorsProps) {
  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <SkeletonCards count={5} />
        <SkeletonCards count={3} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const lawCount = (label: string) =>
    stats.por_lei.find((l) => (l.label || "").includes(label))?.count || 0;

  const indicators = [
    {
      label: "Licitações",
      value: formatNumber(stats.total_licitacoes),
      Icon: FileText,
      bg: "bg-rose-50 dark:bg-rose-950/40",
      iconColor: "text-rose-400",
    },
    {
      label: "Contratos",
      value: formatNumber(stats.total_contratos),
      Icon: ScrollText,
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: "text-emerald-500",
    },
    {
      label: "Órgãos",
      value: formatNumber(stats.total_orgaos),
      Icon: Building2,
      bg: "bg-amber-50 dark:bg-amber-950/40",
      iconColor: "text-amber-500",
    },
    {
      label: "Fornecedores",
      value: formatNumber(stats.total_fornecedores),
      Icon: Users,
      bg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-500",
    },
    {
      label: "Valor Estimado Total",
      value: formatCurrency(stats.valor_estimado_total),
      Icon: DollarSign,
      bg: "bg-orange-50 dark:bg-orange-950/40",
      iconColor: "text-orange-500",
    },
    {
      label: "Lei 14.133/2021",
      value: formatNumber(lawCount("14.133")),
      Icon: Scale,
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      iconColor: "text-indigo-500",
    },
    {
      label: "Lei 8.666/1993",
      value: formatNumber(lawCount("8.666")),
      Icon: Scale,
      bg: "bg-purple-50 dark:bg-purple-950/40",
      iconColor: "text-purple-500",
    },
    {
      label: "Lei do Pregão",
      value: formatNumber(lawCount("10.520")),
      Icon: Scale,
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
      iconColor: "text-cyan-500",
    },
  ];

  const sphereItems: BarItem[] = stats.por_esfera.map((e, i) => ({
    label: e.label || "—",
    value: e.count,
    color: i === 0 ? "bg-emerald-600" : "bg-emerald-500",
  }));

  const ufItems: BarItem[] = stats.por_uf.slice(0, 5).map((e, i) => ({
    label: e.label || "—",
    value: e.count,
    color:
      ["bg-orange-500", "bg-orange-400", "bg-orange-300", "bg-orange-300", "bg-orange-200"][i] ||
      "bg-orange-200",
  }));

  const modalityItems: BarItem[] = stats.por_modalidade.slice(0, 5).map((e, i) => ({
    label: e.label || "—",
    value: e.count,
    color:
      ["bg-violet-500", "bg-violet-400", "bg-violet-300", "bg-violet-300", "bg-violet-200"][i] ||
      "bg-violet-200",
  }));

  const originItems: BarItem[] = stats.por_origem.map((e, i) => ({
    label: e.label || "—",
    value: e.count,
    color: ["bg-blue-500", "bg-blue-400", "bg-blue-300", "bg-blue-300"][i] || "bg-blue-200",
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {indicators.slice(0, 5).map((ind) => (
          <IndicatorCard key={ind.label} {...ind} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {indicators.slice(5).map((ind) => (
          <IndicatorCard key={ind.label} {...ind} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HorizontalBarChart
          title="Por Origem"
          maxValue={Math.max(...originItems.map((i) => i.value), 1)}
          items={
            originItems.length
              ? originItems
              : [{ label: "PNCP", value: stats.total_licitacoes, color: "bg-blue-500" }]
          }
        />
        <HorizontalBarChart
          title="Por Esfera"
          maxValue={Math.max(...sphereItems.map((i) => i.value), 1)}
          items={sphereItems}
        />
        <HorizontalBarChart
          title="Top UFs"
          maxValue={Math.max(...(ufItems.length ? ufItems.map((i) => i.value) : [1]))}
          items={ufItems}
        />
        <HorizontalBarChart
          title="Top Modalidades"
          maxValue={Math.max(...(modalityItems.length ? modalityItems.map((i) => i.value) : [1]))}
          items={modalityItems}
        />
      </div>
    </div>
  );
}
