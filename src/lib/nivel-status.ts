import type { NivelStatus } from "@/components/admin/nivel-dots";

const ROMAN_TO_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
const ENABLED_HEADER_LEVELS = new Set(["I", "II", "V", "VI"]);

function normalizeStatusText(status: string) {
  return String(status || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Converte status do banco (Válido, Regular, Habilitado…) para UI. */
export function mapNivelStatusFromRaw(raw?: string | null): NivelStatus {
  const s = normalizeStatusText(raw || "");
  if (!s || s.includes("nao informado") || s === "nao_cadastrado") return "nao_cadastrado";
  if (s.includes("valid") || s.includes("habilit") || s.includes("regular") || s.includes("ativo")) {
    return "validado";
  }
  if (s.includes("vencendo") || s.includes("a vencer")) return "vencendo";
  if (s.includes("vencid") || s.includes("expirad")) return "vencido";
  if (s.includes("pend") || s.includes("parcial")) return "pendente";
  return "nao_cadastrado";
}

export function rawStatusFromEvidencia(nivel: string, status: string, habilitado: boolean): string {
  if (!habilitado) return "Não informado";
  let raw = status || "Válido";
  if (ENABLED_HEADER_LEVELS.has(nivel) && raw === "Pendente") raw = "Habilitado";
  return raw;
}

/** Converte status exibido do painel SICAF para chave usada nas regras de /empresas. */
export function mapSicafPainelStatus(status?: string | null): string {
  const s = String(status || "");
  if (!s || s === "Sem SICAF") return "sem_cadastro";
  if (s === "Ativo") return "ativo";
  if (s === "Vencendo") return "atencao";
  if (s === "Vencido") return "vencido";
  return "sem_cadastro";
}

/** I e II seguem a mesma regra de /empresas quando há 2+ níveis com situação positiva. */
export function applyNiveisDisplayRules(
  niveis: Record<number, NivelStatus>,
  opts?: { sicaf?: string },
): Record<number, NivelStatus> {
  const positivos = Object.values(niveis).filter(
    (s) => s === "validado" || s === "vencendo" || s === "pendente",
  ).length;
  if (positivos < 2 || opts?.sicaf === "sem_cadastro") return niveis;

  const out = { ...niveis };
  const baseStatus: NivelStatus =
    opts?.sicaf === "vencido" ? "vencido" : opts?.sicaf === "atencao" ? "vencendo" : "validado";
  for (const num of [1, 2] as const) {
    out[num] = baseStatus;
  }
  return out;
}

/** Estilo das bolhas de nível — alinhado a NiveisSicafBadges em /empresas. */
export function nivelBolinhaVisual(status: NivelStatus, nivelColor: string) {
  if (status === "nao_cadastrado") {
    return {
      circleClass: "bg-muted-foreground/20 text-muted-foreground",
      circleStyle: undefined,
      ring: "ring-border/60",
      badgeDot: "bg-muted-foreground/40",
    };
  }

  const badgeByStatus: Record<Exclude<NivelStatus, "nao_cadastrado">, string> = {
    validado: "bg-success",
    vencendo: "bg-warning",
    vencido: "bg-danger",
    pendente: "bg-warning",
  };
  const ringByStatus: Record<Exclude<NivelStatus, "nao_cadastrado">, string> = {
    validado: "ring-success/30",
    vencendo: "ring-warning/40",
    vencido: "ring-danger/40",
    pendente: "ring-warning/40",
  };

  return {
    circleClass: "text-white shadow-sm",
    circleStyle: { backgroundColor: nivelColor } as const,
    ring: ringByStatus[status],
    badgeDot: badgeByStatus[status],
  };
}

export function mapNiveisFromDetail(
  niveisDetail?: Record<string, { status: string; observacao?: string }>,
  opts?: { sicaf?: string },
): Record<number, NivelStatus> {
  const out: Record<number, NivelStatus> = {
    1: "nao_cadastrado",
    2: "nao_cadastrado",
    3: "nao_cadastrado",
    4: "nao_cadastrado",
    5: "nao_cadastrado",
    6: "nao_cadastrado",
  };
  if (!niveisDetail) return out;

  for (const [key, info] of Object.entries(niveisDetail)) {
    const num = ROMAN_TO_NUM[key] ?? (Number.isFinite(Number(key)) ? Number(key) : null);
    if (!num || num < 1 || num > 6) continue;
    const raw = String(info.status || "");
    const alreadyUi = ["validado", "vencendo", "vencido", "pendente", "nao_cadastrado"].includes(raw);
    out[num] = alreadyUi ? (raw as NivelStatus) : mapNivelStatusFromRaw(raw);
  }

  return applyNiveisDisplayRules(out, opts);
}

export function mapNiveisFromEvidencias(
  evidencias: { nivel: string; habilitado?: boolean; status?: string }[],
  opts?: { sicaf?: string },
): Record<number, NivelStatus> {
  const out: Record<number, NivelStatus> = {
    1: "nao_cadastrado",
    2: "nao_cadastrado",
    3: "nao_cadastrado",
    4: "nao_cadastrado",
    5: "nao_cadastrado",
    6: "nao_cadastrado",
  };

  for (const ev of evidencias) {
    const num = ROMAN_TO_NUM[ev.nivel];
    if (!num) continue;
    if (!ev.habilitado) {
      out[num] = "nao_cadastrado";
      continue;
    }
    const raw = rawStatusFromEvidencia(ev.nivel, ev.status || "", true);
    out[num] = mapNivelStatusFromRaw(raw);
  }

  return applyNiveisDisplayRules(out, opts);
}

export function countNiveisValidadosUi(niveis: Record<number, NivelStatus>): number {
  return Object.values(niveis).filter((s) => s === "validado").length;
}

export function todosNiveisValidadosUi(niveis: Record<number, NivelStatus>): boolean {
  return countNiveisValidadosUi(niveis) >= 6;
}

export function countNiveisComDadosUi(niveis: Record<number, NivelStatus>): number {
  return Object.values(niveis).filter((s) => s !== "nao_cadastrado").length;
}
