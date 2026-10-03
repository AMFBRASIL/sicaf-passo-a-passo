import type { LucideIcon } from "lucide-react";
import {
  Building2,
  FileSearch,
  Flame,
  Gavel,
  Globe,
  HeartHandshake,
  Landmark,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Snowflake,
  Telescope,
  Wrench,
} from "lucide-react";
import type {
  CampanhaStatus,
  FrequenciaRotina,
  ResultadoContato,
  ServicoCaptacaoId,
  TipoSegmento,
} from "@/lib/admin-servicos-captacao-api";

export const ICONE_SERVICO: Record<ServicoCaptacaoId, LucideIcon> = {
  sicaf: ShieldCheck,
  manutencao: Wrench,
  caufesp: Landmark,
  bll: Gavel,
  licitacoes_e: Building2,
  pncp: Globe,
  leitor_ia: FileSearch,
};

export const TIPO_SEGMENTO: Record<
  TipoSegmento,
  { label: string; icon: LucideIcon; classe: string; dica: string }
> = {
  quente: {
    label: "Quente",
    icon: Flame,
    classe: "border-rose-200 bg-rose-50 text-rose-700",
    dica: "Maior chance de compra agora",
  },
  renovacao: {
    label: "Renovação",
    icon: RefreshCw,
    classe: "border-amber-200 bg-amber-50 text-amber-700",
    dica: "Evite perder quem já é cliente",
  },
  recuperacao: {
    label: "Recuperação",
    icon: RotateCcw,
    classe: "border-violet-200 bg-violet-50 text-violet-700",
    dica: "Ex-clientes para reconquistar",
  },
  relacionamento: {
    label: "Relacionamento",
    icon: HeartHandshake,
    classe: "border-sky-200 bg-sky-50 text-sky-700",
    dica: "Clientes atuais: fidelizar e indicar",
  },
  frio: {
    label: "Base fria",
    icon: Snowflake,
    classe: "border-slate-200 bg-slate-50 text-slate-600",
    dica: "Público amplo — use com moderação",
  },
  prospeccao: {
    label: "Prospecção",
    icon: Telescope,
    classe: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dica: "Fornecedores do governo que ainda não são clientes CADBRASIL",
  },
};

export const FREQUENCIA_ROTINA: Record<FrequenciaRotina, string> = {
  uma_vez: "Uma vez",
  diaria: "Todo dia",
  semanal: "Toda semana",
  mensal: "Todo mês",
};

export const STATUS_CAMPANHA: Record<CampanhaStatus, { label: string; classe: string }> = {
  agendada: { label: "Agendada", classe: "border-sky-200 bg-sky-50 text-sky-700" },
  enviando: { label: "Enviando", classe: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pausada: { label: "Pausada", classe: "border-amber-200 bg-amber-50 text-amber-700" },
  concluida: { label: "Concluída", classe: "border-slate-200 bg-slate-50 text-slate-700" },
  cancelada: { label: "Cancelada", classe: "border-rose-200 bg-rose-50 text-rose-700" },
};

export const RESULTADO_CONTATO: Record<ResultadoContato, { label: string; classe: string }> = {
  contatado: { label: "Contatado", classe: "border-slate-200 bg-slate-50 text-slate-700" },
  interessado: {
    label: "Interessado",
    classe: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  sem_interesse: { label: "Sem interesse", classe: "border-rose-200 bg-rose-50 text-rose-700" },
  sem_resposta: { label: "Sem resposta", classe: "border-amber-200 bg-amber-50 text-amber-700" },
  vendido: { label: "Vendido", classe: "border-violet-200 bg-violet-50 text-violet-700" },
};

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export function moeda(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function numero(v: number) {
  return Number(v || 0).toLocaleString("pt-BR");
}

export function dataHora(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function pct(parte: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((parte / total) * 1000) / 10}%`;
}

/** Substitui {{variaveis}} para pré-visualizar scripts de WhatsApp no navegador. */
export function aplicarScript(texto: string, vars: Record<string, string>) {
  return texto.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, k: string) => vars[k.toLowerCase()] ?? m);
}

export function primeiroNome(nome: string) {
  const n = (nome || "").trim().split(/\s+/)[0] || "";
  if (!n) return "Cliente";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
