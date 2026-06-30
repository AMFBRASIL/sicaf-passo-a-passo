import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { detectarFluxoPagamentoSicaf } from "@/lib/cliente-financeiro-api";
import { fetchDocumentosChecklist, type DocChecklistItem } from "@/lib/documentos-api";
import {
  certificadoEstaValido,
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import type { EmpresaGerenciarPainel } from "@/lib/empresas-api";
import { fetchEmpresas } from "@/lib/empresas-api";
import type { EmpresaData } from "@/lib/empresas-shared";
import {
  calcSaudeDocumentalSicaf,
  deriveEtapaAtual,
  loadSicafPageData,
  pagamentoSicafConfirmado,
  reloadSicafPainel,
  sicafNiveisIIIEmOrdem,
  todosNiveisValidados,
  type SicafPageCliente,
} from "@/lib/sicaf-page-api";
import { SICAF_PASSOS, SICAF_TOTAL_ETAPAS } from "@/lib/sicaf-flow-constants";
import {
  buildPipelineEtapas,
  pipelineProgresso,
  proximaAcaoPipeline,
  type PipelineModalKey,
} from "@/lib/sicaf-pipeline-ui";
import { useCadBrasilExtension } from "@/hooks/use-cadbrasil-extension";
import { toast } from "sonner";

export const sicafSearchSchema = z.object({
  cnpj: z.string().optional(),
});

export function useSicafFlow(cnpj?: string) {
  const total = SICAF_TOTAL_ETAPAS;
  const { extensionInstalled, openSICAF } = useCadBrasilExtension();

  const [empresasLoading, setEmpresasLoading] = useState(true);
  const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<SicafPageCliente | null>(null);
  const [painel, setPainel] = useState<EmpresaGerenciarPainel | null>(null);
  const [certificado, setCertificado] = useState<CertificadoDigitalInfo | null>(null);
  const [valorRenovacaoFmt, setValorRenovacaoFmt] = useState("R$ 985,00");

  const [renovando, setRenovando] = useState(false);
  const [renovacaoModal, setRenovacaoModal] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [modalAberto, setModalAberto] = useState<number | null>(null);
  const [pagamentoModal, setPagamentoModal] = useState(false);
  const [pagamentosWizardOpen, setPagamentosWizardOpen] = useState(false);
  const [certificadoModal, setCertificadoModal] = useState(false);
  const [verificandoPagamento, setVerificandoPagamento] = useState(false);
  const [docsSaude, setDocsSaude] = useState<DocChecklistItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<string | null>(null);
  const [trocarEmpresaOpen, setTrocarEmpresaOpen] = useState(false);

  const carregarDocumentos = useCallback(async (clienteId: number) => {
    setDocsLoading(true);
    setDocsSaude([]);
    const checklist = await fetchDocumentosChecklist(clienteId);
    setDocsLoading(false);
    if (!checklist.ok || !checklist.docsPorNivel) {
      setDocsSaude([]);
      return;
    }
    setDocsSaude(Object.values(checklist.docsPorNivel).flat());
    setUltimaVerificacao(
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    );
  }, []);

  const aplicarDados = useCallback(
    (
      nextCliente: SicafPageCliente,
      nextPainel: EmpresaGerenciarPainel,
      nextCertificado: CertificadoDigitalInfo | null,
    ) => {
      setCliente(nextCliente);
      setPainel(nextPainel);
      setCertificado(nextCertificado);
    },
    [],
  );

  const recarregar = useCallback(async () => {
    if (!cliente?.clienteId) return;
    const id = cliente.clienteId;
    const [data] = await Promise.all([reloadSicafPainel(id), carregarDocumentos(id)]);
    if (data.ok && data.painel && data.cliente) {
      aplicarDados(data.cliente, data.painel, data.certificado ?? null);
    }
  }, [aplicarDados, carregarDocumentos, cliente?.clienteId]);

  useEffect(() => {
    let cancelled = false;
    setEmpresasLoading(true);
    fetchEmpresas().then((res) => {
      if (cancelled) return;
      setEmpresasLoading(false);
      if (res.ok) setEmpresas(res.empresas);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cliente?.clienteId) void carregarDocumentos(cliente.clienteId);
  }, [cliente?.clienteId, carregarDocumentos]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRenovando(false);
    setDocsSaude([]);
    setUltimaVerificacao(null);

    loadSicafPageData(cnpj).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data.ok || !data.cliente || !data.painel) {
        setLoadError(data.error || "Não foi possível carregar os dados");
        setCliente(null);
        setPainel(null);
        return;
      }
      if (data.valorRenovacaoFmt) setValorRenovacaoFmt(data.valorRenovacaoFmt);
      aplicarDados(data.cliente, data.painel, data.certificado ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [cnpj, aplicarDados]);

  useEffect(() => {
    if (!painel || !cliente) return;
    setEtapaAtual(
      deriveEtapaAtual(painel, certificado, extensionInstalled, renovando, total),
    );
  }, [extensionInstalled, painel, certificado, renovando, total, cliente]);

  const saudeStats = useMemo(() => {
    const etapasConcluidas = etapaAtual > total;
    const base = calcSaudeDocumentalSicaf(docsSaude, painel?.niveisDetail, { etapasConcluidas });
    return {
      ...base,
      ultimaVerificacao,
      labelMonitorado: `${base.total} documento${base.total === 1 ? "" : "s"} do SICAF monitorados`,
    };
  }, [docsSaude, ultimaVerificacao, painel?.niveisDetail, etapaAtual, total]);

  const pipelineEtapas = useMemo(
    () => buildPipelineEtapas(etapaAtual, painel),
    [etapaAtual, painel],
  );

  const progresso = useMemo(() => pipelineProgresso(pipelineEtapas), [pipelineEtapas]);
  const proximaAcao = useMemo(
    () => proximaAcaoPipeline(pipelineEtapas, etapaAtual, total),
    [pipelineEtapas, etapaAtual, total],
  );

  const concluirEtapa = () => {
    void recarregar();
  };

  const iniciarRenovacao = () => {
    setRenovando(true);
    setRenovacaoModal(false);
    if (painel && cliente) {
      setEtapaAtual(deriveEtapaAtual(painel, certificado, extensionInstalled, true, total));
    } else {
      setEtapaAtual(1);
    }
  };

  const tudoConcluido = etapaAtual > total;
  const niveisEssenciaisOk = sicafNiveisIIIEmOrdem(painel?.niveisDetail);
  const sicafCompleto = todosNiveisValidados(painel?.niveisDetail);
  const sicafEmOrdem =
    niveisEssenciaisOk && cliente?.estado !== "vencido" && !renovando;
  const pagamentoConfirmado = pagamentoSicafConfirmado(painel);
  const sicafJaAtivo =
    painel?.sicaf?.status === "Ativo" || painel?.sicaf?.status === "Vencendo";
  const certificadoValido = certificadoEstaValido(certificado);

  const abrirPagamentoEtapa1 = useCallback(async () => {
    if (!cliente?.clienteId) return;
    setVerificandoPagamento(true);
    const res = await detectarFluxoPagamentoSicaf(cliente.clienteId);
    setVerificandoPagamento(false);
    if (res.fluxo === "pendentes") {
      setPagamentosWizardOpen(true);
    } else {
      setPagamentoModal(true);
    }
  }, [cliente?.clienteId]);

  const bloquearAssistente = useCallback(() => {
    const vencido = painel?.sicaf?.status === "Vencido";
    toast.error(
      vencido
        ? "SICAF vencido — regularize o pagamento para acessar o Assistente."
        : "Confirme o pagamento da taxa CADBRASIL para acessar o Assistente.",
    );
    void abrirPagamentoEtapa1();
  }, [abrirPagamentoEtapa1, painel?.sicaf?.status]);

  const abrirEtapaModal = useCallback(
    (modalKey: PipelineModalKey) => {
      switch (modalKey) {
        case "pagamento":
          void abrirPagamentoEtapa1();
          break;
        case "certificado":
          setCertificadoModal(true);
          break;
        case "documentos":
          setModalAberto(2);
          break;
        case "assistente":
          setModalAberto(3);
          break;
        case "nivel3":
          setModalAberto(4);
          break;
        case "nivel4":
          setModalAberto(5);
          break;
        case "validar":
          setModalAberto(6);
          break;
      }
    },
    [abrirPagamentoEtapa1],
  );

  const abrirAssistente = useCallback(() => {
    if (!pagamentoConfirmado) {
      bloquearAssistente();
      return;
    }
    void openSICAF();
  }, [bloquearAssistente, openSICAF, pagamentoConfirmado]);

  return {
    passos: SICAF_PASSOS,
    total,
    empresas,
    empresasLoading,
    loading,
    loadError,
    cliente,
    painel,
    certificado,
    setCertificado,
    valorRenovacaoFmt,
    renovando,
    renovacaoModal,
    setRenovacaoModal,
    etapaAtual,
    modalAberto,
    setModalAberto,
    pagamentoModal,
    setPagamentoModal,
    pagamentosWizardOpen,
    setPagamentosWizardOpen,
    certificadoModal,
    setCertificadoModal,
    verificandoPagamento,
    docsLoading,
    saudeStats,
    trocarEmpresaOpen,
    setTrocarEmpresaOpen,
    pipelineEtapas,
    progresso,
    proximaAcao,
    concluirEtapa,
    iniciarRenovacao,
    recarregar,
    tudoConcluido,
    sicafEmOrdem,
    sicafCompleto,
    pagamentoConfirmado,
    sicafJaAtivo,
    certificadoValido,
    abrirPagamentoEtapa1,
    bloquearAssistente,
    abrirEtapaModal,
    abrirAssistente,
    openSICAF,
    extensionInstalled,
  };
}

export type SicafFlow = ReturnType<typeof useSicafFlow>;
