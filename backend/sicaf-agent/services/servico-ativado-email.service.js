/**
 * E-mails de ativação dos serviços CADBRASIL além do SICAF:
 * assessorias CAUFESP (BEC/SP) e BLL Compras, módulos Assistente Licitações-e e PNCP Inteligente.
 *
 * Cada serviço tem um comunicado próprio e detalhado, enviado quando o pagamento é confirmado
 * (baixa automática do boleto/PIX ou autorização manual da equipe). Mensalidades seguintes dos
 * módulos recebem um aviso curto de renovação.
 */
const { getDb } = require('../database/connection');

const WHATSAPP_NUMERO = process.env.CADBRASIL_WHATSAPP_NUMERO || '551121220202';
const WHATSAPP_DISPLAY = process.env.CADBRASIL_WHATSAPP_DISPLAY || '(11) 2122-0202';
const DIAS_RENOVACAO = 7;
const EMAIL_EQUIPE = process.env.CADBRASIL_EMAIL_EQUIPE_SERVICOS || 'documentos@fornecedordigital.com.br';

const ORIGEM_POR_SERVICO = {
  caufesp: 'caufesp',
  bll: 'bll',
  licitacoes_e: 'modulo_licitacoes_e',
  pncp: 'modulo_pncp',
};

const GRUPOS_DOCUMENTOS = {
  caufesp: {
    habilitacao_juridica: 'Habilitação jurídica',
    regularidade_fiscal: 'Regularidade fiscal e trabalhista',
    qualificacao_tecnica: 'Qualificação técnica',
    qualificacao_economica: 'Qualificação econômico-financeira',
    declaracoes: 'Declarações',
  },
  bll: {
    cadastro_bll: 'Documentos do cadastro na BLL',
    habilitacao: 'Kit de habilitação (exigido nos editais)',
    complementares: 'Complementares',
  },
};

/* ------------------------------------------------------------------ */
/* Utilitários                                                          */
/* ------------------------------------------------------------------ */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moeda(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}

function dataBr(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR');
}

function formaPagamentoLabel(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('pix')) return 'PIX';
  if (t.includes('boleto')) return 'Boleto bancário';
  return 'Pagamento confirmado';
}

function whatsappLink(texto) {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

function portalBase() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br').replace(
    /\/$/,
    '',
  );
}

/* ------------------------------------------------------------------ */
/* Blocos de layout (HTML compatível com clientes de e-mail)            */
/* ------------------------------------------------------------------ */

const FONT = "Arial,Helvetica,sans-serif";

function secao(titulo) {
  return `<p style="margin:28px 0 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f2f52;font-family:${FONT}">${esc(titulo)}</p>`;
}

function paragrafo(html) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#334155;font-family:${FONT}">${html}</p>`;
}

function tabelaResumo(linhas) {
  const rows = linhas
    .filter(Boolean)
    .map(
      ([rotulo, valor, cor], i, arr) =>
        `<tr><td style="padding:9px 0;font-size:13px;color:#475569;${i < arr.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''}">${esc(rotulo)}</td><td style="padding:9px 0;font-size:14px;font-weight:700;text-align:right;color:${cor || '#0f172a'};${i < arr.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''}">${esc(valor)}</td></tr>`,
    )
    .join('');
  return `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:6px 20px;margin:0 0 8px"><table role="presentation" width="100%" style="border-collapse:collapse;font-family:${FONT}">${rows}</table></div>`;
}

function passos(lista, cor) {
  const rows = lista
    .map(
      (p, i) => `<tr>
  <td valign="top" width="44" style="padding:10px 12px 10px 0">
    <div style="width:30px;height:30px;line-height:30px;border-radius:15px;text-align:center;font-size:14px;font-weight:700;font-family:${FONT};${p.feito ? 'background:#047857;color:#fff' : `background:${cor};color:#fff`}">${p.feito ? '&#10003;' : i + 1}</div>
  </td>
  <td style="padding:10px 0;border-bottom:${i < lista.length - 1 ? '1px solid #e2e8f0' : '0'};font-family:${FONT}">
    <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#0f172a">${esc(p.titulo)}</p>
    <p style="margin:0;font-size:13.5px;line-height:1.65;color:#475569">${p.texto}</p>
  </td>
</tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>`;
}

function lista(itens, cor = '#0f2f52') {
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-family:${FONT}">${itens
    .map(
      (t) =>
        `<tr><td valign="top" width="22" style="padding:5px 0;color:${cor};font-size:14px;font-weight:700">&#8226;</td><td style="padding:5px 0;font-size:14px;line-height:1.65;color:#334155">${t}</td></tr>`,
    )
    .join('')}</table>`;
}

function caixa({ titulo, html, fundo = '#eff6ff', borda = '#3b82f6', cor = '#1e3a8a' }) {
  return `<div style="background:${fundo};border-left:4px solid ${borda};border-radius:4px;padding:16px 18px;margin:16px 0;font-family:${FONT}">
  ${titulo ? `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${cor}">${esc(titulo)}</p>` : ''}
  <div style="font-size:13.5px;line-height:1.7;color:${cor}">${html}</div>
</div>`;
}

function botao(href, rotulo, cor) {
  return `<tr><td align="center" style="padding:6px"><a href="${esc(href)}" style="display:inline-block;background:${cor};color:#ffffff!important;padding:14px 26px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;font-family:${FONT}">${esc(rotulo)}</a></td></tr>`;
}

function botaoSecundario(href, rotulo) {
  return `<tr><td align="center" style="padding:6px"><a href="${esc(href)}" style="display:inline-block;background:#f1f5f9;color:#1e293b!important;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #cbd5e1;font-family:${FONT}">${esc(rotulo)}</a></td></tr>`;
}

function documentosHtml(servico, documentos) {
  const grupos = GRUPOS_DOCUMENTOS[servico] || {};
  const porGrupo = new Map();
  for (const d of documentos || []) {
    if (!porGrupo.has(d.grupo)) porGrupo.set(d.grupo, []);
    porGrupo.get(d.grupo).push(d);
  }
  let html = '';
  for (const [grupo, docs] of porGrupo) {
    html += `<p style="margin:16px 0 6px;font-size:13px;font-weight:700;color:#0f2f52;font-family:${FONT}">${esc(grupos[grupo] || grupo)}</p>`;
    html += `<table role="presentation" width="100%" style="border-collapse:collapse;font-family:${FONT}">`;
    for (const d of docs) {
      const tag = d.exigidoPara
        ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;text-transform:uppercase">${d.exigidoPara.includes('bens') ? 'Bens' : 'Serviços'}</span>`
        : !d.obrigatorio
          ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;background:#e2e8f0;color:#475569;font-size:10px;font-weight:700;text-transform:uppercase">Se aplicável</span>`
          : '';
      html += `<tr><td valign="top" width="22" style="padding:6px 0;color:#047857;font-size:13px;font-weight:700">&#9744;</td><td style="padding:6px 0;border-bottom:1px solid #f1f5f9"><p style="margin:0;font-size:13.5px;font-weight:600;color:#0f172a">${esc(d.nome)}${tag}</p><p style="margin:2px 0 0;font-size:12.5px;line-height:1.55;color:#64748b">${esc(d.descricao)}</p></td></tr>`;
    }
    html += '</table>';
  }
  return html;
}

function layout({ preheader, selo, titulo, subtitulo, acento, corpo, assinatura }) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#e8edf2">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8edf2;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid #c5d0db;box-shadow:0 8px 32px rgba(15,23,42,.08)">
        <tr>
          <td style="background:#0f2f52;background:linear-gradient(180deg,#0f2f52 0%,#1a4470 100%);padding:28px 32px;border-bottom:4px solid ${acento}">
            <table role="presentation" width="100%"><tr>
              <td style="font-family:${FONT}">
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.75)">${esc(selo)}</p>
                <h1 style="margin:0;font-size:23px;line-height:1.3;color:#ffffff;font-weight:700;font-family:Georgia,'Times New Roman',serif">${esc(titulo)}</h1>
                <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.88)">${esc(subtitulo)}</p>
              </td>
              <td align="right" valign="top" width="110" style="font-family:${FONT}">
                <div style="display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:10px 12px;text-align:center">
                  <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)">Ativado em</div>
                  <div style="font-size:14px;font-weight:700;color:#ffffff;margin-top:2px">${esc(hoje)}</div>
                </div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:30px 32px 8px">${corpo}</td></tr>
        <tr>
          <td style="padding:8px 32px 28px;font-family:${FONT}">
            <div style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f2f52">Precisa de ajuda?</p>
              <p style="margin:0;font-size:13.5px;line-height:1.7;color:#475569">
                Nossa equipe acompanha ${esc(assinatura)} do início ao fim. Fale conosco pelo WhatsApp
                <a href="${esc(whatsappLink(`Olá! Sou cliente CADBRASIL e preciso de ajuda com ${assinatura}.`))}" style="color:#047857;font-weight:700;text-decoration:none">${esc(WHATSAPP_DISPLAY)}</a>
                ou pelo suporte dentro do portal CADBRASIL.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;border-top:1px solid #cbd5e1;padding:20px 32px;text-align:center;font-family:${FONT}">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0f2f52">CADBRASIL</p>
            <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b">Assessoria privada especializada em cadastros e licitações públicas. A CADBRASIL não é órgão do governo.<br>Comunicado automático enviado em ${esc(hoje)} — guarde este e-mail para consulta.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Comunicados por serviço                                              */
/* ------------------------------------------------------------------ */

function saudacao(ctx) {
  return paragrafo(`Prezado(a) <strong>${esc(ctx.nome)}</strong>,`);
}

function observacaoEquipe(ctx) {
  return ctx.observacoes
    ? caixa({
        titulo: 'Observação da equipe CADBRASIL',
        html: esc(ctx.observacoes),
        fundo: '#fffbeb',
        borda: '#c9a227',
        cor: '#78350f',
      })
    : '';
}

function emailCaufesp(ctx) {
  const link = `${ctx.portal}/caufesp${ctx.cnpjParam}`;
  const corpo = [
    saudacao(ctx),
    paragrafo(
      `Confirmamos o pagamento da <strong>Assessoria CADBRASIL para o Cadastro CAUFESP (BEC/SP)</strong> da empresa <strong>${esc(ctx.empresa)}</strong>, CNPJ <strong style="font-family:monospace">${esc(ctx.cnpj)}</strong>. A partir de agora nossa equipe conduz com você todo o processo de cadastro no <strong>CAUFESP — Cadastro Unificado de Fornecedores do Estado de São Paulo</strong>.`,
    ),
    paragrafo(
      'Com o Registro Cadastral (CRC) aprovado, sua empresa fica apta a participar das compras do Governo do Estado de São Paulo realizadas pela <strong>Bolsa Eletrônica de Compras (BEC/SP)</strong> — secretarias, autarquias, fundações, universidades e demais órgãos estaduais.',
    ),
    secao('Resumo da contratação'),
    tabelaResumo([
      ['Empresa', ctx.empresa],
      ['CNPJ', ctx.cnpj],
      ['Serviço', 'Assessoria Cadastro CAUFESP (BEC/SP)'],
      ['Valor confirmado', moeda(ctx.valor), '#047857'],
      ['Forma de pagamento', ctx.forma],
      ['Situação', 'Aguardando envio dos documentos', '#b45309'],
    ]),
    observacaoEquipe(ctx),
    secao('Como funciona o processo — passo a passo'),
    passos(
      [
        { feito: true, titulo: 'Pagamento da assessoria', texto: 'Confirmado. Seu processo já está aberto no portal CADBRASIL.' },
        {
          titulo: 'Informe a atividade e envie os documentos',
          texto: 'No portal, indique se a empresa <strong>fornece bens, presta serviços ou os dois</strong> — isso define quais inscrições e certidões estaduais/municipais o CAUFESP exige. Em seguida, anexe cada documento da lista abaixo e clique em <strong>Enviar para conferência</strong>.',
        },
        {
          titulo: 'Conferência CADBRASIL',
          texto: 'Nossa equipe confere cada documento: validade das certidões, assinaturas e compatibilidade com o contrato social. Se algo precisar de ajuste, avisamos no portal (com o motivo) e o reenvio fica liberado para você.',
        },
        {
          titulo: 'Protocolo no CAUFESP',
          texto: 'Com tudo em ordem, a CADBRASIL faz o pré-cadastro no sistema CAUFESP, anexa a documentação e envia a solicitação para a Unidade Cadastradora do Governo de SP. O número do protocolo aparece no seu portal.',
        },
        {
          titulo: 'Análise do Governo de SP',
          texto: 'A Comissão de Avaliação Cadastral analisa o pedido e pode solicitar complementações. Essa etapa é conduzida <strong>exclusivamente pelo governo</strong>: acompanhamos o andamento e avisamos você a cada retorno.',
        },
        {
          titulo: 'Cadastro aprovado — CRC emitido',
          texto: 'Com o deferimento, a empresa recebe o Registro Cadastral (CRC), <strong>válido por 1 ano</strong>, e pode disputar as compras da BEC/SP. A validade do CRC fica registrada no seu portal.',
        },
      ],
      '#047857',
    ),
    secao('Documentos que você vai enviar'),
    paragrafo(
      'Lista conforme o Decreto SP 52.205/2007. Itens marcados como <strong>Bens</strong> ou <strong>Serviços</strong> dependem da atividade informada; os marcados como <strong>Se aplicável</strong> só são enviados quando a situação da empresa exigir.',
    ),
    documentosHtml('caufesp', ctx.documentos),
    caixa({
      titulo: 'Dicas para aprovar mais rápido',
      html: lista([
        'Envie PDFs legíveis, completos e com todas as páginas.',
        'Documentos sem versão eletrônica precisam ser cópias <strong>autenticadas em cartório</strong>.',
        'Confira a validade das certidões no dia do envio — certidões vencidas são devolvidas.',
        'O balanço patrimonial e a DRE devem estar assinados pelo contador e pelo sócio responsável; balancetes não são aceitos.',
        'Modelos das declarações (Modelos I e II do regulamento CAUFESP): peça à nossa equipe.',
      ], '#1e3a8a'),
    }),
    caixa({
      titulo: 'Informações importantes',
      html: lista([
        'A CADBRASIL é uma assessoria privada. O cadastro no CAUFESP é <strong>gratuito</strong> junto ao Governo de SP; o valor pago refere-se exclusivamente aos nossos serviços de assessoria.',
        'A aprovação depende da análise do Governo de SP, que pode pedir complementações. Por isso <strong>não há prazo garantido</strong> para o deferimento.',
      ], '#92400e'),
      fundo: '#fffbeb',
      borda: '#d97706',
      cor: '#92400e',
    }),
    `<table role="presentation" width="100%" style="margin:18px 0 6px">${botao(link, 'Enviar documentos do CAUFESP', '#047857')}${botaoSecundario('https://www.bec.sp.gov.br', 'Conhecer a BEC/SP')}</table>`,
  ].join('');

  return {
    assunto: `Assessoria CAUFESP (BEC/SP) ativada — próximos passos · ${ctx.empresa}`,
    html: layout({
      preheader: 'Pagamento confirmado. Veja o passo a passo do cadastro CAUFESP e a lista completa de documentos.',
      selo: 'Assessoria CADBRASIL · Governo de SP',
      titulo: 'Assessoria CAUFESP (BEC/SP) ativada',
      subtitulo: 'Cadastro Unificado de Fornecedores do Estado de São Paulo — Bolsa Eletrônica de Compras',
      acento: '#047857',
      corpo,
      assinatura: 'o seu cadastro CAUFESP',
    }),
    texto: [
      `Prezado(a) ${ctx.nome},`,
      `Confirmamos o pagamento da Assessoria CADBRASIL para o Cadastro CAUFESP (BEC/SP) da empresa ${ctx.empresa} (CNPJ ${ctx.cnpj}).`,
      'Próximos passos: 1) informe a atividade e envie os documentos no portal; 2) conferência CADBRASIL; 3) protocolo no CAUFESP; 4) análise do Governo de SP (sem prazo garantido); 5) CRC emitido, válido por 1 ano.',
      `Enviar documentos: ${link}`,
      `Dúvidas: WhatsApp ${WHATSAPP_DISPLAY}.`,
    ].join('\n\n'),
  };
}

function emailBll(ctx) {
  const link = `${ctx.portal}/bll${ctx.cnpjParam}`;
  const corpo = [
    saudacao(ctx),
    paragrafo(
      `Confirmamos o pagamento da <strong>Assessoria CADBRASIL de documentação para a BLL Compras</strong> da empresa <strong>${esc(ctx.empresa)}</strong>, CNPJ <strong style="font-family:monospace">${esc(ctx.cnpj)}</strong>. Nossa equipe agora prepara com você toda a documentação e o cadastro na plataforma.`,
    ),
    paragrafo(
      'A <strong>BLL Compras</strong> (bll.org.br) é uma das plataformas de licitação mais utilizadas por <strong>prefeituras, câmaras, consórcios e órgãos públicos de todo o país</strong> para pregões eletrônicos, dispensas e leilões. Com o cadastro liberado e o kit de habilitação em ordem, sua empresa passa a disputar essas oportunidades.',
    ),
    secao('Resumo da contratação'),
    tabelaResumo([
      ['Empresa', ctx.empresa],
      ['CNPJ', ctx.cnpj],
      ['Serviço', 'Assessoria Documentação BLL Compras'],
      ['Valor confirmado', moeda(ctx.valor), '#047857'],
      ['Forma de pagamento', ctx.forma],
      ['Situação', 'Aguardando envio dos documentos', '#b45309'],
    ]),
    observacaoEquipe(ctx),
    secao('Como funciona o processo — passo a passo'),
    passos(
      [
        { feito: true, titulo: 'Pagamento da assessoria', texto: 'Confirmado. Seu processo já está aberto no portal CADBRASIL.' },
        {
          titulo: 'Escolha o plano da BLL e envie os documentos',
          texto: 'No portal, informe o plano que a empresa vai usar na BLL (veja os planos abaixo) e anexe cada documento da lista. Ao terminar, clique em <strong>Enviar para conferência</strong>.',
        },
        {
          titulo: 'Conferência CADBRASIL',
          texto: 'Conferimos validade das certidões, assinaturas, dados do representante legal e compatibilidade com o contrato social. Se algo precisar de ajuste, avisamos no portal e o reenvio fica liberado.',
        },
        {
          titulo: 'Pré-cadastro na BLL e Termo de Adesão',
          texto: 'Fazemos com você o pré-cadastro em bll.org.br no plano escolhido. A BLL gera o <strong>Termo de Adesão</strong>, que deve ser assinado pelo representante legal (assinatura digital ou com firma reconhecida) e enviado junto com o contrato social.',
        },
        {
          titulo: 'Validação pela BLL',
          texto: 'A BLL confere o Termo de Adesão e os documentos e libera o acesso do fornecedor. Essa validação é feita exclusivamente pela BLL; se houver pendência, avisamos você para corrigir.',
        },
        {
          titulo: 'Cadastro liberado',
          texto: 'Sua empresa já pode participar dos pregões, dispensas e leilões publicados na BLL, com a documentação de habilitação pronta para os editais.',
        },
      ],
      '#6d28d9',
    ),
    secao('Planos de uso da BLL'),
    caixa({
      html: `${lista([
        '<strong>Plano trimestral</strong> — R$ 630,00 a cada 3 meses. Indicado para quem participa de muitas licitações.',
        '<strong>Plano por êxito</strong> — paga somente quando vence: 1,5% sobre o lote arrematado, limitado a R$ 600,00 por lote.',
      ], '#5b21b6')}<p style="margin:10px 0 0">Os planos são contratados e pagos <strong>diretamente à BLL</strong> e não fazem parte do valor da assessoria. Valores divulgados em bll.org.br e sujeitos a alteração pela BLL. Na dúvida, escolha o mais provável — ajustamos na conferência.</p>`,
      fundo: '#f5f3ff',
      borda: '#7c3aed',
      cor: '#4c1d95',
    }),
    secao('Documentos que você vai enviar'),
    paragrafo(
      'Os documentos do cadastro são exigidos pela BLL; o kit de habilitação é cobrado em cada edital e já fica pronto para as disputas. Itens <strong>Se aplicável</strong> só são enviados quando a situação da empresa exigir.',
    ),
    documentosHtml('bll', ctx.documentos),
    caixa({
      titulo: 'Atenção ao contrato social',
      html: 'A BLL exige o contrato social <strong>autenticado</strong>. Se o seu não tiver autenticação digital da Junta Comercial, envie cópia autenticada em cartório. Envie PDFs legíveis e confira a validade das certidões no dia do envio.',
      fundo: '#fffbeb',
      borda: '#d97706',
      cor: '#92400e',
    }),
    `<table role="presentation" width="100%" style="margin:18px 0 6px">${botao(link, 'Enviar documentos da BLL', '#6d28d9')}${botaoSecundario('https://bll.org.br', 'Conhecer a BLL Compras')}</table>`,
  ].join('');

  return {
    assunto: `Assessoria BLL Compras ativada — próximos passos · ${ctx.empresa}`,
    html: layout({
      preheader: 'Pagamento confirmado. Veja o passo a passo do cadastro na BLL, os planos e a lista de documentos.',
      selo: 'Assessoria CADBRASIL · BLL Compras',
      titulo: 'Assessoria BLL Compras ativada',
      subtitulo: 'Documentação e cadastro na plataforma de licitações usada por órgãos de todo o país',
      acento: '#7c3aed',
      corpo,
      assinatura: 'o seu cadastro na BLL',
    }),
    texto: [
      `Prezado(a) ${ctx.nome},`,
      `Confirmamos o pagamento da Assessoria CADBRASIL de documentação para a BLL Compras da empresa ${ctx.empresa} (CNPJ ${ctx.cnpj}).`,
      'Próximos passos: 1) escolha o plano da BLL e envie os documentos no portal; 2) conferência CADBRASIL; 3) pré-cadastro na BLL e Termo de Adesão assinado pelo representante legal; 4) validação pela BLL; 5) cadastro liberado.',
      'Planos BLL (pagos diretamente à BLL): trimestral R$ 630,00 a cada 3 meses, ou por êxito 1,5% do lote arrematado (até R$ 600,00 por lote).',
      `Enviar documentos: ${link}`,
      `Dúvidas: WhatsApp ${WHATSAPP_DISPLAY}.`,
    ].join('\n\n'),
  };
}

function blocoMensalidade(ctx, nomeModulo) {
  return caixa({
    titulo: 'Sobre a sua mensalidade',
    html: lista([
      `Acesso ao ${esc(nomeModulo)} liberado até <strong>${esc(dataBr(ctx.validoAte))}</strong>. Cada mensalidade paga libera 1 mês de uso.`,
      `A próxima mensalidade fica disponível no portal <strong>${DIAS_RENOVACAO} dias antes do vencimento</strong>, por boleto ou PIX. Pagando antes do vencimento, o novo mês é somado ao final do período atual — você não perde nenhum dia.`,
      'Se a mensalidade não for renovada, o acesso ao módulo é suspenso após o vencimento. Suas informações ficam guardadas e voltam a ficar disponíveis assim que o pagamento é confirmado.',
    ], '#1e3a8a'),
  });
}

function emailLicitacoesE(ctx) {
  const link = `${ctx.portal}/licitacoes-e${ctx.cnpjParam}`;
  const corpo = [
    saudacao(ctx),
    paragrafo(
      `O <strong>Módulo Assistente Licitações-e CADBRASIL</strong> foi ativado para a empresa <strong>${esc(ctx.empresa)}</strong>, CNPJ <strong style="font-family:monospace">${esc(ctx.cnpj)}</strong>. Seja bem-vindo(a)!`,
    ),
    paragrafo(
      'O <strong>Licitações-e</strong> é o portal de compras públicas do <strong>Banco do Brasil</strong>, utilizado por estados, municípios, autarquias e empresas públicas. O Assistente CADBRASIL guia você em cada etapa: do credenciamento no portal à disputa e ao resultado, com a documentação organizada e o apoio da nossa equipe.',
    ),
    secao('Resumo da ativação'),
    tabelaResumo([
      ['Empresa', ctx.empresa],
      ['CNPJ', ctx.cnpj],
      ['Módulo', 'Assistente Licitações-e CADBRASIL'],
      ['Mensalidade', moeda(ctx.valor), '#047857'],
      ['Forma de pagamento', ctx.forma],
      ['Acesso liberado até', dataBr(ctx.validoAte), '#047857'],
    ]),
    observacaoEquipe(ctx),
    secao('O que está incluído no módulo'),
    lista([
      '<strong>Trilha de credenciamento</strong> no Licitações-e, com o passo a passo do acesso da empresa e do representante.',
      '<strong>Busca de licitações</strong> disputadas no Licitações-e e acompanhamento de cada uma em um só lugar.',
      '<strong>Leitura do edital com IA</strong>: envie o PDF e receba requisitos de habilitação, documentos exigidos, prazos e pontos de atenção.',
      '<strong>Checklist de aptidão</strong> montado a partir do edital, para saber exatamente o que falta antes da disputa.',
      '<strong>Guia das etapas</strong> de proposta, envio, disputa (sala de lances), habilitação e resultado.',
      '<strong>Apoio da equipe CADBRASIL</strong> em qualquer licitação acompanhada — a orientação aparece direto no portal.',
    ], '#ca8a04'),
    secao('Como começar — passo a passo'),
    passos(
      [
        {
          titulo: 'Conclua a trilha de acesso ao Licitações-e',
          texto: 'Na aba de acesso do módulo, siga as 6 etapas: separar os documentos (contrato social, documentos do representante e procuração, se houver); certificado digital e-CNPJ ou e-CPF; solicitar o credenciamento no site do Licitações-e; validar o representante (por certificado digital ou em agência do Banco do Brasil); receber a chave e cadastrar a senha; e fazer o primeiro acesso.',
        },
        {
          titulo: 'Encontre as licitações certas',
          texto: 'Pesquise na base CADBRASIL as licitações disputadas no Licitações-e (por palavra-chave, UF e situação) ou cadastre uma licitação pelo número ou link do portal. Adicione ao acompanhamento as que interessam à empresa.',
        },
        {
          titulo: 'Leia o edital com inteligência artificial',
          texto: 'Envie o PDF do edital: a IA extrai órgão, objeto, data da sessão, requisitos de habilitação, documentos e pontos de atenção, e monta automaticamente o checklist da licitação. A leitura utiliza créditos de IA da sua conta — no <strong>PNCP Inteligente</strong> ela já vem incluída na mensalidade.',
        },
        {
          titulo: 'Confira a aptidão da empresa',
          texto: 'Marque no checklist o que já está pronto, o que falta e o que não se aplica. Quando todos os itens estiverem OK, a empresa está apta a disputar.',
        },
        {
          titulo: 'Acompanhe proposta, disputa e resultado',
          texto: 'Siga as etapas do assistente (proposta, envio, disputa, habilitação e resultado) e atualize a situação da licitação no portal: publicada, propostas abertas, em disputa, em homologação e concluída.',
        },
        {
          titulo: 'Peça apoio sempre que precisar',
          texto: 'Em cada licitação acompanhada existe o botão de <strong>pedir apoio à equipe CADBRASIL</strong>. Respondemos com a orientação diretamente no acompanhamento.',
        },
      ],
      '#ca8a04',
    ),
    caixa({
      titulo: 'Dica',
      html: 'O credenciamento no Licitações-e pode levar alguns dias por depender da validação do Banco do Brasil. Comece pela trilha de acesso o quanto antes para não perder as primeiras disputas.',
      fundo: '#fefce8',
      borda: '#ca8a04',
      cor: '#713f12',
    }),
    blocoMensalidade(ctx, 'Assistente Licitações-e'),
    `<table role="presentation" width="100%" style="margin:18px 0 6px">${botao(link, 'Acessar o Assistente Licitações-e', '#ca8a04')}${botaoSecundario('https://www.licitacoes-e.com.br', 'Portal Licitações-e (Banco do Brasil)')}</table>`,
  ].join('');

  return {
    assunto: `Módulo Assistente Licitações-e ativado — guia de início · ${ctx.empresa}`,
    html: layout({
      preheader: `Seu módulo Licitações-e está ativo até ${dataBr(ctx.validoAte)}. Veja como começar e tudo o que está incluído.`,
      selo: 'Módulo CADBRASIL · Banco do Brasil',
      titulo: 'Assistente Licitações-e ativado',
      subtitulo: 'Treinamento, documentação e acompanhamento das licitações do portal Licitações-e',
      acento: '#ca8a04',
      corpo,
      assinatura: 'o seu uso do Assistente Licitações-e',
    }),
    texto: [
      `Prezado(a) ${ctx.nome},`,
      `O Módulo Assistente Licitações-e CADBRASIL foi ativado para ${ctx.empresa} (CNPJ ${ctx.cnpj}). Acesso liberado até ${dataBr(ctx.validoAte)}.`,
      'Como começar: 1) conclua a trilha de acesso ao Licitações-e; 2) encontre e acompanhe licitações; 3) leia o edital com IA; 4) confira a aptidão no checklist; 5) acompanhe proposta, disputa e resultado; 6) peça apoio à equipe quando precisar.',
      `A próxima mensalidade fica disponível ${DIAS_RENOVACAO} dias antes do vencimento, por boleto ou PIX.`,
      `Acessar: ${link}`,
      `Dúvidas: WhatsApp ${WHATSAPP_DISPLAY}.`,
    ].join('\n\n'),
  };
}

function emailPncp(ctx) {
  const link = `${ctx.portal}/pncp${ctx.cnpjParam}`;
  const corpo = [
    saudacao(ctx),
    paragrafo(
      `O <strong>Módulo PNCP Inteligente CADBRASIL</strong> foi ativado para a empresa <strong>${esc(ctx.empresa)}</strong>, CNPJ <strong style="font-family:monospace">${esc(ctx.cnpj)}</strong>. Seja bem-vindo(a)!`,
    ),
    paragrafo(
      'O <strong>PNCP — Portal Nacional de Contratações Públicas</strong> é o portal oficial criado pela Lei 14.133/2021, onde órgãos da União, estados e municípios publicam editais, atas e contratos. Com o PNCP Inteligente, sua empresa encontra oportunidades, entende o mercado e lê editais com inteligência artificial — tudo em um só lugar.',
    ),
    secao('Resumo da ativação'),
    tabelaResumo([
      ['Empresa', ctx.empresa],
      ['CNPJ', ctx.cnpj],
      ['Módulo', 'PNCP Inteligente CADBRASIL'],
      ['Mensalidade', moeda(ctx.valor), '#047857'],
      ['Forma de pagamento', ctx.forma],
      ['Acesso liberado até', dataBr(ctx.validoAte), '#047857'],
    ]),
    observacaoEquipe(ctx),
    secao('O que você tem a partir de agora'),
    passos(
      [
        {
          titulo: 'Pesquisar oportunidades',
          texto: 'Busque licitações publicadas no PNCP por palavra-chave do seu ramo, UF, modalidade e situação, e acompanhe as que interessam à empresa.',
        },
        {
          titulo: 'Inteligência de mercado',
          texto: 'Descubra quais órgãos mais compram o que você vende, as faixas de valores praticadas e quem são os fornecedores que costumam vencer — informação para precificar e escolher melhor onde disputar.',
        },
        {
          titulo: 'Leitura de edital com IA — incluída na mensalidade',
          texto: 'Envie o PDF do edital e receba em minutos os requisitos de habilitação, documentos exigidos, prazos, critério de julgamento e pontos de atenção. No PNCP Inteligente a leitura <strong>não consome créditos de IA</strong>.',
        },
        {
          titulo: 'Antecipar oportunidades (PCA)',
          texto: 'Consulte o Plano de Contratações Anual dos órgãos e saiba o que eles pretendem comprar antes mesmo do edital sair — tempo para preparar documentos, fornecedores e preço.',
        },
        {
          titulo: 'Treinamento PNCP — 8 módulos',
          texto: 'Do funcionamento do portal à proposta vencedora: um treinamento completo para sua equipe dominar as contratações pela Lei 14.133/2021.',
        },
      ],
      '#1d4ed8',
    ),
    secao('Como começar'),
    lista([
      'Acesse o módulo e selecione a empresa no topo da página.',
      'Comece pelo <strong>Treinamento PNCP</strong> se for o primeiro contato com o portal.',
      'Na <strong>Pesquisa</strong>, use as palavras que descrevem seus produtos/serviços e filtre pelas UFs onde você atende.',
      'Antes de disputar, envie o edital na <strong>Leitura de edital</strong> e confira se a empresa atende a todos os requisitos.',
      'Use a <strong>Inteligência de mercado</strong> e o <strong>PCA</strong> para planejar as próximas disputas.',
    ], '#1d4ed8'),
    blocoMensalidade(ctx, 'PNCP Inteligente'),
    `<table role="presentation" width="100%" style="margin:18px 0 6px">${botao(link, 'Acessar o PNCP Inteligente', '#1d4ed8')}${botaoSecundario('https://pncp.gov.br', 'Portal Nacional de Contratações Públicas')}</table>`,
  ].join('');

  return {
    assunto: `Módulo PNCP Inteligente ativado — guia de início · ${ctx.empresa}`,
    html: layout({
      preheader: `Seu módulo PNCP Inteligente está ativo até ${dataBr(ctx.validoAte)}. Pesquisa, inteligência de mercado, leitura de edital com IA e treinamento.`,
      selo: 'Módulo CADBRASIL · Lei 14.133/2021',
      titulo: 'PNCP Inteligente ativado',
      subtitulo: 'Oportunidades, inteligência de mercado e leitura de edital com IA no Portal Nacional de Contratações Públicas',
      acento: '#1d4ed8',
      corpo,
      assinatura: 'o seu uso do PNCP Inteligente',
    }),
    texto: [
      `Prezado(a) ${ctx.nome},`,
      `O Módulo PNCP Inteligente CADBRASIL foi ativado para ${ctx.empresa} (CNPJ ${ctx.cnpj}). Acesso liberado até ${dataBr(ctx.validoAte)}.`,
      'Incluído: pesquisa de oportunidades, inteligência de mercado, leitura de edital com IA (sem consumir créditos), antecipação pelo PCA e treinamento PNCP em 8 módulos.',
      `A próxima mensalidade fica disponível ${DIAS_RENOVACAO} dias antes do vencimento, por boleto ou PIX.`,
      `Acessar: ${link}`,
      `Dúvidas: WhatsApp ${WHATSAPP_DISPLAY}.`,
    ].join('\n\n'),
  };
}

const MODULOS_NOME = { licitacoes_e: 'Assistente Licitações-e', pncp: 'PNCP Inteligente' };
const MODULOS_ROTA = { licitacoes_e: '/licitacoes-e', pncp: '/pncp' };
const MODULOS_ACENTO = { licitacoes_e: '#ca8a04', pncp: '#1d4ed8' };

function emailRenovacao(ctx, servico) {
  const nomeModulo = MODULOS_NOME[servico];
  const link = `${ctx.portal}${MODULOS_ROTA[servico]}${ctx.cnpjParam}`;
  const corpo = [
    saudacao(ctx),
    paragrafo(
      `Confirmamos o pagamento da mensalidade do <strong>Módulo ${esc(nomeModulo)} CADBRASIL</strong> da empresa <strong>${esc(ctx.empresa)}</strong>. Seu acesso foi renovado e continua liberado sem interrupção.`,
    ),
    secao('Resumo da renovação'),
    tabelaResumo([
      ['Empresa', ctx.empresa],
      ['CNPJ', ctx.cnpj],
      ['Módulo', `${nomeModulo} CADBRASIL`],
      ['Mensalidade', moeda(ctx.valor), '#047857'],
      ['Forma de pagamento', ctx.forma],
      ['Acesso liberado até', dataBr(ctx.validoAte), '#047857'],
    ]),
    observacaoEquipe(ctx),
    caixa({
      titulo: 'Próxima mensalidade',
      html: `Ficará disponível no portal a partir de ${DIAS_RENOVACAO} dias antes de <strong>${esc(dataBr(ctx.validoAte))}</strong>, por boleto ou PIX.`,
    }),
    `<table role="presentation" width="100%" style="margin:18px 0 6px">${botao(link, `Acessar o ${nomeModulo}`, MODULOS_ACENTO[servico])}</table>`,
  ].join('');

  return {
    assunto: `Mensalidade confirmada — ${nomeModulo} renovado até ${dataBr(ctx.validoAte)} · ${ctx.empresa}`,
    html: layout({
      preheader: `Pagamento confirmado. ${nomeModulo} liberado até ${dataBr(ctx.validoAte)}.`,
      selo: 'Módulo CADBRASIL · Renovação',
      titulo: `${nomeModulo} renovado`,
      subtitulo: `Mensalidade confirmada — acesso liberado até ${dataBr(ctx.validoAte)}`,
      acento: MODULOS_ACENTO[servico],
      corpo,
      assinatura: `o seu uso do ${nomeModulo}`,
    }),
    texto: [
      `Prezado(a) ${ctx.nome},`,
      `Confirmamos a mensalidade do Módulo ${nomeModulo} CADBRASIL de ${ctx.empresa}. Acesso liberado até ${dataBr(ctx.validoAte)}.`,
      `Acessar: ${link}`,
    ].join('\n\n'),
  };
}

/* ------------------------------------------------------------------ */
/* Aviso interno para a central dos colaboradores                       */
/* ------------------------------------------------------------------ */

const SERVICOS_EQUIPE = {
  caufesp: {
    nome: 'Assessoria Cadastro CAUFESP (BEC/SP)',
    acento: '#047857',
    tarefas: [
      'Acompanhar o envio dos documentos pelo cliente no portal (o cliente indica se fornece bens, serviços ou ambos).',
      'Conferir cada documento na <strong>Central de serviços</strong> do cliente e aprovar ou recusar com o motivo.',
      'Com tudo aprovado, fazer o pré-cadastro no CAUFESP, enviar à Unidade Cadastradora e registrar o número do protocolo.',
      'Acompanhar a análise do Governo de SP até a emissão do CRC.',
    ],
  },
  bll: {
    nome: 'Assessoria Cadastro BLL Compras',
    acento: '#7c3aed',
    tarefas: [
      'Acompanhar o envio dos documentos pelo cliente no portal (inclusive o contrato social autenticado).',
      'Conferir cada documento na <strong>Central de serviços</strong> do cliente e aprovar ou recusar com o motivo.',
      'Fazer o cadastro da empresa na BLL e registrar o protocolo.',
      'Orientar o cliente sobre o plano da BLL (trimestral ou por êxito), pago diretamente à BLL.',
    ],
  },
  licitacoes_e: {
    nome: 'Módulo Assistente Licitações-e',
    acento: '#ca8a04',
    tarefas: [
      'Fazer contato de boas-vindas e orientar as etapas de liberação do acesso ao Licitações-e (Banco do Brasil).',
      'Acompanhar pedidos de apoio do cliente na aba Licitações-e da <strong>Central de serviços</strong>.',
    ],
  },
  pncp: {
    nome: 'Módulo PNCP Inteligente',
    acento: '#1d4ed8',
    tarefas: [
      'Fazer contato de boas-vindas e apresentar a pesquisa de oportunidades, a leitura de edital com IA e o treinamento.',
      'Ajudar o cliente a configurar as palavras-chave do ramo dele para a pesquisa no PNCP.',
    ],
  },
};

function emailEquipe({ cliente, servico, pgto, validoAte, renovacao, clienteSemEmail }) {
  const cfg = SERVICOS_EQUIPE[servico];
  const empresa = cliente?.razao_social || `Cliente #${cliente?.id ?? '—'}`;
  const cnpj = cliente?.documento || '—';
  const telefone = cliente?.responsavel_telefone || cliente?.telefone || cliente?.celular || '—';
  const tipo = renovacao ? 'Renovação de mensalidade' : 'Nova contratação';
  const modulo = Boolean(MODULOS_NOME[servico]);
  const tarefas = renovacao
    ? ['Nenhuma ação obrigatória: o acesso foi renovado automaticamente. Verifique apenas se há pedidos de apoio pendentes.']
    : cfg.tarefas;

  const corpo = [
    paragrafo(
      renovacao
        ? `O cliente <strong>${esc(empresa)}</strong> renovou a mensalidade do <strong>${esc(cfg.nome)}</strong>.`
        : `O cliente <strong>${esc(empresa)}</strong> contratou o serviço <strong>${esc(cfg.nome)}</strong> e o pagamento foi confirmado.`,
    ),
    clienteSemEmail
      ? caixa({
          titulo: 'Cliente sem e-mail cadastrado',
          html: 'O cliente não recebeu o comunicado de ativação. Atualize o e-mail no cadastro e use "Reenviar ao cliente" na Central de serviços.',
          fundo: '#fef2f2',
          borda: '#dc2626',
          cor: '#7f1d1d',
        })
      : '',
    secao('Dados da contratação'),
    tabelaResumo([
      ['Serviço', cfg.nome],
      ['Tipo', tipo, renovacao ? '#1d4ed8' : '#047857'],
      ['Valor pago', moeda(pgto?.valor), '#047857'],
      ['Forma de pagamento', formaPagamentoLabel(pgto?.tipo)],
      ['Data do pagamento', dataBr(pgto?.data_pagamento || pgto?.updated_at || new Date())],
      modulo ? ['Acesso liberado até', dataBr(validoAte)] : null,
    ]),
    secao('Dados do cliente'),
    tabelaResumo([
      ['Código do cliente', String(cliente?.id ?? '—')],
      ['Empresa', empresa],
      ['CNPJ', cnpj],
      ['Responsável', cliente?.responsavel_nome || '—'],
      ['E-mail', cliente?.email || 'Não cadastrado', cliente?.email ? null : '#b91c1c'],
      ['Telefone', telefone],
    ]),
    secao('O que fazer agora'),
    lista(tarefas, cfg.acento),
    `<table role="presentation" width="100%" style="margin:18px 0 6px">${botao(`${portalBase()}/admin/clientes`, 'Abrir clientes no admin', cfg.acento)}</table>`,
    paragrafo(
      `<span style="font-size:13px;color:#64748b">No admin, busque pelo CNPJ ${esc(cnpj)}, abra o cliente e clique em <strong>Serviços</strong>.</span>`,
    ),
  ].join('');

  const hoje = new Date().toLocaleDateString('pt-BR');
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${esc(cfg.nome)}</title></head>
<body style="margin:0;padding:0;background:#e8edf2">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8edf2;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid #c5d0db">
        <tr>
          <td style="background:#0f2f52;padding:24px 32px;border-bottom:4px solid ${cfg.acento};font-family:${FONT}">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.75)">Central dos colaboradores · Aviso interno</p>
            <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;font-family:Georgia,'Times New Roman',serif">${renovacao ? 'Mensalidade renovada' : 'Novo serviço contratado'}</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.88)">${esc(cfg.nome)} · ${esc(empresa)}</p>
          </td>
        </tr>
        <tr><td style="padding:28px 32px 16px">${corpo}</td></tr>
        <tr>
          <td style="background:#f1f5f9;border-top:1px solid #cbd5e1;padding:16px 32px;text-align:center;font-family:${FONT}">
            <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b">Aviso automático do portal CADBRASIL enviado em ${esc(hoje)}. Uso interno da equipe.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    assunto: `[${renovacao ? 'Renovação' : 'Novo serviço'}] ${cfg.nome} — ${empresa} · ${cnpj}`,
    html,
    texto: [
      `${renovacao ? 'Mensalidade renovada' : 'Novo serviço contratado'}: ${cfg.nome}`,
      `Empresa: ${empresa} | CNPJ: ${cnpj} | Código: ${cliente?.id ?? '—'}`,
      `Responsável: ${cliente?.responsavel_nome || '—'} | E-mail: ${cliente?.email || 'não cadastrado'} | Telefone: ${telefone}`,
      `Valor: ${moeda(pgto?.valor)} | ${formaPagamentoLabel(pgto?.tipo)}${modulo ? ` | Acesso até ${dataBr(validoAte)}` : ''}`,
      clienteSemEmail ? 'ATENÇÃO: cliente sem e-mail cadastrado, não recebeu o comunicado de ativação.' : '',
      'O que fazer agora:',
      ...tarefas.map((t) => `- ${t.replace(/<[^>]+>/g, '')}`),
      `Admin: ${portalBase()}/admin/clientes`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

async function avisarEquipe({ cliente, servico, pgto, validoAte, renovacao, clienteSemEmail }) {
  try {
    const email = emailEquipe({ cliente, servico, pgto, validoAte, renovacao, clienteSemEmail });
    const envio = await require('./email.service').send({
      to: EMAIL_EQUIPE,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    });
    if (!envio.ok && !envio.skipped) {
      console.warn(`[ServicoAtivadoEmail] aviso equipe ${servico} cliente=${cliente?.id}:`, envio.error);
      return { enviado: false, para: EMAIL_EQUIPE, erro: envio.error || 'Falha ao enviar' };
    }
    return { enviado: Boolean(envio.sent), simulado: Boolean(envio.skipped), para: EMAIL_EQUIPE };
  } catch (e) {
    console.error(`[ServicoAtivadoEmail] aviso equipe ${servico} cliente=${cliente?.id}:`, e.message);
    return { enviado: false, para: EMAIL_EQUIPE, erro: e.message };
  }
}

/* ------------------------------------------------------------------ */
/* Montagem e envio                                                     */
/* ------------------------------------------------------------------ */

function documentosDoServico(servico) {
  if (servico === 'caufesp') return require('./caufesp.service').DOCUMENTOS;
  if (servico === 'bll') return require('./bll.service').DOCUMENTOS;
  return [];
}

/**
 * @param {object} opts
 * @param {object} opts.cliente - linha de `clientes`
 * @param {'caufesp'|'bll'|'licitacoes_e'|'pncp'} opts.servico
 * @param {number} [opts.valor]
 * @param {string} [opts.tipoPagamento]
 * @param {string} [opts.validoAte] - YYYY-MM-DD (módulos)
 * @param {boolean} [opts.renovacao] - mensalidade seguinte de módulo
 * @param {string} [opts.observacoes]
 */
function montarEmail({ cliente, servico, valor, tipoPagamento, validoAte, renovacao, observacoes }) {
  const cnpjDigits = String(cliente?.documento || '').replace(/\D/g, '');
  const ctx = {
    nome: cliente?.responsavel_nome || cliente?.razao_social || 'Cliente',
    empresa: cliente?.razao_social || 'sua empresa',
    cnpj: cliente?.documento || '',
    portal: portalBase(),
    cnpjParam: cnpjDigits ? `?cnpj=${encodeURIComponent(cnpjDigits)}` : '',
    valor,
    forma: formaPagamentoLabel(tipoPagamento),
    validoAte,
    observacoes: String(observacoes || '').trim(),
    documentos: documentosDoServico(servico),
  };

  if (renovacao && MODULOS_NOME[servico]) return emailRenovacao(ctx, servico);
  if (servico === 'caufesp') return emailCaufesp(ctx);
  if (servico === 'bll') return emailBll(ctx);
  if (servico === 'licitacoes_e') return emailLicitacoesE(ctx);
  if (servico === 'pncp') return emailPncp(ctx);
  throw new Error(`Serviço sem e-mail de ativação: ${servico}`);
}

async function ultimoPagamentoPago(db, servico, origemId) {
  return db('pagamentos')
    .whereNull('deleted_at')
    .where({ origem: ORIGEM_POR_SERVICO[servico], origem_id: origemId, status: 'pago' })
    .orderByRaw('COALESCE(data_pagamento, updated_at, created_at) DESC')
    .first();
}

/**
 * Envia o comunicado de ativação/renovação ao e-mail cadastrado do cliente e, com `notificarEquipe`,
 * o aviso interno para a central dos colaboradores (`equipe` no retorno).
 * Nunca lança: falhas voltam em `{ enviado: false, motivo, erro }`.
 */
async function enviarServicoAtivado({
  clienteId,
  servico,
  origemId,
  validoAte,
  renovacao = false,
  observacoes,
  notificarEquipe = true,
}) {
  const db = getDb();
  if (!db) return { enviado: false, motivo: 'sem_db' };
  try {
    const cliente = await db('clientes').where('id', clienteId).first();
    const para = String(cliente?.email || '').trim();
    const pgto = origemId ? await ultimoPagamentoPago(db, servico, origemId) : null;

    const equipe = notificarEquipe
      ? await avisarEquipe({ cliente: cliente || { id: clienteId }, servico, pgto, validoAte, renovacao, clienteSemEmail: !para })
      : undefined;

    if (!para) return { enviado: false, motivo: 'sem_email_destino', equipe };

    const email = montarEmail({
      cliente,
      servico,
      valor: pgto?.valor,
      tipoPagamento: pgto?.tipo,
      validoAte,
      renovacao,
      observacoes,
    });

    const envio = await require('./email.service').send({
      to: para,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    });
    if (!envio.ok && !envio.skipped) {
      console.warn(`[ServicoAtivadoEmail] ${servico} cliente=${clienteId}:`, envio.error);
      return { enviado: false, motivo: 'erro_envio', erro: envio.error || 'Falha ao enviar', para, equipe };
    }
    console.log(`[ServicoAtivadoEmail] ${servico}${renovacao ? ' (renovação)' : ''} enviado para cliente ${clienteId}`);
    return { enviado: Boolean(envio.sent), simulado: Boolean(envio.skipped), para, assunto: email.assunto, equipe };
  } catch (e) {
    console.error(`[ServicoAtivadoEmail] ${servico} cliente=${clienteId}:`, e.message);
    return { enviado: false, motivo: 'erro_envio', erro: e.message };
  }
}

/** Dados atuais do serviço do cliente — usado pela equipe para reenviar ou pré-visualizar. */
async function contextoAtual(db, clienteId, servico) {
  if (servico === 'caufesp' || servico === 'bll') {
    const processo = await db(`${servico}_processos`).where('cliente_id', clienteId).orderBy('id', 'desc').first();
    return { origemId: processo?.id || null, pago: Boolean(processo?.pago) };
  }
  const status = await require('./modulos-assinatura.service').getStatus(clienteId, servico);
  const assinatura = await db('modulos_assinaturas').where({ cliente_id: clienteId, modulo: servico }).first();
  return { origemId: assinatura?.id || null, pago: Boolean(status?.ativo), validoAte: status?.validoAte || null };
}

async function reenviar({ clienteId, servico }) {
  if (!ORIGEM_POR_SERVICO[servico]) return { ok: false, error: 'Serviço inválido.' };
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const ctx = await contextoAtual(db, clienteId, servico);
  if (!ctx.pago) {
    return { ok: false, error: 'O serviço ainda não está ativo para este cliente.' };
  }
  const r = await enviarServicoAtivado({
    clienteId,
    servico,
    origemId: ctx.origemId,
    validoAte: ctx.validoAte,
    notificarEquipe: false,
  });
  if (!r.enviado && !r.simulado) {
    return {
      ok: false,
      error: r.motivo === 'sem_email_destino' ? 'Cliente sem e-mail cadastrado.' : r.erro || 'Falha ao enviar o e-mail.',
    };
  }
  return { ok: true, para: r.para, simulado: r.simulado, assunto: r.assunto };
}

async function preview({ clienteId, servico, renovacao = false }) {
  if (!ORIGEM_POR_SERVICO[servico]) return { ok: false, error: 'Serviço inválido.' };
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado.' };
  const ctx = await contextoAtual(db, clienteId, servico);
  const pgto = ctx.origemId ? await ultimoPagamentoPago(db, servico, ctx.origemId) : null;
  const umMes = new Date();
  umMes.setMonth(umMes.getMonth() + 1);
  const email = montarEmail({
    cliente,
    servico,
    valor: pgto?.valor ?? { caufesp: 985.3, bll: 479, licitacoes_e: 299, pncp: 699 }[servico],
    tipoPagamento: pgto?.tipo || 'boleto',
    validoAte: ctx.validoAte || umMes.toISOString().slice(0, 10),
    renovacao,
  });
  return { ok: true, para: cliente.email || null, ...email };
}

module.exports = {
  enviarServicoAtivado,
  montarEmail,
  montarAvisoEquipe: emailEquipe,
  reenviar,
  preview,
};
