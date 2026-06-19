/**
 * E-mail ao cliente após confirmação/autorização do pagamento SICAF.
 * Informa que o processo foi iniciado e que a documentação pode ser enviada.
 */
const { getDb } = require('../database/connection');
const emailAvisos = require('./email-avisos.service');

const CADBRASIL_EXTENSION_STORE_URL =
  process.env.CADBRASIL_EXTENSION_STORE_URL ||
  'https://chromewebstore.google.com/detail/cadbrasil-%E2%80%94-assistente-si/cdhhdgcabgbjdambnhkmdibhnmfkaicd';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoneyBr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch (_) {
    return String(d);
  }
}

async function findProcessoIniciadoTemplate(db) {
  const ativo = () => db('templates_email').whereRaw('COALESCE(ativo, 1) = 1');

  const codigos = ['processo_iniciado', 'sicaf_processo_iniciado', 'pagamento_processo_iniciado'];
  for (const codigo of codigos) {
    const row = await ativo()
      .whereRaw('LOWER(COALESCE(codigo, \'\')) = ?', [codigo])
      .orderBy('id')
      .first();
    if (row) return row;
  }

  let row = await ativo()
    .whereRaw('LOWER(nome) LIKE ?', ['%processo iniciado%'])
    .orderBy('id')
    .first();
  if (row) return row;

  row = await ativo()
    .whereRaw('LOWER(nome) LIKE ?', ['%confirmação de pagamento%'])
    .orderBy('id')
    .first();
  if (row) return row;

  row = await ativo()
    .whereRaw('LOWER(nome) LIKE ?', ['%confirmacao de pagamento%'])
    .orderBy('id')
    .first();
  return row || null;
}

function resolvePagamentoInfo({ taxa, formaPagamento, autorizacaoManual }) {
  const valorNum = Number(taxa?.valor);
  const temValor = Number.isFinite(valorNum) && valorNum > 0;
  const formaRaw = String(formaPagamento || taxa?.forma_pagamento || '').trim();
  const forma =
    formaRaw && formaRaw.toLowerCase() !== 'pagamento'
      ? formaRaw
      : autorizacaoManual
        ? 'Autorização manual — equipe CADBRASIL'
        : 'Pagamento confirmado';

  return {
    temValor,
    valorFormatado: temValor ? formatMoneyBr(valorNum) : 'Conforme comprovante encaminhado',
    valorTexto: temValor
      ? formatMoneyBr(valorNum)
      : 'Pagamento autorizado pela equipe CADBRASIL',
    forma,
    situacaoFinanceira: autorizacaoManual
      ? 'Pagamento autorizado manualmente'
      : 'Pagamento confirmado',
  };
}

function buildPortalLinks(portalBase, cnpjDigits) {
  const cnpjParam = cnpjDigits ? `?cnpj=${encodeURIComponent(cnpjDigits)}` : '';
  return {
    link_sicaf: `${portalBase}/sicaf${cnpjParam}`,
    link_assistente: `${portalBase}/assistente${cnpjParam}`,
    link_documentos: `${portalBase}/documentos${cnpjParam}`,
    link_painel: `${portalBase}/empresas`,
    link_extensao: CADBRASIL_EXTENSION_STORE_URL,
  };
}

function buildProcessoIniciadoExtraVars({
  cliente,
  taxa,
  novaValidade,
  formaPagamento,
  observacoes,
  portalBase,
  autorizacaoManual,
}) {
  const pagamento = resolvePagamentoInfo({ taxa, formaPagamento, autorizacaoManual });
  const links = buildPortalLinks(portalBase, String(cliente?.documento || '').replace(/\D/g, ''));
  const hoje = new Date().toLocaleDateString('pt-BR');

  return {
    ...links,
    status: 'Processo em andamento',
    situacao_sicaf: 'Processo de atualização iniciado',
    data_inicio: hoje,
    data_ativacao: hoje,
    data_validade: formatDateBr(novaValidade),
    validade_sicaf: formatDateBr(novaValidade),
    valor: pagamento.valorTexto,
    valor_pago: pagamento.valorTexto,
    valor_taxa: pagamento.valorFormatado,
    forma_pagamento: pagamento.forma,
    situacao_financeira: pagamento.situacaoFinanceira,
    pagamento_autorizado_manual: autorizacaoManual ? 'Sim' : 'Não',
    observacoes_equipe: String(observacoes || '').trim(),
    link_renovar: links.link_sicaf,
    link_acesso: links.link_painel,
  };
}

function buildMensagemAdicional(observacoes, contexto = 'pagamento', dataInicio) {
  const dataAtivacao = formatDateBr(dataInicio);
  const parts =
    contexto === 'ativacao'
      ? [
          'Seu processo SICAF foi iniciado e a licença foi ativada com sucesso',
          dataInicio ? `a partir de ${dataAtivacao}` : '',
          'Você já pode enviar a documentação pelo portal CADBRASIL, na área Documentos.',
        ].filter(Boolean)
      : [
          'Comunicamos que o processo de cadastro/atualização do SICAF foi oficialmente iniciado.',
          'Instale o Assistente CADBRASIL no Google Chrome, acesse a área Atualizar SICAF e dê início à atualização dos níveis no Compras.gov.br.',
          'Envie também a documentação complementar na área Documentos do portal.',
        ];
  const obs = String(observacoes || '').trim();
  if (obs) parts.push(`Observação da equipe: ${obs}`);
  return parts.join(' ');
}

async function findContaAtivadaTemplate(db) {
  const ativo = () => db('templates_email').whereRaw('COALESCE(ativo, 1) = 1');
  const codigos = [
    'conta_ativada',
    'sicaf_conta_ativada',
    'cliente_ativado',
    'licenca_ativada',
    'sicaf_licenca_ativada',
  ];
  for (const codigo of codigos) {
    const row = await ativo()
      .whereRaw('LOWER(COALESCE(codigo, \'\')) = ?', [codigo])
      .orderBy('id')
      .first();
    if (row) return row;
  }

  const row = await ativo()
    .where(function () {
      this.whereRaw('LOWER(nome) LIKE ?', ['%conta ativada%'])
        .orWhereRaw('LOWER(nome) LIKE ?', ['%licença ativada%'])
        .orWhereRaw('LOWER(nome) LIKE ?', ['%licenca ativada%']);
    })
    .orderBy('id')
    .first();
  return row || null;
}

function buildAtivacaoFallbackHtml({ cliente, dataInicio, novaValidade, observacoes, portalBase }) {
  const nome = cliente.responsavel_nome || cliente.razao_social || 'Cliente';
  const empresa = cliente.razao_social || 'sua empresa';
  const cnpj = cliente.documento || '';
  const dataAtivacao = formatDateBr(dataInicio);
  const validade = formatDateBr(novaValidade);
  const linkDocs = `${portalBase}/documentos`;
  const linkPainel = `${portalBase}/empresas`;
  const obs = String(observacoes || '').trim();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:40px 32px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">✅</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Processo iniciado — licença ativada</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px">Sua licença SICAF está ativa — envie a documentação</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">
        Informamos que o processo SICAF de <strong>${escapeHtml(empresa)}</strong> foi <strong>iniciado com sucesso</strong>
        e a <strong>licença foi ativada</strong>${dataInicio ? ` a partir de <strong>${escapeHtml(dataAtivacao)}</strong>` : ''}.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">
        Você já pode enviar a documentação pelo portal CADBRASIL para dar continuidade ao cadastro.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Empresa</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(empresa)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">CNPJ</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace">${escapeHtml(cnpj)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Status</td><td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:#059669">Ativo</td></tr>
          ${
            dataInicio
              ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b">Licença ativa desde</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(dataAtivacao)}</td></tr>`
              : ''
          }
          ${
            novaValidade
              ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b">Validade até</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(validade)}</td></tr>`
              : ''
          }
        </table>
      </div>

      ${
        obs
          ? `<div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;padding:16px 18px;margin:0 0 24px">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#5b21b6"><strong>Observação da equipe:</strong> ${escapeHtml(obs)}</p>
      </div>`
          : ''
      }

      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 18px;margin:24px 0">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e40af">Próximo passo</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#1e40af">
          Acesse o portal e envie a documentação necessária para concluir o cadastro SICAF.
        </p>
      </div>

      <div style="text-align:center;margin-top:28px">
        <a href="${escapeHtml(linkDocs)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:0 6px 10px">Enviar documentação →</a>
        <a href="${escapeHtml(linkPainel)}" style="display:inline-block;background:#f1f5f9;color:#334155!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:0 6px 10px">Acessar minhas empresas</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:12px;color:#94a3b8"><strong>CADBRASIL</strong> · Gestão SICAF</p>
    </div>
  </div>
</body>
</html>`;
}

function buildProcessoIniciadoGovHtml({
  cliente,
  taxa,
  novaValidade,
  formaPagamento,
  portalBase,
  observacoes,
  autorizacaoManual,
}) {
  const nome = cliente.responsavel_nome || cliente.razao_social || 'Cliente';
  const empresa = cliente.razao_social || 'sua empresa';
  const cnpj = cliente.documento || '';
  const pagamento = resolvePagamentoInfo({ taxa, formaPagamento, autorizacaoManual });
  const validade = formatDateBr(novaValidade);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const links = buildPortalLinks(portalBase, String(cnpj).replace(/\D/g, ''));
  const obs = String(observacoes || '').trim();

  const valorRow = pagamento.temValor
    ? `<tr><td style="padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Valor confirmado</td><td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;color:#047857;border-bottom:1px solid #e2e8f0">${escapeHtml(pagamento.valorFormatado)}</td></tr>`
    : `<tr><td style="padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Situação financeira</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;color:#1e40af;border-bottom:1px solid #e2e8f0">${escapeHtml(pagamento.situacaoFinanceira)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Comunicado CADBRASIL — Processo SICAF Iniciado</title></head>
<body style="margin:0;padding:0;background:#e8edf2;font-family:Georgia,'Times New Roman',Times,serif;color:#1a2e44">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Processo de atualização SICAF iniciado. Instale o Assistente CADBRASIL e acesse o portal para dar continuidade.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8edf2;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #c5d0db;box-shadow:0 8px 32px rgba(15,23,42,.08)">
        <tr>
          <td style="background:linear-gradient(180deg,#0f2f52 0%,#1a4470 100%);padding:28px 32px;border-bottom:4px solid #c9a227">
            <table role="presentation" width="100%"><tr>
              <td>
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.75);font-family:Arial,Helvetica,sans-serif">Comunicado oficial</p>
                <h1 style="margin:0;font-size:22px;line-height:1.35;color:#ffffff;font-weight:700">Processo de Atualização SICAF Iniciado</h1>
                <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.88);font-family:Arial,Helvetica,sans-serif">Sistema de Cadastramento Unificado de Fornecedores — Compras.gov.br</p>
              </td>
              <td align="right" valign="top" style="font-family:Arial,Helvetica,sans-serif">
                <div style="display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:10px 14px;text-align:center">
                  <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)">Protocolo</div>
                  <div style="font-size:15px;font-weight:700;color:#ffffff;margin-top:2px">${escapeHtml(hoje)}</div>
                </div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:Arial,Helvetica,sans-serif">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#334155">Prezado(a) <strong>${escapeHtml(nome)}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#334155">
              Comunicamos que o processo de <strong>cadastro e atualização do SICAF</strong> da empresa
              <strong>${escapeHtml(empresa)}</strong>, inscrita no CNPJ <strong style="font-family:monospace">${escapeHtml(cnpj)}</strong>,
              foi <strong>oficialmente iniciado</strong> junto à plataforma CADBRASIL.
            </p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.75;color:#334155">
              A partir deste momento, sua empresa está habilitada a dar continuidade à atualização dos níveis cadastrais
              no portal <strong>Compras.gov.br</strong>, com o apoio do <strong>Assistente CADBRASIL</strong>.
            </p>

            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:4px 20px 12px;margin:0 0 24px">
              <p style="margin:16px 0 10px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f2f52">Resumo do cadastro</p>
              <table role="presentation" width="100%" style="border-collapse:collapse">
                <tr><td style="padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Razão social</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(empresa)}</td></tr>
                <tr><td style="padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">CNPJ</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace;border-bottom:1px solid #e2e8f0">${escapeHtml(cnpj)}</td></tr>
                <tr><td style="padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Situação do processo</td><td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;color:#047857;border-bottom:1px solid #e2e8f0">Em andamento</td></tr>
                ${valorRow}
                <tr><td style="padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Forma de confirmação</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(pagamento.forma)}</td></tr>
                <tr><td style="padding:8px 0;font-size:13px;color:#475569">Validade prevista do SICAF</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(validade)}</td></tr>
              </table>
            </div>

            ${
              obs
                ? `<div style="background:#fffbeb;border-left:4px solid #c9a227;padding:14px 18px;margin:0 0 24px">
              <p style="margin:0;font-size:14px;line-height:1.7;color:#78350f"><strong>Observação da equipe CADBRASIL:</strong> ${escapeHtml(obs)}</p>
            </div>`
                : ''
            }

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:20px 22px;margin:0 0 24px">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1e40af">Procedimentos para dar continuidade</p>
              <table role="presentation" width="100%" style="border-collapse:collapse">
                <tr>
                  <td valign="top" width="36" style="padding:8px 12px 8px 0;font-size:18px;font-weight:700;color:#1e40af">1</td>
                  <td style="padding:8px 0;font-size:14px;line-height:1.7;color:#1e3a5f"><strong>Instale o Assistente CADBRASIL</strong> (extensão oficial para Google Chrome) — necessário para acessar o Compras.gov.br e automatizar a atualização dos níveis.</td>
                </tr>
                <tr>
                  <td valign="top" width="36" style="padding:8px 12px 8px 0;font-size:18px;font-weight:700;color:#1e40af">2</td>
                  <td style="padding:8px 0;font-size:14px;line-height:1.7;color:#1e3a5f"><strong>Acesse a área Atualizar SICAF</strong> no portal CADBRASIL e siga o passo a passo guiado para iniciar a atualização cadastral.</td>
                </tr>
                <tr>
                  <td valign="top" width="36" style="padding:8px 12px 8px 0;font-size:18px;font-weight:700;color:#1e40af">3</td>
                  <td style="padding:8px 0;font-size:14px;line-height:1.7;color:#1e3a5f"><strong>Envie a documentação complementar</strong> na área Documentos, conforme exigências do seu ramo de atividade e dos níveis SICAF.</td>
                </tr>
                <tr>
                  <td valign="top" width="36" style="padding:8px 12px 8px 0;font-size:18px;font-weight:700;color:#1e40af">4</td>
                  <td style="padding:8px 0;font-size:14px;line-height:1.7;color:#1e3a5f"><strong>Acompanhe os níveis cadastrados</strong> pelo Assistente SICAF e mantenha certidões e cadastros sempre em conformidade.</td>
                </tr>
              </table>
            </div>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 24px">
              <tr><td align="center" style="padding:6px">
                <a href="${escapeHtml(links.link_extensao)}" style="display:inline-block;background:#0f2f52;color:#ffffff!important;padding:14px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.02em">Instalar Assistente CADBRASIL</a>
              </td></tr>
              <tr><td align="center" style="padding:6px">
                <a href="${escapeHtml(links.link_sicaf)}" style="display:inline-block;background:#047857;color:#ffffff!important;padding:14px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.02em">Iniciar atualização do SICAF</a>
              </td></tr>
              <tr><td align="center" style="padding:6px">
                <a href="${escapeHtml(links.link_assistente)}" style="display:inline-block;background:#1e40af;color:#ffffff!important;padding:14px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.02em">Acessar Assistente SICAF</a>
              </td></tr>
              <tr><td align="center" style="padding:6px">
                <a href="${escapeHtml(links.link_documentos)}" style="display:inline-block;background:#f1f5f9;color:#1e293b!important;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #cbd5e1">Enviar documentação</a>
              </td></tr>
            </table>

            <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b">
              Este comunicado foi gerado automaticamente pela plataforma CADBRASIL em ${escapeHtml(hoje)}.
              Em caso de dúvidas, entre em contato com nossa equipe de suporte pelo portal ou pelos canais oficiais de atendimento.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;border-top:1px solid #cbd5e1;padding:20px 32px;text-align:center;font-family:Arial,Helvetica,sans-serif">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0f2f52">CADBRASIL</p>
            <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b">Gestão, monitoramento e atualização do SICAF · Credenciamento junto ao Compras.gov.br</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildFallbackHtml({
  cliente,
  taxa,
  novaValidade,
  formaPagamento,
  portalBase,
  contexto = 'pagamento',
  dataInicio,
  observacoes,
  autorizacaoManual,
}) {
  if (contexto === 'ativacao') {
    return buildAtivacaoFallbackHtml({
      cliente,
      dataInicio,
      novaValidade,
      observacoes,
      portalBase,
    });
  }

  return buildProcessoIniciadoGovHtml({
    cliente,
    taxa,
    novaValidade,
    formaPagamento,
    portalBase,
    observacoes,
    autorizacaoManual,
  });
}

/**
 * @param {Object} opts
 * @param {number} opts.clienteId
 * @param {Object} [opts.taxa]
 * @param {string} [opts.novaValidade]
 * @param {string} [opts.formaPagamento]
 * @param {string} [opts.observacoes]
 * @param {number} [opts.usuarioId]
 * @param {'pagamento'|'ativacao'} [opts.contexto]
 * @param {string} [opts.dataInicio] — YYYY-MM-DD (ativação manual)
 * @param {boolean} [opts.autorizacaoManual]
 */
async function enviarAposConfirmacao({
  clienteId,
  taxa,
  novaValidade,
  formaPagamento,
  observacoes,
  usuarioId,
  contexto = 'pagamento',
  dataInicio,
  autorizacaoManual = false,
}) {
  const db = getDb();
  if (!db) return { enviado: false, motivo: 'sem_db' };

  const cliente = await db('clientes').where('id', clienteId).first();
  const emailDestino = String(cliente?.email || '').trim();
  if (!emailDestino) {
    return { enviado: false, motivo: 'sem_email_destino' };
  }

  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';
  const mensagemAdicional = buildMensagemAdicional(observacoes, contexto, dataInicio);
  const usarTemplateDb = process.env.SICAF_EMAIL_PROCESSO_USAR_TEMPLATE_DB === '1';
  const template =
    contexto === 'ativacao'
      ? await findContaAtivadaTemplate(db)
      : usarTemplateDb
        ? await findProcessoIniciadoTemplate(db)
        : null;

  const processoExtraVars =
    contexto === 'pagamento'
      ? buildProcessoIniciadoExtraVars({
          cliente,
          taxa,
          novaValidade,
          formaPagamento,
          observacoes,
          portalBase,
          autorizacaoManual,
        })
      : undefined;

  const extraVars =
    contexto === 'ativacao'
      ? {
          status: 'Ativo',
          data_inicio: formatDateBr(dataInicio),
          data_ativacao: formatDateBr(dataInicio),
          licenca_ativa_desde: formatDateBr(dataInicio),
          data_validade: formatDateBr(novaValidade),
          validade_sicaf: formatDateBr(novaValidade),
        }
      : processoExtraVars;

  if (template) {
    const envio = await emailAvisos.enviarAvisoCliente({
      clienteId,
      templateDbId: template.id,
      to: emailDestino,
      mensagemAdicional,
      usuarioId,
      extraVars,
    });

    if (!envio.ok) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        templateId: template.id,
        templateNome: template.nome,
      };
    }

    return {
      enviado: !envio.simulado,
      simulado: Boolean(envio.simulado),
      templateId: template.id,
      templateNome: template.nome,
      para: emailDestino,
      tipo: 'template',
    };
  }

  const emailService = require('./email.service');
  const html = buildFallbackHtml({
    cliente,
    taxa: contexto === 'ativacao' ? null : taxa,
    novaValidade,
    formaPagamento: contexto === 'ativacao' ? undefined : formaPagamento,
    portalBase,
    contexto,
    dataInicio,
    observacoes,
    autorizacaoManual,
  });
  const assunto =
    contexto === 'ativacao'
      ? `Licença SICAF ativada — envie sua documentação · ${cliente.razao_social || 'CADBRASIL'}`
      : `Comunicado CADBRASIL — Processo de Atualização SICAF Iniciado · ${cliente.razao_social || 'CADBRASIL'}`;

  const links = buildPortalLinks(portalBase, String(cliente.documento || '').replace(/\D/g, ''));
  const textoPlano =
    contexto === 'ativacao'
      ? `${mensagemAdicional} Acesse: ${links.link_documentos}`
      : `${mensagemAdicional}\n\nInstalar Assistente: ${links.link_extensao}\nAtualizar SICAF: ${links.link_sicaf}\nAssistente: ${links.link_assistente}\nDocumentos: ${links.link_documentos}`;

  try {
    const envio = await emailService.send({
      to: emailDestino,
      subject: assunto,
      html,
      text: textoPlano,
    });

    if (!envio.ok && !envio.skipped) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        tipo: 'fallback',
      };
    }

    return {
      enviado: Boolean(envio.sent),
      simulado: Boolean(envio.skipped),
      para: emailDestino,
      tipo: 'fallback',
      assunto,
    };
  } catch (e) {
    console.error('[PagamentoConfirmadoEmail] envio fallback:', e.message);
    return { enviado: false, motivo: 'erro_envio', erro: e.message, tipo: 'fallback' };
  }
}

module.exports = {
  enviarAposConfirmacao,
  findProcessoIniciadoTemplate,
  findContaAtivadaTemplate,
};
