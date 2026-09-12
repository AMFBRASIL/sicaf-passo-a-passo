/**
 * E-mail de despedida ao cancelar CNPJ em /admin/clientes.
 */
const emailService = require('./email.service');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveEmailDestino(cliente) {
  return String(cliente?.responsavel_email || cliente?.email || '')
    .trim()
    .toLowerCase();
}

function resolveNome(cliente) {
  return (
    String(cliente?.responsavel_nome || cliente?.nome_fantasia || cliente?.razao_social || 'Cliente').trim() ||
    'Cliente'
  );
}

function portalBaseUrl() {
  return (
    process.env.PORTAL_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://fornecedor.cadbrasil.com.br'
  );
}

function buildDespedidaHtml({ cliente, motivo }) {
  const nome = resolveNome(cliente);
  const empresa = cliente.razao_social || cliente.nome_fantasia || 'sua empresa';
  const documento = cliente.documento || '—';
  const portal = portalBaseUrl().replace(/\/$/, '');
  const linkSuporte = `${portal}/suporte`;
  const linkPortal = `${portal}/empresas`;
  const obs = String(motivo || '').trim();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0f172a,#334155);padding:40px 32px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">👋</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Foi um prazer ajudar</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px">Encerramos o cadastro, mas a porta continua aberta</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">
        Confirmamos o <strong>cancelamento do cadastro</strong> de
        <strong>${escapeHtml(empresa)}</strong> (${escapeHtml(documento)}) no portal CADBRASIL.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">
        Agradecemos a confiança em nossa equipe. Se no futuro precisar novamente de apoio com SICAF,
        certidões, licitações ou manutenção, será um prazer receber você de volta.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b">Empresa</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(empresa)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b">Documento</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace">${escapeHtml(documento)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b">Situação</td>
            <td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:#64748b">Cadastro encerrado</td>
          </tr>
        </table>
      </div>

      ${
        obs
          ? `<div style="background:#f8fafc;border-left:4px solid #64748b;border-radius:8px;padding:16px 18px;margin:0 0 24px">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#475569"><strong>Registro interno:</strong> ${escapeHtml(obs)}</p>
      </div>`
          : ''
      }

      <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:8px;padding:16px 18px;margin:24px 0">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e40af">Precisou de ajuda de novo?</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#1e40af">
          Responda este e-mail ou fale com nosso suporte. Estamos prontos para retomar o atendimento quando quiser.
        </p>
      </div>

      <div style="text-align:center;margin-top:28px">
        <a href="${escapeHtml(linkSuporte)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:0 6px 10px">Falar com o suporte →</a>
        <a href="${escapeHtml(linkPortal)}" style="display:inline-block;background:#f1f5f9;color:#334155!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:0 6px 10px">Acessar o portal</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:12px;color:#94a3b8"><strong>CADBRASIL</strong> · Credenciamento SICAF · ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}</p>
    </div>
  </div>
</body>
</html>`;
}

async function findTemplateDespedida(db) {
  if (!db || !(await db.schema.hasTable('templates_email'))) return null;
  const ativo = () => db('templates_email').whereRaw('COALESCE(ativo, 1) = 1');

  try {
    const byCodigo = await ativo()
      .whereIn('codigo', ['despedida_cancelamento', 'cancelamento_cnpj', 'despedida'])
      .orderBy('id', 'asc')
      .first();
    if (byCodigo) return byCodigo;
  } catch (_) {}

  try {
    return await ativo()
      .where(function () {
        this.where('nome', 'like', '%despedida%')
          .orWhere('assunto', 'like', '%despedida%')
          .orWhere('nome', 'like', '%cancelamento de cnpj%')
          .orWhere('nome', 'like', '%cancelamento cnpj%');
      })
      .orderBy('id', 'asc')
      .first();
  } catch (_) {
    return null;
  }
}

/**
 * Envia e-mail de despedida após cancelamento de CNPJ.
 * @param {{ db: any, cliente: object, motivo?: string, usuarioId?: number }} opts
 */
async function sendCancelamentoCnpjEmail({ db, cliente, motivo, usuarioId }) {
  if (!cliente) return { enviado: false, motivo: 'cliente_invalido' };

  const emailDestino = resolveEmailDestino(cliente);
  if (!emailDestino) {
    return { enviado: false, motivo: 'sem_email_destino' };
  }

  const empresa = cliente.razao_social || cliente.nome_fantasia || 'sua empresa';
  const templateRow = await findTemplateDespedida(db);

  if (templateRow) {
    try {
      const emailAvisos = require('./email-avisos.service');
      const envio = await emailAvisos.enviarAvisoCliente({
        clienteId: cliente.id,
        templateDbId: templateRow.id,
        to: emailDestino,
        mensagemAdicional: String(motivo || '').trim(),
        usuarioId,
        extraVars: {
          motivo_cancelamento: String(motivo || '').trim(),
          status_novo: 'Inativo',
          tipo_cancelamento: 'cnpj',
        },
      });

      if (!envio.ok) {
        return {
          enviado: false,
          motivo: 'erro_envio',
          erro: envio.error || 'Falha ao enviar',
          templateId: templateRow.id,
          templateNome: templateRow.nome,
          para: emailDestino,
        };
      }

      return {
        enviado: !envio.simulado,
        simulado: Boolean(envio.simulado),
        templateId: templateRow.id,
        templateNome: templateRow.nome,
        para: emailDestino,
        tipo: 'despedida_cancelamento',
      };
    } catch (e) {
      // Continua no fallback HTML se o template falhar.
      console.warn('[CancelamentoCnpjEmail] Template falhou, usando fallback:', e.message);
    }
  }

  const assunto = `Foi um prazer ajudar — ${empresa}`;
  const html = buildDespedidaHtml({ cliente, motivo });

  try {
    const envio = await emailService.send({
      to: emailDestino,
      subject: assunto,
      html,
      text: [
        `Olá ${resolveNome(cliente)},`,
        '',
        `Confirmamos o cancelamento do cadastro de ${empresa} (${cliente.documento || '—'}) no portal CADBRASIL.`,
        'Agradecemos a confiança. Se precisar novamente de ajuda com SICAF, certidões ou licitações, será um prazer receber você de volta.',
        '',
        'Equipe CADBRASIL',
      ].join('\n'),
    });

    if (!envio.ok && !envio.skipped) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        para: emailDestino,
        tipo: 'despedida_cancelamento',
      };
    }

    return {
      enviado: Boolean(envio.sent),
      simulado: Boolean(envio.skipped),
      para: emailDestino,
      assunto,
      tipo: 'despedida_cancelamento',
      origem: 'fallback',
    };
  } catch (e) {
    return {
      enviado: false,
      motivo: 'erro_envio',
      erro: e.message,
      para: emailDestino,
      tipo: 'despedida_cancelamento',
    };
  }
}

module.exports = {
  sendCancelamentoCnpjEmail,
  buildDespedidaHtml,
  findTemplateDespedida,
};
