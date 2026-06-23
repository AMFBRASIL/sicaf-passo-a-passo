import type { AssistantAlert } from "@/components/assistant-card";
import type { Tarefa } from "@/components/central-tarefas";
import type { EmpresaData } from "@/lib/empresas-shared";
import { isEmpresaApto } from "@/lib/empresas-shared";
import type { EmpresaProntidao } from "@/lib/prontidao-api";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;

export type EmpresaHomeResumo = {
  id: string;
  nome: string;
  cnpj: string;
  score: number;
  nivel: string;
  status: "ok" | "warn" | "danger";
  statusLabel: string;
  alertas: number;
  clienteId?: number;
};

export type AlertaPortfolio = {
  empresa: string;
  cnpj: string;
  tipo: string;
  quando: string;
  severidade: "danger" | "warn";
};

export type AtividadePortfolio = {
  tone: "success" | "primary" | "warn";
  texto: string;
  tempo: string;
};

export function firstName(nome?: string | null): string {
  if (!nome?.trim()) return "usuário";
  return nome.trim().split(/\s+/)[0] ?? "usuário";
}

function nivelLabel(n: number): string {
  if (n <= 0) return "Sem níveis";
  return `Nível ${ROMAN[n] ?? n}`;
}

function prontidaoByCnpj(empresas: EmpresaProntidao[]): Map<string, EmpresaProntidao> {
  const map = new Map<string, EmpresaProntidao>();
  for (const e of empresas) {
    map.set(e.cnpj.replace(/\D/g, ""), e);
  }
  return map;
}

function certAlertasVisiveis(p?: EmpresaProntidao): number {
  if (!p) return 0;
  if (p.certidoes.alertaCentral != null) return p.certidoes.alertaCentral;
  return (p.certidoes.danger ?? 0) + (p.certidoes.warn ?? 0);
}

/** Certidões vencidas/ausentes visíveis na central (sempre todas). */
function certDangerCentral(p?: EmpresaProntidao): number {
  if (!p) return 0;
  if (p.certidoes.alertaCentralDanger != null) return p.certidoes.alertaCentralDanger;
  if (p.certidoes.alertaCentral != null) {
    return Math.max(0, p.certidoes.alertaCentral - (p.certidoes.alertaCentralWarn ?? 0));
  }
  return p.certidoes.danger ?? 0;
}

/** Certidões vencendo dentro da janela configurada em Admin → SICAF. */
function certWarnCentral(p?: EmpresaProntidao): number {
  if (!p) return 0;
  if (p.certidoes.alertaCentralWarn != null) return p.certidoes.alertaCentralWarn;
  return p.certidoes.warn ?? 0;
}

export function buildEmpresasResumo(
  empresas: EmpresaData[],
  prontidao: EmpresaProntidao[],
): EmpresaHomeResumo[] {
  const byDoc = prontidaoByCnpj(prontidao);

  return empresas.map((e) => {
    const doc = e.cnpj.replace(/\D/g, "");
    const p = byDoc.get(doc);
    const apto = isEmpresaApto(e);
    const alertas = certAlertasVisiveis(p);
    const sicafSt = p?.sicaf.status ?? (e.sicaf === "ativo" ? "ok" : e.sicaf === "atencao" ? "warn" : "danger");

    let statusLabel = apto ? "APTA" : "INAPTA";
    if (e.taxaPendente || e.sicaf === "sem_cadastro") statusLabel = "Taxa pendente";
    else if (e.sicaf === "vencido") statusLabel = "SICAF vencido";
    else if (e.sicaf === "atencao") statusLabel = "SICAF vencendo";
    else if (alertas > 0) statusLabel = `${alertas} alerta${alertas > 1 ? "s" : ""}`;

    return {
      id: String(e.clienteId ?? doc),
      nome: e.nome,
      cnpj: e.cnpj,
      score: p?.score ?? (apto ? 70 : 35),
      nivel: nivelLabel(p?.sicaf.nivel ?? 0),
      status: sicafSt,
      statusLabel,
      alertas,
      clienteId: e.clienteId,
    };
  });
}

export function buildTarefas(empresas: EmpresaData[], prontidao: EmpresaProntidao[]): Tarefa[] {
  const byDoc = prontidaoByCnpj(prontidao);
  const tarefas: Tarefa[] = [];

  for (const e of empresas) {
    const p = byDoc.get(e.cnpj.replace(/\D/g, ""));
    const cnpj = e.cnpj;

    if (e.taxaPendente || e.sicaf === "sem_cadastro" || e.sicaf === "vencido") {
      tarefas.push({
        id: `taxa-${cnpj}`,
        prioridade: "urgente",
        titulo: e.sicaf === "vencido" ? "Renovar taxa SICAF" : "Pagar taxa CADBRASIL",
        descricao: e.proximoPasso,
        empresa: e.nome,
        acaoLabel: "Ir para pagamento",
        link: "/sicaf",
        linkSearch: { cnpj },
        tempoEstimado: "2 min",
      });
      continue;
    }

    const dangerCentral = certDangerCentral(p);
    if (dangerCentral > 0) {
      tarefas.push({
        id: `cert-${cnpj}`,
        prioridade: "urgente",
        titulo: "Regularizar certidões",
        descricao: `${dangerCentral} certidão(ões) vencida(s) ou ausente(s).`,
        empresa: e.nome,
        acaoLabel: "Renovar agora",
        link: "/certidoes",
        linkSearch: { cnpj },
        tempoEstimado: "5 min",
      });
    } else {
      const warnCentral = certWarnCentral(p);
      if (warnCentral > 0) {
        tarefas.push({
          id: `cert-warn-${cnpj}`,
          prioridade: "atencao",
          titulo: "Certidões vencendo em breve",
          descricao: `${warnCentral} certidão(ões) precisam de atenção.`,
          empresa: e.nome,
          acaoLabel: "Ver certidões",
          link: "/certidoes",
          linkSearch: { cnpj },
          tempoEstimado: "5 min",
        });
      }
    }

    if (e.sicaf === "atencao") {
      tarefas.push({
        id: `sicaf-${cnpj}`,
        prioridade: "atencao",
        titulo: "SICAF próximo do vencimento",
        descricao: e.validade ? `Validade ${e.validade}.` : e.proximoPasso,
        empresa: e.nome,
        acaoLabel: "Atualizar SICAF",
        link: "/sicaf",
        linkSearch: { cnpj },
        tempoEstimado: "12 min",
      });
    }

    if (!isEmpresaApto(e) && e.sicaf === "ativo") {
      tarefas.push({
        id: `apto-${cnpj}`,
        prioridade: "info",
        titulo: "Sincronizar níveis SICAF",
        descricao: "Envie a Situação do Fornecedor pelo Assistente para ficar APTO.",
        empresa: e.nome,
        acaoLabel: "Abrir Assistente",
        link: "/assistente",
        linkSearch: { cnpj },
        tempoEstimado: "8 min",
      });
    } else if ((p?.sicaf.nivel ?? 0) < 6 && e.sicaf === "ativo" && isEmpresaApto(e)) {
      tarefas.push({
        id: `nivel-${cnpj}`,
        prioridade: "info",
        titulo: "Ampliar níveis SICAF",
        descricao: p?.acao ?? "Complete níveis para concorrer em mais editais.",
        empresa: e.nome,
        acaoLabel: "Concluir cadastro",
        link: "/sicaf",
        linkSearch: { cnpj },
        tempoEstimado: "8 min",
      });
    }
  }

  const order = { urgente: 0, atencao: 1, info: 2 } as const;
  return tarefas.sort((a, b) => order[a.prioridade] - order[b.prioridade]).slice(0, 6);
}

export function buildAlertasPortfolio(
  empresas: EmpresaData[],
  prontidao: EmpresaProntidao[],
): AlertaPortfolio[] {
  const byDoc = prontidaoByCnpj(prontidao);
  const alertas: AlertaPortfolio[] = [];

  for (const e of empresas) {
    const p = byDoc.get(e.cnpj.replace(/\D/g, ""));
    if (e.sicaf === "vencido") {
      alertas.push({
        empresa: e.nome,
        cnpj: e.cnpj,
        tipo: "SICAF vencido",
        quando: e.validade ? `Venceu em ${e.validade}` : "Regularize agora",
        severidade: "danger",
      });
    } else if (e.sicaf === "atencao") {
      alertas.push({
        empresa: e.nome,
        cnpj: e.cnpj,
        tipo: "SICAF expirando",
        quando: e.validade ? `Validade ${e.validade}` : "Atualize em breve",
        severidade: "warn",
      });
    }
    const dangerCentral = certDangerCentral(p);
    if (dangerCentral > 0) {
      alertas.push({
        empresa: e.nome,
        cnpj: e.cnpj,
        tipo: `${dangerCentral} certidão(ões) irregular(es)`,
        quando: "Ação imediata",
        severidade: "danger",
      });
    } else {
      const warnCentral = certWarnCentral(p);
      if (warnCentral > 0) {
        alertas.push({
          empresa: e.nome,
          cnpj: e.cnpj,
          tipo: "Certidões vencendo",
          quando: `${warnCentral} em atenção`,
          severidade: "warn",
        });
      }
    }
    if (!isEmpresaApto(e) && e.sicaf === "ativo") {
      alertas.push({
        empresa: e.nome,
        cnpj: e.cnpj,
        tipo: "INAPTA — níveis não sincronizados",
        quando: "Use o Assistente",
        severidade: "warn",
      });
    }
  }

  const sev = { danger: 0, warn: 1 } as const;
  return alertas.sort((a, b) => sev[a.severidade] - sev[b.severidade]).slice(0, 8);
}

export function buildAssistantAlerts(empresas: EmpresaData[]): AssistantAlert[] {
  return empresas
    .map((e) => {
      let problema = e.proximoPasso;
      let severidade: "danger" | "warn" = "warn";

      if (e.sicaf === "vencido" || e.taxaPendente) {
        severidade = "danger";
        problema = e.sicaf === "vencido" ? `SICAF vencido${e.validade ? ` — ${e.validade}` : ""}` : "Taxa SICAF pendente";
      } else if (e.sicaf === "sem_cadastro") {
        severidade = "warn";
        problema = "Sem cadastro SICAF — regularize";
      } else if (!isEmpresaApto(e)) {
        severidade = "warn";
        problema = "INAPTA — envie a Situação do Fornecedor";
      } else if (e.sicaf === "atencao") {
        severidade = "warn";
        problema = e.validade ? `SICAF vence em ${e.validade}` : "SICAF próximo do vencimento";
      } else {
        return null;
      }

      return { empresa: e.nome, cnpj: e.cnpj, problema, severidade };
    })
    .filter((a): a is AssistantAlert => a != null)
    .slice(0, 3);
}

export function buildAtividadesRecentes(empresas: EmpresaData[]): AtividadePortfolio[] {
  return empresas
    .filter((e) => e.proximoPasso && e.proximoPasso !== "Tudo em dia. Vamos monitorar por você.")
    .slice(0, 4)
    .map((e) => ({
      tone:
        e.sicaf === "vencido" || e.taxaPendente
          ? ("warn" as const)
          : e.sicaf === "ativo" && isEmpresaApto(e)
            ? ("success" as const)
            : ("primary" as const),
      texto: `${e.nome}: ${e.proximoPasso}`,
      tempo: "Agora",
    }));
}
