export const PIPELINE_STATUSES = [
  "na_mira",
  "em_analise",
  "vai_participar",
  "proposta_enviada",
  "ganhou",
  "perdeu",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export type PrazoInfo = {
  label: string;
  urgency: "none" | "past" | "critical" | "urgent" | "soon" | "ok";
  days: number | null;
};

export function deadlineInfo(lic: {
  data_abertura?: Date | string | null;
  data_encerramento?: Date | string | null;
}): PrazoInfo {
  const now = Date.now();
  const parse = (d: Date | string | null | undefined) => {
    if (!d) return null;
    const t = new Date(d).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const abertura = parse(lic.data_abertura);
  const encerramento = parse(lic.data_encerramento);
  const pick = encerramento || abertura;
  if (!pick) return { label: "Sem prazo", urgency: "none", days: null };
  const diffMs = pick - now;
  const days = Math.ceil(diffMs / 86400000);
  if (diffMs < 0) return { label: "Prazo encerrado", urgency: "past", days };
  if (days <= 1)
    return {
      label: days === 0 ? "Encerra hoje" : "Encerra amanhã",
      urgency: "critical",
      days,
    };
  if (days <= 3) return { label: `Em ${days} dias`, urgency: "urgent", days };
  if (days <= 7) return { label: `Em ${days} dias`, urgency: "soon", days };
  return { label: `Em ${days} dias`, urgency: "ok", days };
}

export function parseMulti(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function safeDecimal(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function safeDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s;
}

export function buildInClause(
  values: string[],
  prefix: string,
): { sql: string; params: Record<string, string> } {
  if (!values.length) return { sql: "", params: {} };
  const params: Record<string, string> = {};
  const placeholders = values.map((v, i) => {
    const key = `${prefix}${i}`;
    params[key] = v;
    return `:${key}`;
  });
  return { sql: placeholders.join(", "), params };
}
