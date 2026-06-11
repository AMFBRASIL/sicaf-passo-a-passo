/**
 * Template compartilhado do Contrato de Serviço CadBrasil.
 * Usado em /digital-contracts e no painel de Contratos do cliente (/clients).
 */

export interface ContractData {
  razao_social: string;
  documento: string;
  tipo_documento?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  plano: string;
  data_inicio?: string;
  data_vencimento?: string;
  status: string;
  assinado_em?: string | null;
  assinado_por?: string | null;
  /** Data exibida no rodapé do documento (ex.: data de assinatura informada no formulário). */
  data_documento?: string | null;
}

export interface ContractClause {
  title: string;
  items: string[];
}

export const CONTRACT_TITLE =
  "Contrato de Prestação de Serviços Especializados em Licitações, Gestão Documental e Manutenção SICAF";

export const contractClauses: ContractClause[] = [
  {
    title: "CLÁUSULA 1ª – DO OBJETO",
    items: [
      "1.1. O presente contrato tem por objeto a prestação de serviços especializados de assessoria, consultoria e gestão documental voltados à participação da CONTRATANTE em licitações públicas.",
      "1.2. Os serviços poderão incluir, conforme plano contratado:\n  a) Organização e análise documental;\n  b) Regularização, cadastramento e manutenção no SICAF;\n  c) Monitoramento de certidões e prazos;\n  d) Armazenamento digital organizado de documentos;\n  e) Acompanhamento de oportunidades de licitação;\n  f) Suporte técnico consultivo especializado;\n  g) Orientação estratégica para habilitação em certames públicos.",
    ],
  },
  {
    title: "CLÁUSULA 2ª – DO ASSISTENTE VIRTUAL COM INTELIGÊNCIA ARTIFICIAL",
    items: [
      "2.1. A CONTRATADA disponibiliza ferramenta digital denominada Assistente Virtual para Credenciamento Autônomo no SICAF, de uso gratuito e caráter meramente orientativo.",
      "2.2. O Assistente Virtual:\n  a) Atua exclusivamente como ferramenta educativa e informativa;\n  b) Não realiza integração com o sistema governamental;\n  c) Não executa automações ou preenchimentos automáticos;\n  d) Não armazena login ou senha do gov.br;\n  e) Não interfere tecnicamente no portal oficial do SICAF.",
      "2.3. O portal SICAF e o Compras.gov são sistemas oficiais do Governo Federal, não possuindo a CONTRATADA qualquer vínculo institucional, societário ou operacional com a Administração Pública.",
      "2.4. Todas as ações realizadas no sistema governamental são executadas exclusivamente pelo usuário da CONTRATANTE.",
    ],
  },
  {
    title: "CLÁUSULA 3ª – DA EXECUÇÃO DOS SERVIÇOS TÉCNICOS",
    items: [
      "3.1. Quando contratada para execução completa do processo, a CADBRASIL realizará análise técnica, organização documental e acompanhamento necessário para que a CONTRATANTE obtenha cadastro ativo e completo no SICAF, conforme legislação vigente.",
      "3.2. A CONTRATADA compromete-se a empregar técnica, diligência e zelo profissional.",
      "3.3. Não há garantia de êxito em licitações, adjudicações ou contratações públicas, considerando que decisões dependem exclusivamente da Administração Pública.",
    ],
  },
  {
    title: "CLÁUSULA 4ª – DOS VALORES, LICENÇA E MANUTENÇÃO",
    items: [
      "4.1. Pela disponibilização da licença anual de uso da plataforma CADBRASIL, a CONTRATANTE pagará o valor de R$ 985,00 (novecentos e oitenta e cinco reais) por ano.",
      "4.2. Para prestação dos serviços de manutenção contínua, gestão documental, monitoramento de certidões, armazenamento digital e suporte técnico, a CONTRATANTE pagará:\n  a) R$ 1.860,00 (mil oitocentos e sessenta reais) por ano, em pagamento anual;\n  ou\n  b) R$ 155,00 (cento e cinquenta e cinco reais) mensais, totalizando R$ 1.860,00 ao ano.",
      "4.3. A licença da plataforma e o plano de manutenção são obrigações distintas e complementares.",
      "4.4. O não pagamento da licença poderá implicar na suspensão do acesso ao sistema.",
      "4.5. O não pagamento do plano de manutenção poderá implicar na suspensão dos serviços técnicos.",
      "4.6. Em caso de atraso incidirá multa de 2%, juros de 1% ao mês e correção monetária.",
      "4.7. Os valores poderão ser reajustados anualmente pelo IPCA ou índice oficial equivalente.",
      "4.8. O plano de manutenção mensal (R$ 155,00) constitui modalidade de pagamento fracionado do valor anual de R$ 1.860,00, concedida exclusivamente como facilidade financeira à CONTRATANTE, não alterando a natureza do serviço contínuo, recorrente e de execução diluída ao longo de todo o período contratual.",
      "4.9. A CONTRATANTE reconhece que, desde o início da manutenção ativa, a CONTRATADA passa a dedicar recursos humanos, técnicos e operacionais de forma contínua, incluindo monitoramento de certidões, prazos, alertas, organização documental, suporte e demais entregas previstas no plano, independentemente do dia do pagamento mensal.",
    ],
  },
  {
    title: "CLÁUSULA 5ª – DA MANUTENÇÃO ATIVA, PARCELAMENTO E DESISTÊNCIA ANTECIPADA",
    items: [
      "5.1. Considera-se manutenção ativa o período em que o plano de manutenção estiver contratado e em execução, com disponibilização de serviços técnicos pela CONTRATADA, ainda que a CONTRATANTE deixe de utilizar parcialmente a plataforma ou de responder às solicitações da equipe.",
      "5.2. A opção de pagamento em parcelas mensais não converte o serviço em contratação mês a mês discricionária: trata-se de parcelamento do valor global da manutenção anual, em benefício da CONTRATANTE, tendo em vista a prestação fracionada, contínua e antecipada de obrigações da CONTRATADA ao longo dos 12 (doze) meses do ciclo contratual.",
      "5.3. Em caso de desistência, cancelamento, rescisão ou simples abandono do contrato pela CONTRATANTE enquanto a manutenção estiver ativa — por qualquer motivo, inclusive por decisão comercial, troca de fornecedor, encerramento de atividades ou desinteresse —, permanece exigível o pagamento integral de todas as parcelas vencidas e vincendas do ciclo de manutenção em curso, correspondentes ao valor anual pactuado (R$ 1.860,00), sem direito a abatimento proporcional, reembolso ou suspensão por período não utilizado.",
      "5.4. O disposto no item 5.3 aplica-se inclusive quando a CONTRATANTE tenha pago apenas parte das mensalidades, tendo a CONTRATADA já iniciado ou mantido a execução dos serviços de manutenção, a organização documental, o acompanhamento de certidões e demais entregas correlatas.",
      "5.5. Parcelas em atraso permanecem sujeitas à multa de 2% (dois por cento), juros de 1% (um por cento) ao mês, correção monetária e eventuais custos de cobrança extrajudicial ou judicial, sem prejuízo da suspensão dos serviços e do bloqueio de acesso, até a quitação integral.",
      "5.6. A desistência não exonera a CONTRATANTE de documentos, taxas, emolumentos ou obrigações perante terceiros e órgãos públicos eventualmente geradas por sua solicitação ou por exigências do certame, permanecendo de responsabilidade exclusiva da CONTRATANTE.",
      "5.7. O encerramento formal da manutenção pela CONTRATADA somente produzirá efeitos após a quitação integral das obrigações financeiras do ciclo vigente e o cumprimento do aviso prévio previsto na cláusula de rescisão, quando aplicável.",
      "5.8. A CONTRATANTE declara, ao aderir ao plano de manutenção parcelada, que compreende e aceita que o serviço é prestado de forma fracionada ao longo do ano e que o parcelamento mensal é mera conveniência de pagamento, não autorizando rescisão antecipada com redução de valores já comprometidos pela execução contratual.",
    ],
  },
  {
    title: "CLÁUSULA 6ª – DA VIGÊNCIA",
    items: [
      "6.1. O presente contrato terá vigência de 12 (doze) meses a contar da assinatura.",
      "6.2. Será renovado automaticamente por igual período, salvo manifestação contrária por escrito com antecedência mínima de 30 dias.",
    ],
  },
  {
    title: "CLÁUSULA 7ª – DAS OBRIGAÇÕES DA CONTRATADA",
    items: [
      "a) Prestar os serviços com observância das normas legais;",
      "b) Manter confidencialidade das informações;",
      "c) Informar pendências identificadas;",
      "d) Disponibilizar suporte conforme plano contratado;",
      "e) Atuar com ética e profissionalismo.",
    ],
  },
  {
    title: "CLÁUSULA 8ª – DAS OBRIGAÇÕES DA CONTRATANTE",
    items: [
      "a) Fornecer documentos verdadeiros e atualizados;",
      "b) Responsabilizar-se pela veracidade das informações;",
      "c) Manter sob guarda exclusiva suas credenciais gov.br;",
      "d) Cumprir prazos e pagamentos;",
      "e) Atender às solicitações técnicas necessárias.",
    ],
  },
  {
    title: "CLÁUSULA 9ª – DA LIMITAÇÃO DE RESPONSABILIDADE",
    items: [
      "9.1. A CONTRATADA não se responsabiliza por:\n  a) Instabilidades ou indisponibilidade do portal governamental;\n  b) Alterações legais ou normativas;\n  c) Indeferimentos decorrentes de dados incorretos fornecidos pela CONTRATANTE;\n  d) Decisões administrativas dos órgãos públicos.",
      "9.2. A responsabilidade da CONTRATADA limita-se ao valor total pago pela CONTRATANTE nos últimos 12 meses.",
    ],
  },
  {
    title: "CLÁUSULA 10ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS",
    items: [
      "10.1. As partes comprometem-se a manter sigilo sobre informações comerciais e estratégicas.",
      "10.2. A CONTRATADA tratará dados pessoais conforme a Lei nº 13.709/2018 (LGPD), exclusivamente para execução contratual.",
    ],
  },
  {
    title: "CLÁUSULA 11ª – DA RESCISÃO",
    items: [
      "11.1. O contrato poderá ser rescindido por qualquer das partes mediante notificação escrita com antecedência mínima de 30 (trinta) dias, ressalvado o disposto na Cláusula 5ª quanto à manutenção ativa e ao pagamento integral das parcelas do ciclo vigente.",
      "11.2. A rescisão por iniciativa da CONTRATANTE com manutenção ativa não dispensa o pagamento das parcelas remanescentes do plano anual em curso, nos termos da Cláusula 5ª.",
      "11.3. Em caso de inadimplência superior a 30 (trinta) dias, os serviços poderão ser suspensos imediatamente, sem prejuízo da cobrança dos valores em aberto.",
      "11.4. Valores pagos pela licença anual da plataforma não são reembolsáveis após a disponibilização do acesso.",
      "11.5. A inadimplência ou rescisão não autoriza a CONTRATANTE a reter, reproduzir ou utilizar indevidamente materiais, credenciais ou documentos de propriedade da CONTRATADA além do permitido em lei.",
    ],
  },
  {
    title: "CLÁUSULA 12ª – DA INEXISTÊNCIA DE VÍNCULO COM A ADMINISTRAÇÃO PÚBLICA",
    items: [
      "12.1. A CONTRATADA é empresa privada independente.",
      "12.2. Não possui vínculo, representação oficial ou autorização institucional do Governo Federal.",
      "12.3. O uso da plataforma não caracteriza intermediação oficial perante a Administração Pública.",
    ],
  },
  {
    title: "CLÁUSULA 13ª – DO FORO",
    items: [
      "Fica eleito o foro da comarca de São Paulo/SP, com renúncia de qualquer outro, por mais privilegiado que seja.",
    ],
  },
];

function formatDateBr(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateContractText(data: ContractData): string {
  const localidade = data.cidade
    ? `${data.cidade}${data.estado ? ` - ${data.estado}` : ""}`
    : "—";
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESPECIALIZADOS EM LICITAÇÕES, GESTÃO DOCUMENTAL E MANUTENÇÃO SICAF

CONTRATANTE:
Razão Social: ${data.razao_social}
${data.tipo_documento || "CNPJ"}: ${data.documento}
Endereço: ${localidade}
E-mail: ${data.email || "—"}
Telefone: ${data.telefone || "—"}

CONTRATADA:
CADBRASIL CONSULTORIA E TECNOLOGIA LTDA
CNPJ: 52.841.613/0001-55
Endereço: Av. Eng. Luiz Carlos Berrini, 1618 — São Paulo/SP

As partes acima identificadas celebram o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições abaixo.`;
}

/**
 * Monta o HTML completo do contrato para impressão / PDF, já com os dados do cliente.
 */
export function buildContractPrintHtml(data: ContractData): string {
  const contractHeader = generateContractText(data);
  const isAssinado = data.status === "Assinado";

  const clausesHtml = contractClauses
    .map(
      (c) =>
        `<div style="margin-bottom:18px;page-break-inside:avoid;">
          <p style="font-weight:bold;font-size:13px;margin-bottom:6px;color:#333;">${escapeHtml(c.title)}</p>
          ${c.items
            .map(
              (item) =>
                `<p style="white-space:pre-wrap;font-size:12px;line-height:1.7;margin:4px 0 4px 12px;color:#444;">${escapeHtml(item)}</p>`
            )
            .join("")}
        </div>`
    )
    .join("");

  const vigenciaHtml = `<p style="font-size:12px;color:#444;margin:4px 0;">
      <strong>Plano contratado:</strong> ${escapeHtml(data.plano || "—")} &nbsp;|&nbsp;
      <strong>Vigência:</strong> ${formatDateBr(data.data_inicio)} a ${formatDateBr(data.data_vencimento)}
    </p>`;

  const signatureHtml = isAssinado
    ? `<div style="margin-top:40px;padding:16px;border:1px solid #16a34a;border-radius:8px;background:#f0fdf4;page-break-inside:avoid;">
        <p style="font-weight:bold;color:#16a34a;font-size:13px;margin:0 0 4px;">✔ Contrato Assinado Digitalmente</p>
        <p style="font-size:12px;color:#166534;margin:0;">Assinado por ${escapeHtml(data.assinado_por || "—")} em ${formatDateBr(data.assinado_em)}</p>
        <p style="font-size:11px;color:#166534;margin:6px 0 0;">${escapeHtml(data.razao_social)} — ${escapeHtml(data.tipo_documento || "CNPJ")}: ${escapeHtml(data.documento)}</p>
      </div>`
    : `<div style="margin-top:60px;display:flex;justify-content:space-between;page-break-inside:avoid;">
        <div style="text-align:center;width:45%;">
          <div style="border-top:1px solid #333;padding-top:8px;">
            <p style="font-size:12px;font-weight:bold;margin:0;">CONTRATANTE</p>
            <p style="font-size:11px;margin:2px 0;">${escapeHtml(data.razao_social)}</p>
            <p style="font-size:11px;margin:2px 0;">CNPJ/CPF: ${escapeHtml(data.documento)}</p>
          </div>
        </div>
        <div style="text-align:center;width:45%;">
          <div style="border-top:1px solid #333;padding-top:8px;">
            <p style="font-size:12px;font-weight:bold;margin:0;">CONTRATADA</p>
            <p style="font-size:11px;margin:2px 0;">CADBRASIL CONSULTORIA E TECNOLOGIA LTDA</p>
            <p style="font-size:11px;margin:2px 0;">CNPJ: 52.841.613/0001-55</p>
          </div>
        </div>
      </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Contrato — ${escapeHtml(data.razao_social)}</title>
<style>
  @media print { body { margin: 20mm 15mm; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 15px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; color: #1e3a5f; }
  .header-block { white-space: pre-wrap; font-size: 12px; line-height: 1.8; margin-bottom: 16px; color: #444; }
  hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
</style></head><body>
<h1>${escapeHtml(CONTRACT_TITLE)}</h1>
<div class="header-block">${contractHeader.replace(/\n/g, "<br>")}</div>
${vigenciaHtml}
<hr>
${clausesHtml}
${signatureHtml}
<p style="text-align:center;margin-top:40px;font-size:11px;color:#888;">São Paulo, ${formatDateBr(data.data_documento || data.assinado_em || data.data_inicio)}</p>
</body></html>`;
}

function printHtmlDocument(html: string, win: Window): void {
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* ignorar — usuário pode imprimir manualmente (Ctrl+P) */
    }
  }, 400);
}

/**
 * Abre o contrato para impressão (nova aba ou iframe oculto se popup bloqueado).
 */
/** Abre o contrato em nova aba (visualizar / imprimir / salvar como PDF). */
export function openContractPreviewWindow(data: ContractData): boolean {
  const html = buildContractPrintHtml(data);
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

export function openContractPrintWindow(data: ContractData): boolean {
  const html = buildContractPrintHtml(data);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printHtmlDocument(html, printWindow);
    return true;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Impressão do contrato");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const frameWin = iframe.contentWindow;
  if (!frameWin) {
    document.body.removeChild(iframe);
    return false;
  }
  printHtmlDocument(html, frameWin);
  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 60_000);
  return true;
}
