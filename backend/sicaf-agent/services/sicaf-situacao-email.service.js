/**
 * E-mail ao cliente após processar PDF "Situação do Fornecedor" no Assistente.
 */
const emailService = require('./email.service');

const NIVEL_NOMES = {
  I: 'Credenciamento',
  II: 'Habilitação Jurídica',
  III: 'Regularidade Fiscal e Trabalhista Federal',
  IV: 'Regularidade Fiscal Estadual/Distrital e Municipal',
  V: 'Qualificação Técnica',
  VI: 'Qualificação Econômico-Financeira',
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('vencid') || s === 'pendente') return { icon: '❌', color: '#dc2626', label: 'Atenção' };
  if (s.includes('vencendo') || s.includes('parcial')) return { icon: '⚠️', color: '#d97706', label: 'Vencendo' };
  if (s.includes('não informado') || s.includes('nao informado')) return { icon: '⚪', color: '#6b7280', label: 'Não informado' };
  return { icon: '✅', color: '#059669', label: 'Regular' };
}

function nivelTemProblema(status) {
  const s = String(status || '').toLowerCase();
  return s.includes('pend') || s.includes('vencid') || s.includes('parcial');
}

function buildNiveisTableHtml(niveisEvidencias) {
  const rows = (niveisEvidencias || []).map((n) => {
    const tone = statusTone(n.status);
    const nome = NIVEL_NOMES[n.nivel] || `Nível ${n.nivel}`;
    const habilitado = n.habilitado
      ? `<span style="color:#059669;font-weight:600">Habilitado</span>`
      : `<span style="color:#6b7280">Não habilitado</span>`;
    const obs = n.observacao
      ? `<div style="margin-top:6px;font-size:12px;color:#4b5563;white-space:pre-line">${escapeHtml(n.observacao)}</div>`
      : '';

    return `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:42px;font-size:18px">${tone.icon}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <div style="font-weight:700;color:#111827">Nível ${escapeHtml(n.nivel)} — ${escapeHtml(nome)}</div>
          <div style="margin-top:4px;font-size:13px">${habilitado} · <strong style="color:${tone.color}">${escapeHtml(n.status || '—')}</strong></div>
          ${obs}
        </td>
      </tr>`;
  });

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;border-collapse:separate">
      ${rows.join('')}
    </table>`;
}

function buildEmailHtml({ cliente, cnpj, niveisEvidencias, sicafStatus, certidoesCount }) {
  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';
  const habilitados = (niveisEvidencias || []).filter((n) => n.habilitado);
  const problemas = habilitados.filter((n) => nivelTemProblema(n.status));
  const tudoOk = habilitados.length > 0 && problemas.length === 0;
  const resumo = tudoOk
    ? 'Analisamos sua Situação do Fornecedor e todos os níveis habilitados estão regulares.'
    : problemas.length > 0
      ? `Identificamos ${problemas.length} nível(is) que precisam de atenção. Confira os detalhes abaixo.`
      : 'Recebemos sua Situação do Fornecedor e atualizamos o cadastro no sistema CADBRASIL.';

  const badgeBg = tudoOk ? '#ecfdf5' : '#fffbeb';
  const badgeBorder = tudoOk ? '#6ee7b7' : '#fcd34d';
  const badgeText = tudoOk ? '#047857' : '#b45309';
  const badgeLabel = tudoOk ? 'Cadastro em ordem' : 'Revise as pendências';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <div style="background:#0d9488;color:#fff;padding:20px 24px;border-radius:16px 16px 0 0">
      <div style="font-size:12px;opacity:.85;letter-spacing:.06em;text-transform:uppercase">CADBRASIL — Assistente SICAF</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">Situação do Fornecedor processada</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
      <p style="margin:0 0 8px;font-size:15px">Olá, <strong>${escapeHtml(cliente.responsavel_nome || cliente.razao_social || 'Cliente')}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6">${escapeHtml(resumo)}</p>

      <div style="background:${badgeBg};border:1px solid ${badgeBorder};color:${badgeText};padding:12px 14px;border-radius:10px;font-size:13px;font-weight:600;margin-bottom:18px">
        ${badgeLabel}
      </div>

      <table role="presentation" width="100%" style="margin-bottom:18px;font-size:13px">
        <tr>
          <td style="padding:6px 0;color:#6b7280">Empresa</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(cliente.razao_social || '—')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">CNPJ</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(cnpj || cliente.documento || '—')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">Certidões processadas</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${Number(certidoesCount) || 0}</td>
        </tr>
        ${
          sicafStatus?.completude != null
            ? `<tr>
          <td style="padding:6px 0;color:#6b7280">Completude SICAF</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${Number(sicafStatus.completude) || 0}%</td>
        </tr>`
            : ''
        }
      </table>

      <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280">Detalhes por nível</h2>
      ${buildNiveisTableHtml(niveisEvidencias)}

      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
        Acesse o painel para acompanhar certidões, pendências e próximos passos.
      </p>
      <p style="margin:16px 0 0">
        <a href="${escapeHtml(portalBase)}/empresas" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">
          Abrir minhas empresas
        </a>
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px">
      E-mail automático CADBRASIL · ${new Date().toLocaleString('pt-BR')}
    </p>
  </div>
</body></html>`;
}

/**
 * @param {object} params
 * @param {object} params.cliente - linha clientes
 * @param {string} params.cnpj
 * @param {Array} params.niveisEvidencias
 * @param {object} [params.sicafStatus]
 * @param {number} [params.certidoesCount]
 */
async function sendSituacaoFornecedorEmail({
  cliente,
  cnpj,
  niveisEvidencias,
  sicafStatus,
  certidoesCount,
}) {
  const emailDestino = String(cliente?.email || '').trim();
  if (!emailDestino) {
    return { enviado: false, motivo: 'sem_email_destino' };
  }

  const habilitados = (niveisEvidencias || []).filter((n) => n.habilitado);
  const problemas = habilitados.filter((n) => nivelTemProblema(n.status));
  const tudoOk = habilitados.length > 0 && problemas.length === 0;

  const assunto = tudoOk
    ? `SICAF em ordem — ${cliente.razao_social || cnpj}`
    : `Situação SICAF — ${problemas.length} pendência(s) — ${cliente.razao_social || cnpj}`;

  const html = buildEmailHtml({
    cliente,
    cnpj,
    niveisEvidencias,
    sicafStatus,
    certidoesCount,
  });

  try {
    const envio = await emailService.send({
      to: emailDestino,
      subject: assunto,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });

    if (!envio.ok && !envio.sent) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar e-mail',
        para: emailDestino,
      };
    }

    console.log(`  [Email] ✔ Situação do Fornecedor enviada para ${emailDestino}`);
    return {
      enviado: !envio.skipped,
      simulado: Boolean(envio.skipped),
      para: emailDestino,
      assunto,
      tipo: tudoOk ? 'sicaf_regular' : 'sicaf_pendencias',
    };
  } catch (e) {
    console.error('[Email] Erro sendSituacaoFornecedorEmail:', e.message);
    return { enviado: false, motivo: 'erro_envio', erro: e.message, para: emailDestino };
  }
}

module.exports = {
  sendSituacaoFornecedorEmail,
  buildEmailHtml,
  NIVEL_NOMES,
};
