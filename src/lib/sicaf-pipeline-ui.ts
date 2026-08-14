import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Bot,
} from "lucide-react";
import type { EmpresaGerenciarPainel } from "@/lib/empresas-api";
import { pagamentoSicafConfirmado } from "@/lib/sicaf-page-api";
import type { EmpresaData } from "@/lib/empresas-shared";
import { SICAF_PASSOS } from "@/lib/sicaf-flow-constants";

export type EtapaStatus = "concluido" | "andamento" | "pendente" | "atencao";

export type PipelineModalKey = "pagamento" | "assistente";

export interface PipelineEtapa {
  id: string;
  titulo: string;
  descricao: string;
  tempoMin: number;
  /** Status dinâmico opcional (ex.: documentos enviados) */
  subtitulo?: string;
  status: EtapaStatus;
  data?: string;
  icon: LucideIcon;
  modalKey: PipelineModalKey;
  etapaNum?: number;
}

function passoPorNumero(n: number) {
  const passo = SICAF_PASSOS.find((p) => p.n === n);
  if (!passo) throw new Error(`Etapa SICAF ${n} não definida`);
  return passo;
}

function statusFromEtapa(
  etapaNum: number,
  etapaAtual: number,
  needsAttention = false,
): EtapaStatus {
  if (needsAttention && etapaNum === etapaAtual) return "atencao";
  if (etapaNum < etapaAtual) return "concluido";
  if (etapaNum === etapaAtual) return "andamento";
  return "pendente";
}

export function buildPipelineEtapas(
  etapaAtual: number,
  painel: EmpresaGerenciarPainel | null,
): PipelineEtapa[] {
  const pagamentoOk = pagamentoSicafConfirmado(painel);
  const taxaPendente = !pagamentoOk;

  const p1 = passoPorNumero(1);
  const p2 = passoPorNumero(2);

  return [
    {
      id: "pagamento",
      titulo: p1.titulo,
      descricao: p1.descricao,
      tempoMin: p1.tempoMin,
      subtitulo: taxaPendente ? "Aguardando pagamento" : "Taxa confirmada",
      status: statusFromEtapa(1, etapaAtual, taxaPendente),
      icon: CreditCard,
      modalKey: "pagamento",
      etapaNum: 1,
    },
    {
      id: "assistente",
      titulo: p2.titulo,
      descricao: p2.descricao,
      tempoMin: p2.tempoMin,
      subtitulo: pagamentoOk ? "Documentos e certidões são validados no Assistente" : "Liberado após o pagamento",
      status: statusFromEtapa(2, etapaAtual),
      icon: Bot,
      modalKey: "assistente",
      etapaNum: 2,
    },
  ];
}

export function pipelineProgresso(etapas: PipelineEtapa[]): number {
  if (!etapas.length) return 0;
  const pesos: Record<EtapaStatus, number> = {
    concluido: 1,
    andamento: 0.5,
    atencao: 0.35,
    pendente: 0,
  };
  const sum = etapas.reduce((acc, e) => acc + pesos[e.status], 0);
  return Math.round((sum / etapas.length) * 100);
}

export function proximaAcaoPipeline(
  etapas: PipelineEtapa[],
  etapaAtual: number,
  total: number,
): { acao: string; estimativa: string } {
  if (etapaAtual > total) {
    return { acao: "SICAF em ordem", estimativa: "Acompanhe pelo Assistente CADBRASIL" };
  }
  const current = etapas.find((e) => e.etapaNum === etapaAtual) ?? etapas.find((e) => e.status === "andamento" || e.status === "atencao");
  if (current) {
    return {
      acao: current.titulo,
      estimativa: current.descricao,
    };
  }
  return { acao: "Continuar processo SICAF", estimativa: "Selecione a próxima etapa pendente" };
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

export function segmentoEmpresa(empresa: { niveis?: number[]; ramoAtividade?: string }): string {
  const max = empresa.niveis?.length ? Math.max(...empresa.niveis) : 0;
  const nivel = max > 0 ? `Nível I-${ROMAN[max]}` : "Nível I-VI";
  const ramo = empresa.ramoAtividade?.trim() || "Cadastro";
  return `${nivel} · ${ramo}`;
}

export function estimateEmpresaProgresso(empresa: EmpresaData): number {
  if (empresa.taxaPendente) return 12;
  const niveis = empresa.niveis?.length ?? 0;
  if (empresa.sicaf === "vencido") return 100;
  if (empresa.sicaf === "ativo" || empresa.sicaf === "vencendo") {
    return Math.min(98, 35 + niveis * 10);
  }
  return Math.min(85, 20 + niveis * 12);
}
