/** WhatsApp suporte CADBRASIL — +55 11 2122-0202 */
export const WHATSAPP_SUPORTE_NUMERO = "551121220202";

export const WHATSAPP_MENSAGENS_POR_ROTA: Record<string, string> = {
  "/sicaf":
    "Olá! Estou na página SICAF e estou com dificuldade em fazer o processo. Podem me ajudar?",
  "/empresas": "Olá! Estou na página Empresas e preciso de ajuda.",
  "/documentos": "Olá! Estou na página Documentos e preciso de ajuda.",
  "/assistente": "Olá! Estou na página Assistente e preciso de ajuda.",
  "/certidoes": "Olá! Estou na página Certidões e preciso de ajuda.",
};

export function getWhatsAppMensagemPorPath(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";
  if (WHATSAPP_MENSAGENS_POR_ROTA[path]) {
    return WHATSAPP_MENSAGENS_POR_ROTA[path];
  }
  for (const [rota, mensagem] of Object.entries(WHATSAPP_MENSAGENS_POR_ROTA)) {
    if (path.startsWith(rota)) return mensagem;
  }
  return "Olá! Preciso de ajuda no Portal CADBRASIL.";
}

export function buildWhatsAppSuporteUrl(texto: string): string {
  return `https://wa.me/${WHATSAPP_SUPORTE_NUMERO}?text=${encodeURIComponent(texto)}`;
}

type LicitacaoWhatsAppContext = {
  id: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  uf: string;
  numero_processo?: string | null;
  numero_controle_pncp?: string | null;
};

/** Mensagem ao falar com consultor na etapa "Participar" de uma licitação. */
export function buildWhatsAppMensagemLicitacaoParticipar(
  licitacao: LicitacaoWhatsAppContext,
): string {
  const identificador =
    licitacao.numero_controle_pncp?.trim() ||
    licitacao.numero_processo?.trim() ||
    licitacao.id;

  return [
    "Olá! Estou no Portal CADBRASIL, na tela de Licitações (/licitacoes), na etapa *Participar* de uma licitação.",
    "",
    "Gostaria de falar com um consultor para me acompanhar nesta participação.",
    "",
    `• Órgão: ${licitacao.orgao}`,
    `• Objeto: ${licitacao.objeto}`,
    `• Modalidade: ${licitacao.modalidade} · ${licitacao.uf}`,
    `• Identificador: ${identificador}`,
  ].join("\n");
}

export function buildWhatsAppConsultorLicitacaoUrl(licitacao: LicitacaoWhatsAppContext): string {
  return buildWhatsAppSuporteUrl(buildWhatsAppMensagemLicitacaoParticipar(licitacao));
}
