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
