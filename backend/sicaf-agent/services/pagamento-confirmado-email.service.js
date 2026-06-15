/**
 * E-mail ao cliente após confirmação/autorização do pagamento SICAF.
 * Informa que o processo foi iniciado e que a documentação pode ser enviada.
 */
const { getDb } = require('../database/connection');
const emailAvisos = require('./email-avisos.service');

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
          'Seu processo de cadastro/atualização SICAF foi iniciado com sucesso.',
          'Você já pode enviar a documentação pelo portal CADBRASIL, na área Documentos.',
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

function buildFallbackHtml({ cliente, taxa, novaValidade, formaPagamento, portalBase, contexto = 'pagamento', dataInicio, observacoes }) {
  if (contexto === 'ativacao') {
    return buildAtivacaoFallbackHtml({
      cliente,
      dataInicio,
      novaValidade,
      observacoes,
      portalBase,
    });
  }

  const nome = cliente.responsavel_nome || cliente.razao_social || 'Cliente';
  const empresa = cliente.razao_social || 'sua empresa';
  const cnpj = cliente.documento || '';
  const valor = formatMoneyBr(taxa?.valor);
  const validade = formatDateBr(novaValidade);
  const forma = formaPagamento || taxa?.forma_pagamento || 'Pagamento';
  const linkDocs = `${portalBase}/documentos`;
  const linkPainel = `${portalBase}/empresas`;
  const titulo = 'Processo SICAF iniciado';
  const subtitulo = 'Pagamento confirmado — próximo passo: documentação';
  const intro = `Confirmamos o recebimento do pagamento da taxa SICAF de <strong>${escapeHtml(empresa)}</strong>. Seu processo foi iniciado e nossa equipe já pode dar continuidade ao cadastro.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:40px 32px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">✅</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">${titulo}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px">${subtitulo}</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">
        ${intro}
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Empresa</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(empresa)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">CNPJ</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace">${escapeHtml(cnpj)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Valor pago</td><td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:#059669">${escapeHtml(valor)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Forma</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(forma)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Validade SICAF</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(validade)}</td></tr>
        </table>
      </div>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 18px;margin:24px 0">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#1e40af">
          <strong>Próximo passo:</strong> acesse o portal e envie a documentação necessária para concluir o cadastro SICAF.
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
  const template =
    contexto === 'ativacao' ? await findContaAtivadaTemplate(db) : await findProcessoIniciadoTemplate(db);

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
      : undefined;

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
  });
  const assunto =
    contexto === 'ativacao'
      ? `Licença SICAF ativada — envie sua documentação · ${cliente.razao_social || 'CADBRASIL'}`
      : `Processo SICAF iniciado — ${cliente.razao_social || 'CADBRASIL'}`;

  try {
    const envio = await emailService.send({
      to: emailDestino,
      subject: assunto,
      html,
      text: `${mensagemAdicional} Acesse: ${portalBase}/documentos`,
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
