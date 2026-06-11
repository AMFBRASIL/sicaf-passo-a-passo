import { apiFetch } from "@/lib/api-fetch";

export type AdminDashboardAlert = {
  tipo: string;
  cliente: string;
  em: string;
  tom: "emerald" | "blue" | "amber" | "rose" | "violet" | "sky";
};

export type AdminDashboardExecutive = {
  faturamento: {
    hoje: number;
    ontem: number;
    mes: number;
    mesAnterior: number;
    changeHoje: number;
    changeMes: number;
    chart7d: { d: string; v: number }[];
    total7d: number;
  };
  novosClientes: {
    hoje: number;
    mes: number;
    pagos: number;
    pendentes: number;
  };
  sicaf: {
    atualizados: number;
    meta: number;
    pendentes: number;
    vencendo7d: number;
    amarelo: number;
    vermelho: number;
  };
  tickets: {
    abertos: number;
    foraSla: number;
  };
  chamadasPendentes: {
    total: number;
    changeOntem: number;
  };
  googleAds: {
    conversao: number;
    roas: number | null;
    sessions: number;
    converted: number;
  };
  boletosVencidos: {
    valor: number;
    clientes: number;
  };
  certidoesVencidas: {
    total: number;
    changeSemana: number;
  };
  funil: { etapa: string; v: number }[];
  alertas: AdminDashboardAlert[];
  palavras: { palavra: string; clicks: number; pagos: number; receita: number }[];
  equipe: { nome: string; tickets: number; sla: string; mediaMin: number }[];
};

export type AdminDashboardResponse = {
  ok: boolean;
  error?: string;
  todayLabel?: string;
  executive?: AdminDashboardExecutive;
};

export async function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  const res = await apiFetch("/api/admin/dashboard");
  const data = (await res.json()) as AdminDashboardResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Erro ao carregar dashboard");
  }
  return data;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDeltaPct(change: number, label: string): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toLocaleString("pt-BR")}% ${label}`;
}

export function trendFromChange(change: number): "up" | "down" | "flat" {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

export function formatMediaMin(min: number): string {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function shortName(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length <= 1) return nome;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
