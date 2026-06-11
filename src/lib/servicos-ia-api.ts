import { apiFetch } from "@/lib/api-fetch";
import { readAuthToken } from "@/lib/auth-cookie";
import { apiUrl } from "@/lib/api-config";
import { perguntarAjuda } from "@/lib/ajuda-api";
import { fetchProntidao, type EmpresaProntidao } from "@/lib/prontidao-api";
import {
  fetchLicitacoesList,
  mapApiToDisplay,
  type LicitacoesListParams,
} from "@/lib/licitacoes-api";

export type ResultadoIA = {
  titulo: string;
  resumo: string;
  metricas: { label: string; valor: string; tom: "ok" | "warn" | "info" }[];
  pontos: { titulo: string; texto: string }[];
};

type EditalJson = {
  objeto?: string;
  modalidade?: string;
  numero?: string;
  orgao?: string;
  valorEstimado?: string;
  pontosAtencao?: string[];
  documentos?: string[];
  requisitosHabilitacao?: { categoria?: string; itens?: string[] }[];
};

type SituacaoAnalise = {
  resumo?: string;
  status_geral?: string;
  pendencias?: { titulo?: string; problema?: string; solucao?: string }[];
  niveis_status?: { nivel?: string; status?: string; observacao?: string | null }[];
};

function mapTextoParaResultado(titulo: string, texto: string): ResultadoIA {
  const paragrafos = texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30)
    .slice(0, 5);

  return {
    titulo,
    resumo: paragrafos[0]?.slice(0, 220) || texto.slice(0, 220),
    metricas: [
      { label: "Confiança", valor: "Alta", tom: "ok" },
      { label: "Extensão", valor: `${texto.length} caracteres`, tom: "info" },
      { label: "Formato", valor: "Texto IA", tom: "info" },
    ],
    pontos:
      paragrafos.length > 0
        ? paragrafos.map((p, i) => ({
            titulo: i === 0 ? "Resposta direta" : `Ponto ${i + 1}`,
            texto: p,
          }))
        : [{ titulo: "Resposta", texto: texto.trim() || "Sem conteúdo retornado." }],
  };
}

function mapEditalResultado(resultado: EditalJson): ResultadoIA {
  const docs = resultado.documentos?.length ?? 0;
  const atencao = resultado.pontosAtencao || [];
  const hab = resultado.requisitosHabilitacao || [];

  return {
    titulo: "Edital analisado com sucesso",
    resumo:
      [resultado.modalidade, resultado.numero, resultado.orgao].filter(Boolean).join(" — ") ||
      (resultado.objeto || "").slice(0, 200),
    metricas: [
      { label: "Modalidade", valor: resultado.modalidade || "—", tom: "info" },
      { label: "Valor estimado", valor: resultado.valorEstimado || "—", tom: "info" },
      { label: "Documentos exigidos", valor: String(docs), tom: docs > 0 ? "ok" : "warn" },
    ],
    pontos: [
      { titulo: "Objeto", texto: resultado.objeto || "Não identificado no edital." },
      ...hab.slice(0, 2).map((h) => ({
        titulo: h.categoria || "Habilitação",
        texto: (h.itens || []).slice(0, 3).join("; ") || "—",
      })),
      ...atencao.slice(0, 2).map((p, i) => ({
        titulo: `Atenção ${i + 1}`,
        texto: p,
      })),
    ].slice(0, 6),
  };
}

function mapSituacaoResultado(data: Record<string, unknown>): ResultadoIA {
  const analise = (data.analise || {}) as SituacaoAnalise;
  const pendencias = analise.pendencias || [];
  const niveis = analise.niveis_status || [];

  return {
    titulo: "Diagnóstico concluído",
    resumo: analise.resumo || String(data.message || "Análise da situação do fornecedor concluída."),
    metricas: [
      {
        label: "Status geral",
        valor: analise.status_geral || "Analisado",
        tom: pendencias.length === 0 ? "ok" : "warn",
      },
      { label: "Pendências", valor: String(pendencias.length), tom: pendencias.length > 0 ? "warn" : "ok" },
      { label: "CNPJ", valor: String(data.cnpj || "—"), tom: "info" },
    ],
    pontos: [
      ...niveis.slice(0, 2).map((n) => ({
        titulo: `SICAF ${n.nivel || ""}`.trim(),
        texto: [n.status, n.observacao].filter(Boolean).join(" — ") || "—",
      })),
      ...pendencias.slice(0, 4).map((p) => ({
        titulo: p.titulo || "Pendência",
        texto: p.problema || p.solucao || "—",
      })),
    ],
  };
}

function mapProntidaoResultado(empresas: EmpresaProntidao[]): ResultadoIA {
  const media = empresas.length
    ? Math.round(empresas.reduce((s, e) => s + e.score, 0) / empresas.length)
    : 0;
  const criticas = empresas.filter((e) => e.prioridade === "alta").length;

  return {
    titulo: "Diagnóstico concluído",
    resumo:
      empresas[0]?.acao ||
      `Média de prontidão do portfólio: ${media}%. Revise as empresas com prioridade alta.`,
    metricas: [
      { label: "Prontidão média", valor: `${media}%`, tom: media >= 70 ? "ok" : "warn" },
      { label: "Empresas", valor: String(empresas.length), tom: "info" },
      { label: "Prioridade alta", valor: String(criticas), tom: criticas > 0 ? "warn" : "ok" },
    ],
    pontos: empresas.slice(0, 5).map((e) => ({
      titulo: e.razao,
      texto: `${e.score}% · ${e.acao}`,
    })),
  };
}

function mapMatchResultado(
  total: number,
  itens: ReturnType<typeof mapApiToDisplay>[],
): ResultadoIA {
  const alto = itens.filter((i) => i.match >= 70).length;
  const volume = itens.reduce((s, i) => s + i.valorNum, 0);

  return {
    titulo: `Encontramos ${total} licitação(ões) compatíveis`,
    resumo:
      "Licitações selecionadas com base no seu perfil, região e histórico na plataforma CADBRASIL.",
    metricas: [
      { label: "Match alto", valor: String(alto), tom: "ok" },
      { label: "Listadas", valor: String(itens.length), tom: "info" },
      {
        label: "Volume estimado",
        valor: volume > 0 ? `R$ ${(volume / 1_000_000).toFixed(1)}M` : "—",
        tom: "info",
      },
    ],
    pontos: itens.slice(0, 5).map((l) => ({
      titulo: `${l.modalidade} — ${l.orgao}`,
      texto: `Compatibilidade ${l.match}%. Valor ${l.valor}. ${l.objeto.slice(0, 120)}`,
    })),
  };
}

async function uploadPdf(endpoint: string, file: File) {
  const token = readAuthToken() || localStorage.getItem("cadbrasil_token") || "";
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const raw = await res.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: raw?.slice(0, 200) || `Erro HTTP ${res.status}` };
  }
}

export async function executarModuloIA(
  moduloId: string,
  opts: {
    objetivo: string;
    arquivo?: File | null;
    textoLivre?: string;
    onProgress?: (pct: number) => void;
  },
): Promise<{ ok: boolean; resultado?: ResultadoIA; error?: string }> {
  const { objetivo, arquivo, textoLivre, onProgress } = opts;
  onProgress?.(10);

  if (moduloId === "edital") {
    if (!arquivo) return { ok: false, error: "Envie o PDF do edital para continuar." };
    onProgress?.(35);
    const data = await uploadPdf("/api/ai-reader/analisar", arquivo);
    onProgress?.(90);
    if (!data.ok) return { ok: false, error: String(data.error || "Erro ao analisar edital") };
    return { ok: true, resultado: mapEditalResultado((data.resultado || {}) as EditalJson) };
  }

  if (moduloId === "situacao") {
    if (arquivo) {
      onProgress?.(40);
      const data = await uploadPdf("/api/sicaf/analisar-situacao", arquivo);
      onProgress?.(90);
      if (!data.ok) return { ok: false, error: String(data.error || "Erro na análise SICAF") };
      return { ok: true, resultado: mapSituacaoResultado(data) };
    }
    onProgress?.(50);
    const pront = await fetchProntidao(textoLivre || "");
    onProgress?.(90);
    if (!pront.ok || !pront.empresas?.length) {
      return {
        ok: false,
        error: pront.error || "Nenhuma empresa encontrada. Envie o PDF SICAF ou cadastre uma empresa.",
      };
    }
    return { ok: true, resultado: mapProntidaoResultado(pront.empresas) };
  }

  if (moduloId === "match") {
    onProgress?.(30);
    const params: LicitacoesListParams = { limit: 12, order_by: "data_abertura", order_dir: "asc" };
    if (objetivo === "altachance") params.mira = "1";
    if (objetivo === "grandevalor") params.valor_min = 500_000;
    if (objetivo === "rapidas") params.prazo_max_days = 7;
    const res = await fetchLicitacoesList(params);
    onProgress?.(85);
    if (!res.ok) return { ok: false, error: res.error || "Erro ao buscar licitações" };
    const itens = (res.licitacoes || []).map(mapApiToDisplay);
    return { ok: true, resultado: mapMatchResultado(res.total, itens) };
  }

  const prompts: Record<string, string> = {
    preco: `Como especialista em precificação de licitações, sugira faixa de lance vencedor. Estratégia: ${objetivo}.`,
    impugnacao: `Como advogado de licitações, elabore fundamentação para impugnação. Motivo: ${objetivo}.`,
    assistente: `Como consultor CADBRASIL, responda em linguagem simples. Tema: ${objetivo}.`,
  };

  const contexto = textoLivre?.trim() || (arquivo ? `Documento anexado: ${arquivo.name}` : "");
  const pergunta = `${prompts[moduloId] || "Responda sobre licitações e SICAF."}\n\n${contexto}`.trim();

  if (!pergunta || pergunta.length < 20) {
    return { ok: false, error: "Descreva sua dúvida ou envie um documento de referência." };
  }

  onProgress?.(40);
  const chat = await perguntarAjuda(pergunta, () => {});
  onProgress?.(90);
  if (!chat.ok || !chat.fullText) {
    return { ok: false, error: chat.error || "Assistente indisponível no momento." };
  }

  const titulos: Record<string, string> = {
    preco: "Preço sugerido calculado",
    impugnacao: "Impugnação gerada",
    assistente: "Resposta do assistente",
  };

  return { ok: true, resultado: mapTextoParaResultado(titulos[moduloId] || "Análise concluída", chat.fullText) };
}
