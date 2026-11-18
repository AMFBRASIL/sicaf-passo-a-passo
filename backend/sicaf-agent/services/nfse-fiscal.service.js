/**
 * NFS-e fiscal do cliente: listar pagamentos pagos, emitir (CadBrasil prestador),
 * guardar XML/PDF no storage e enviar e-mail.
 */
const nfse = require('./nfse.service');

const NFSE_TABLE = 'nfse_emissoes';

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

async function getPrestadorDefaults() {
  const cfg = require('./nfse-config.service');
  const rt = await cfg.getNfseRuntime();
  await nfse.refreshRuntime();

  const cnpj = onlyDigits(rt.nfse_prestador_cnpj) || '52841613000155';
  const cMun = onlyDigits(rt.nfse_c_mun_emi) || '3550308';
  const serie = String(rt.nfse_serie || '1').replace(/\D/g, '') || '1';
  const im = String(rt.nfse_im_prestador || '').trim() || undefined;
  // Em produção restrita a IM costuma gerar E0120 se CNC não tiver cadastro complementar
  const includeIm =
    rt.nfse_incluir_im === 'true' ||
    (nfse.getAmbiente() === 'producao' && Boolean(im));

  // cTribNac = 6 dígitos (TSCodTribNac). Não confundir com opSimpNac ('3').
  let cTribNac = onlyDigits(rt.nfse_ctrib_nac);
  if (!/^\d{6}$/.test(cTribNac)) cTribNac = '010501';

  // cNBS = 9 dígitos. Não confundir com IM (15 dígitos).
  let cNBS = onlyDigits(rt.nfse_cnbs);
  if (!/^\d{9}$/.test(cNBS)) cNBS = '111032200';

  let cTribMun = String(rt.nfse_ctrib_mun || '001').trim();
  if (!cTribMun) cTribMun = '001';

  return {
    cnpj,
    cMun,
    serie,
    im: includeIm ? im || '000000078999987' : undefined,
    email: rt.nfse_prestador_email || 'PROMAUTONE@GMAIL.COM',
    fone: onlyDigits(rt.nfse_prestador_fone) || undefined,
    cTribNac,
    cTribMun,
    cNBS,
    opSimpNac: String(rt.nfse_op_simp_nac || '3'),
    regApTribSN: String(rt.nfse_reg_ap_trib_sn || '1'),
    regEspTrib: String(rt.nfse_reg_esp_trib || '0'),
    pTotTribSN: Number(rt.nfse_p_tot_trib_sn || 6),
    CST: String(rt.nfse_cst || '00'),
    tpRetPisCofins: String(rt.nfse_tp_ret_pis_cofins || '0'),
    tomadorIbgePadrao: onlyDigits(rt.nfse_tomador_ibge_padrao) || cMun,
  };
}

async function ensureNfseExtraColumns(db) {
  await nfse.ensureNfseTable(db);
  const cols = [
    ['xml_url', (t) => t.string('xml_url', 500).nullable()],
    ['pdf_url', (t) => t.string('pdf_url', 500).nullable()],
    ['email_enviado_em', (t) => t.timestamp('email_enviado_em').nullable()],
    ['origem', (t) => t.string('origem', 40).nullable().index()],
    ['origem_id', (t) => t.integer('origem_id').unsigned().nullable().index()],
  ];
  for (const [name, builder] of cols) {
    // eslint-disable-next-line no-await-in-loop
    const has = await db.schema.hasColumn(NFSE_TABLE, name);
    if (!has) {
      // eslint-disable-next-line no-await-in-loop
      await db.schema.table(NFSE_TABLE, builder);
    }
  }
}

function mapPaidItem(item, tipo, tipoLabel) {
  const pagamentoId = item.pagamentoId || (tipo === 'servico' || tipo === 'personalizado' ? item.id : null);
  return {
    key: `${tipo}:${item.id}:${pagamentoId || 0}`,
    tipo,
    tipoLabel,
    origemId: item.id,
    pagamentoId: pagamentoId || null,
    descricao: item.descricao || tipoLabel,
    valor: Number(item.valor) || 0,
    dataPagamento: item.data_pagamento || item.dataPagamento || null,
    dataVencimento: item.data_vencimento || item.dataVencimento || null,
    formaPagamento: item.forma_pagamento || item.formaPagamento || null,
    statusFinanceiro: 'pago',
  };
}

async function listarFiscalCliente(clienteId) {
  try {
    await nfse.refreshRuntime();
    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco indisponível' };
    await ensureNfseExtraColumns(db);

    const clientsSvc = require('./clients.service');
    const fin = await clientsSvc.getClientFinanceiro(clienteId);
    if (!fin.ok) return fin;

    const f = fin.financeiro || {};
    const pagos = [
      ...(f.sicaf?.pagos || []).map((i) => mapPaidItem(i, 'sicaf', 'Taxa SICAF')),
      ...(f.manutencao?.pagos || []).map((i) => mapPaidItem(i, 'manutencao', 'Manutenção')),
      ...(f.personalizados || [])
        .filter((i) => i.pago)
        .map((i) => mapPaidItem(i, 'personalizado', 'Cobrança')),
      ...(f.servicos || [])
        .filter((i) => i.pago)
        .map((i) =>
          mapPaidItem(i, 'servico', i.origemLabel || i.origem || 'Serviço'),
        ),
    ].sort((a, b) => {
      const ta = a.dataPagamento ? new Date(a.dataPagamento).getTime() : 0;
      const tb = b.dataPagamento ? new Date(b.dataPagamento).getTime() : 0;
      return tb - ta;
    });

    const emissoes = await db(NFSE_TABLE)
      .where('cliente_id', clienteId)
      .orderBy('id', 'desc')
      .select(
        'id',
        'status',
        'chave_acesso',
        'valor',
        'descricao',
        'pagamento_id',
        'origem',
        'origem_id',
        'xml_url',
        'pdf_url',
        'email_enviado_em',
        'erro',
        'ambiente',
        'created_at',
      );

    // emissoes já vem orderBy id desc — guarda só a mais recente por chave
    const byPagamento = new Map();
    const byOrigem = new Map();
    for (const e of emissoes) {
      if (e.pagamento_id && !byPagamento.has(Number(e.pagamento_id))) {
        byPagamento.set(Number(e.pagamento_id), e);
      }
      if (e.origem && e.origem_id) {
        const ok = `${e.origem}:${e.origem_id}`;
        if (!byOrigem.has(ok)) byOrigem.set(ok, e);
      }
    }

    const itens = pagos.map((p) => {
      const em =
        (p.pagamentoId && byPagamento.get(Number(p.pagamentoId))) ||
        byOrigem.get(`${p.tipo}:${p.origemId}`) ||
        null;
      const status = em?.status || null;
      const autorizada = status === 'autorizada';
      return {
        ...p,
        nfse: em
          ? {
              id: em.id,
              status,
              chaveAcesso: em.chave_acesso,
              xmlUrl: em.xml_url,
              pdfUrl: em.pdf_url,
              emailEnviadoEm: em.email_enviado_em,
              erro: em.erro,
              ambiente: em.ambiente,
              createdAt: em.created_at,
            }
          : null,
        // Após cancelamento, permite emitir nova nota para o mesmo pagamento
        podeEmitir: !em || !autorizada,
        podeCancelar: Boolean(autorizada && em?.chave_acesso),
      };
    });

    return {
      ok: true,
      totalPagos: itens.length,
      totalComNfse: itens.filter((i) => i.nfse?.status === 'autorizada').length,
      totalPendentes: itens.filter((i) => i.podeEmitir).length,
      itens,
      prestador: {
        cnpj: (await getPrestadorDefaults()).cnpj,
        ambiente: nfse.getAmbiente(),
      },
    };
  } catch (e) {
    console.error('[NFSeFiscal] listar:', e.message);
    return { ok: false, error: e.message };
  }
}

function parseEnderecoCliente(cliente) {
  const raw = String(cliente.endereco || '').trim();
  // "AV FOO, 123, APT 1, BAIRRO" ou texto livre
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let xLgr = parts[0] || raw || 'NAO INFORMADO';
  let nro = 'S/N';
  let xCpl = '';
  let xBairro = cliente.bairro || '';
  if (parts.length >= 2 && /^\d+|S\/N$/i.test(parts[1])) {
    nro = parts[1];
    if (parts.length >= 3 && !cliente.bairro) {
      // se último parece bairro
      xBairro = parts[parts.length - 1];
      if (parts.length > 3) xCpl = parts.slice(2, -1).join(', ');
    } else if (parts.length >= 3) {
      xCpl = parts.slice(2).join(', ');
    }
  }
  return { xLgr, nro, xCpl, xBairro: xBairro || 'CENTRO' };
}

async function buildDpsFromClientePagamento({ cliente, item, nDPS }) {
  const prest = await getPrestadorDefaults();
  const cnpjTom = onlyDigits(cliente.documento || cliente.cnpj);
  const end = parseEnderecoCliente(cliente);
  const cMunTom =
    onlyDigits(cliente.codigo_ibge || cliente.cMun || prest.tomadorIbgePadrao) ||
    prest.cMun;
  const cep = onlyDigits(cliente.cep) || '01001000';
  const valor = Number(item.valor) || 0;
  const desc =
    item.descricao ||
    `CADBRASIL — ${item.tipoLabel || 'Serviço'} — Protocolo ${item.key}`;

  return {
    cMun: prest.cMun,
    serie: prest.serie,
    nDPS,
    finNFSe: '0',
    cnpjPrestador: prest.cnpj,
    imPrestador: prest.im,
    prestador: {
      cnpj: prest.cnpj,
      im: prest.im,
      fone: prest.fone,
      email: prest.email,
      regTrib: {
        opSimpNac: prest.opSimpNac,
        regApTribSN: prest.regApTribSN,
        regEspTrib: prest.regEspTrib,
      },
    },
    tomador: {
      cnpj: cnpjTom.length === 14 ? cnpjTom : undefined,
      cpf: cnpjTom.length === 11 ? cnpjTom : undefined,
      xNome: cliente.razao_social || cliente.nome_fantasia || 'TOMADOR',
      email: cliente.email_financeiro || cliente.email || cliente.responsavel_email || undefined,
      fone: onlyDigits(cliente.telefone || cliente.celular || '') || undefined,
      end: {
        cMun: cMunTom,
        CEP: cep,
        xLgr: end.xLgr,
        nro: end.nro,
        xCpl: end.xCpl || undefined,
        xBairro: end.xBairro,
      },
    },
    servico: {
      cTribNac: prest.cTribNac,
      cTribMun: prest.cTribMun,
      cNBS: prest.cNBS,
      cLocPrestacao: cMunTom,
      xDescServ: String(desc).slice(0, 2000),
    },
    valores: {
      vServ: valor,
      tribISSQN: '1',
      tpRetISSQN: '1',
      CST: prest.CST,
      tpRetPisCofins: prest.tpRetPisCofins,
      pTotTribSN: prest.pTotTribSN,
    },
  };
}

/** PDF texto mínimo (sem deps) — comprovante da NFS-e. */
function buildPdfBuffer(info) {
  const lines = [
    'CADBRASIL — NOTA FISCAL DE SERVICO (NFS-e)',
    '----------------------------------------',
    `Chave: ${info.chaveAcesso || '—'}`,
    `Ambiente: ${info.ambiente || '—'}`,
    `Data: ${info.data || new Date().toLocaleString('pt-BR')}`,
    `Tomador: ${info.tomadorNome || '—'}`,
    `CNPJ/CPF: ${info.tomadorDoc || '—'}`,
    `Valor: R$ ${Number(info.valor || 0).toFixed(2)}`,
    `Descricao: ${info.descricao || '—'}`,
    '----------------------------------------',
    'Arquivo gerado automaticamente pelo Portal CadBrasil.',
    'O XML oficial da NFS-e acompanha este comprovante.',
  ];
  const escaped = lines.map((l) =>
    String(l)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)'),
  );
  const contentLines = ['BT', '/F1 10 Tf', '50 780 Td', '14 TL'];
  escaped.forEach((l, i) => {
    if (i === 0) contentLines.push(`(${l}) Tj`);
    else contentLines.push(`T* (${l}) Tj`);
  });
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n',
  );
  objs.push(`4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += o;
  }
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function uploadNfseArquivos({ clienteId, chaveAcesso, nfseXml, meta }) {
  const storage = require('./storage.service');
  const folder = `nfse/${clienteId}`;
  const safeChave = onlyDigits(chaveAcesso).slice(-20) || String(Date.now());
  const req = null;

  const xmlBuf = Buffer.from(nfseXml || '', 'utf8');
  const pdfBuf = buildPdfBuffer({
    chaveAcesso,
    ambiente: meta?.ambiente,
    tomadorNome: meta?.tomadorNome,
    tomadorDoc: meta?.tomadorDoc,
    valor: meta?.valor,
    descricao: meta?.descricao,
  });

  const xmlFile = {
    buffer: xmlBuf,
    originalname: `NFSe_${safeChave}.xml`,
    size: xmlBuf.length,
    mimetype: 'application/xml',
  };
  const pdfFile = {
    buffer: pdfBuf,
    originalname: `NFSe_${safeChave}.pdf`,
    size: pdfBuf.length,
    mimetype: 'application/pdf',
  };

  const [xmlUp, pdfUp] = await Promise.all([
    storage.uploadFile(xmlFile, req, folder),
    storage.uploadFile(pdfFile, req, folder),
  ]);

  return {
    xmlUrl: xmlUp.fullUrl || xmlUp.url,
    pdfUrl: pdfUp.fullUrl || pdfUp.url,
  };
}

async function enviarEmailNfse({ cliente, item, chaveAcesso, xmlUrl, pdfUrl, nfseXml }) {
  const to =
    cliente.email_financeiro ||
    cliente.email ||
    cliente.responsavel_email ||
    null;
  if (!to) return { ok: false, error: 'Cliente sem e-mail para envio da NFS-e.' };

  const emailService = require('./email.service');
  const valor = Number(item.valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="margin:0 0 8px;color:#0f766e">CADBRASIL — Nota Fiscal</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px">Sua NFS-e foi emitida com sucesso.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b">Cliente</td><td style="padding:6px 0;font-weight:600">${cliente.razao_social || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Referência</td><td style="padding:6px 0">${item.descricao || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Valor</td><td style="padding:6px 0;font-weight:600">${valor}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Chave NFS-e</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${chaveAcesso || ''}</td></tr>
      </table>
      <p style="margin:20px 0 8px;font-size:14px">
        ${pdfUrl ? `<a href="${pdfUrl}" style="display:inline-block;margin-right:8px;padding:10px 14px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">Baixar PDF</a>` : ''}
        ${xmlUrl ? `<a href="${xmlUrl}" style="display:inline-block;padding:10px 14px;background:#e2e8f0;color:#0f172a;border-radius:8px;text-decoration:none">Baixar XML</a>` : ''}
      </p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">CadBrasil Portal Licitações</p>
    </div>
  `;

  const attachments = [];
  if (nfseXml) {
    attachments.push({
      filename: `NFSe_${onlyDigits(chaveAcesso).slice(-12) || 'nota'}.xml`,
      content: Buffer.from(nfseXml, 'utf8'),
      contentType: 'application/xml',
    });
  }

  return emailService.send({
    to,
    subject: 'CADBRASIL - Nota Fiscal',
    html,
    attachments: attachments.length ? attachments : undefined,
  });
}

async function emitirFiscalPagamento(opts = {}) {
  try {
    const clienteId = Number(opts.clienteId);
    if (!clienteId) return { ok: false, error: 'clienteId obrigatório' };

    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco indisponível' };
    await ensureNfseExtraColumns(db);

    const list = await listarFiscalCliente(clienteId);
    if (!list.ok) return list;

    const item = (list.itens || []).find((i) => {
      if (opts.key && i.key === opts.key) return true;
      if (opts.pagamentoId && i.pagamentoId === Number(opts.pagamentoId)) return true;
      if (opts.origem && opts.origemId && i.tipo === opts.origem && i.origemId === Number(opts.origemId)) {
        return true;
      }
      return false;
    });
    if (!item) return { ok: false, error: 'Pagamento pago não encontrado para emissão.' };
    if (item.nfse?.status === 'autorizada') {
      return {
        ok: true,
        alreadyIssued: true,
        message: 'NFS-e já emitida para este pagamento.',
        chaveAcesso: item.nfse.chaveAcesso,
        emissaoId: item.nfse.id,
        xmlUrl: item.nfse.xmlUrl,
        pdfUrl: item.nfse.pdfUrl,
      };
    }

    const clientsSvc = require('./clients.service');
    const det = await clientsSvc.getClientById(clienteId);
    if (!det.ok || !det.client) return { ok: false, error: det.error || 'Cliente não encontrado' };
    const cliente = det.client;

    const nDPS = String(Date.now()).slice(-8);
    const dps = await buildDpsFromClientePagamento({ cliente, item, nDPS });

    const result = await nfse.emitir({
      useSystemCert: true,
      clienteId,
      usuarioId: opts.usuarioId || null,
      pagamentoId: item.pagamentoId || null,
      dps,
    });

    if (result.emissaoId) {
      try {
        await db(NFSE_TABLE).where('id', result.emissaoId).update({
          origem: item.tipo,
          origem_id: item.origemId,
          updated_at: db.fn.now(),
        });
      } catch (_) {}
    }

    if (!result.ok) return result;

    let xmlUrl = null;
    let pdfUrl = null;
    try {
      const up = await uploadNfseArquivos({
        clienteId,
        chaveAcesso: result.chaveAcesso,
        nfseXml: result.nfseXml || result.dpsXmlAssinado,
        meta: {
          ambiente: result.ambiente,
          tomadorNome: dps.tomador?.xNome,
          tomadorDoc: dps.tomador?.cnpj || dps.tomador?.cpf,
          valor: item.valor,
          descricao: item.descricao,
        },
      });
      xmlUrl = up.xmlUrl;
      pdfUrl = up.pdfUrl;
      if (result.emissaoId) {
        await db(NFSE_TABLE).where('id', result.emissaoId).update({
          xml_url: xmlUrl,
          pdf_url: pdfUrl,
          updated_at: db.fn.now(),
        });
      }
    } catch (e) {
      console.warn('[NFSeFiscal] upload arquivos:', e.message);
    }

    let email = null;
    try {
      email = await enviarEmailNfse({
        cliente,
        item,
        chaveAcesso: result.chaveAcesso,
        xmlUrl,
        pdfUrl,
        nfseXml: result.nfseXml || result.dpsXmlAssinado,
      });
      if (email?.ok && result.emissaoId) {
        await db(NFSE_TABLE).where('id', result.emissaoId).update({
          email_enviado_em: db.fn.now(),
          updated_at: db.fn.now(),
        });
      }
    } catch (e) {
      email = { ok: false, error: e.message };
      console.warn('[NFSeFiscal] email:', e.message);
    }

    return {
      ...result,
      xmlUrl,
      pdfUrl,
      email,
      itemKey: item.key,
    };
  } catch (e) {
    console.error('[NFSeFiscal] emitir:', e.message);
    return { ok: false, error: e.message };
  }
}

async function cancelarFiscalEmissao(opts = {}) {
  try {
    const clienteId = Number(opts.clienteId);
    const emissaoId = Number(opts.emissaoId);
    if (!clienteId || !emissaoId) {
      return { ok: false, error: 'clienteId e emissaoId são obrigatórios' };
    }

    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco indisponível' };
    await ensureNfseExtraColumns(db);

    const row = await db(NFSE_TABLE)
      .where('id', emissaoId)
      .where('cliente_id', clienteId)
      .first();
    if (!row) return { ok: false, error: 'Emissão não encontrada' };
    if (row.status === 'cancelada') {
      return { ok: true, alreadyCancelled: true, message: 'NFS-e já estava cancelada.', emissaoId };
    }
    if (row.status !== 'autorizada' || !row.chave_acesso) {
      return { ok: false, error: 'Só é possível cancelar NFS-e autorizada com chave de acesso.' };
    }

    const result = await nfse.cancelar({
      useSystemCert: true,
      clienteId,
      chaveAcesso: row.chave_acesso,
      cMotivo: opts.cMotivo || '1',
      xMotivo: opts.xMotivo || opts.motivo || 'Cancelamento solicitado no painel Fiscal CadBrasil',
    });

    if (!result.ok) {
      try {
        await db(NFSE_TABLE).where('id', emissaoId).update({
          erro: String(result.error || '').slice(0, 2000),
          updated_at: db.fn.now(),
        });
      } catch (_) {}
      return result;
    }

    await db(NFSE_TABLE).where('id', emissaoId).update({
      status: 'cancelada',
      erro: null,
      resposta_json: result.resposta
        ? JSON.stringify(result.resposta).slice(0, 65000)
        : row.resposta_json,
      updated_at: db.fn.now(),
    });

    return {
      ...result,
      emissaoId,
      status: 'cancelada',
    };
  } catch (e) {
    console.error('[NFSeFiscal] cancelar:', e.message);
    return { ok: false, error: e.message };
  }
}

async function obterArquivoEmissao(opts = {}) {
  try {
    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco indisponível' };
    await ensureNfseExtraColumns(db);

    const id = Number(opts.emissaoId);
    let q = db(NFSE_TABLE).where('id', id);
    if (opts.clienteId != null && Number(opts.clienteId) > 0) {
      q = q.where('cliente_id', Number(opts.clienteId));
    }
    const row = await q.first();
    if (!row) return { ok: false, error: 'Emissão não encontrada' };

    const tipo = String(opts.tipo || 'xml').toLowerCase();
    if (tipo === 'pdf') {
      if (row.pdf_url) return { ok: true, url: row.pdf_url, tipo: 'pdf' };
      const buf = buildPdfBuffer({
        chaveAcesso: row.chave_acesso,
        ambiente: row.ambiente,
        tomadorNome: row.tomador_nome,
        tomadorDoc: row.tomador_doc,
        valor: row.valor,
        descricao: row.descricao,
      });
      return { ok: true, buffer: buf, filename: `NFSe_${row.id}.pdf`, contentType: 'application/pdf' };
    }

    if (row.xml_url) return { ok: true, url: row.xml_url, tipo: 'xml' };
    if (row.nfse_xml) {
      return {
        ok: true,
        buffer: Buffer.from(row.nfse_xml, 'utf8'),
        filename: `NFSe_${row.id}.xml`,
        contentType: 'application/xml',
      };
    }
    if (row.dps_xml) {
      return {
        ok: true,
        buffer: Buffer.from(row.dps_xml, 'utf8'),
        filename: `DPS_${row.id}.xml`,
        contentType: 'application/xml',
      };
    }
    return { ok: false, error: 'Arquivo não disponível' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Painel admin global: todas as NFS-e do sistema + indicadores.
 */
async function listarPainelAdmin(opts = {}) {
  try {
    await nfse.refreshRuntime();
    const { getDb } = require('../database/connection');
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco indisponível' };
    await ensureNfseExtraColumns(db);

    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize) || 20));
    const status = String(opts.status || '').trim().toLowerCase();
    const q = String(opts.q || '').trim();

    let base = db(NFSE_TABLE + ' as n')
      .leftJoin('clientes as c', 'c.id', 'n.cliente_id')
      .select(
        'n.id',
        'n.cliente_id',
        'n.ambiente',
        'n.status',
        'n.chave_acesso',
        'n.serie',
        'n.numero_dps',
        'n.valor',
        'n.tomador_doc',
        'n.tomador_nome',
        'n.descricao',
        'n.pagamento_id',
        'n.origem',
        'n.origem_id',
        'n.xml_url',
        'n.pdf_url',
        'n.email_enviado_em',
        'n.erro',
        'n.created_at',
        'n.updated_at',
        'c.razao_social as cliente_razao',
        'c.documento as cliente_documento',
        'c.email as cliente_email',
      );

    if (status && status !== 'todos' && status !== 'all') {
      base = base.where('n.status', status);
    }
    if (q) {
      const like = `%${q}%`;
      base = base.andWhere(function () {
        this.where('n.chave_acesso', 'like', like)
          .orWhere('n.tomador_nome', 'like', like)
          .orWhere('n.tomador_doc', 'like', like)
          .orWhere('n.descricao', 'like', like)
          .orWhere('c.razao_social', 'like', like)
          .orWhere('c.documento', 'like', like);
      });
    }

    const countRow = await base.clone().clearSelect().clearOrder().countDistinct({ total: 'n.id' }).first();
    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const rows = await base
      .clone()
      .orderBy('n.id', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Indicadores (independentes do filtro de página, mas respeitam busca/status se quiser — aqui globais do sistema)
    const statsRows = await db(NFSE_TABLE)
      .select('status')
      .sum({ valor: 'valor' })
      .count({ qtd: '*' })
      .groupBy('status');

    const indicadores = {
      total: 0,
      autorizadas: 0,
      canceladas: 0,
      rejeitadas: 0,
      pendentes: 0,
      valorAutorizado: 0,
      valorCancelado: 0,
    };
    for (const r of statsRows) {
      const st = String(r.status || '');
      const qtd = Number(r.qtd) || 0;
      const valor = Number(r.valor) || 0;
      indicadores.total += qtd;
      if (st === 'autorizada') {
        indicadores.autorizadas += qtd;
        indicadores.valorAutorizado += valor;
      } else if (st === 'cancelada') {
        indicadores.canceladas += qtd;
        indicadores.valorCancelado += valor;
      } else if (st === 'rejeitada') {
        indicadores.rejeitadas += qtd;
      } else {
        indicadores.pendentes += qtd;
      }
    }

    // Série últimos 14 dias (autorizadas)
    const desde = new Date();
    desde.setDate(desde.getDate() - 13);
    desde.setHours(0, 0, 0, 0);
    let serieRows = [];
    try {
      serieRows = await db(NFSE_TABLE)
        .where('status', 'autorizada')
        .where('created_at', '>=', desde)
        .select(db.raw('DATE(created_at) as dia'))
        .sum({ valor: 'valor' })
        .count({ qtd: '*' })
        .groupByRaw('DATE(created_at)')
        .orderBy('dia', 'asc');
    } catch (_) {
      serieRows = [];
    }
    const serieMap = new Map(
      serieRows.map((r) => [String(r.dia).slice(0, 10), { qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0 }]),
    );
    const serie = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(desde);
      d.setDate(desde.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const hit = serieMap.get(key) || { qtd: 0, valor: 0 };
      serie.push({
        d: key,
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        qtd: hit.qtd,
        valor: hit.valor,
      });
    }

    return {
      ok: true,
      indicadores,
      serie,
      ambiente: nfse.getAmbiente(),
      pagination: { page, pageSize, total, totalPages },
      emissoes: rows.map((r) => ({
        id: r.id,
        clienteId: r.cliente_id,
        clienteRazao: r.cliente_razao || null,
        clienteDocumento: r.cliente_documento || null,
        clienteEmail: r.cliente_email || null,
        ambiente: r.ambiente,
        status: r.status,
        chaveAcesso: r.chave_acesso,
        serie: r.serie,
        numeroDps: r.numero_dps,
        valor: r.valor != null ? Number(r.valor) : null,
        tomadorDoc: r.tomador_doc,
        tomadorNome: r.tomador_nome,
        descricao: r.descricao,
        pagamentoId: r.pagamento_id,
        origem: r.origem,
        origemId: r.origem_id,
        xmlUrl: r.xml_url,
        pdfUrl: r.pdf_url,
        emailEnviadoEm: r.email_enviado_em,
        erro: r.erro,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        podeCancelar: r.status === 'autorizada' && Boolean(r.chave_acesso),
      })),
    };
  } catch (e) {
    console.error('[NFSeFiscal] listarPainelAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  getPrestadorDefaults,
  listarFiscalCliente,
  listarPainelAdmin,
  emitirFiscalPagamento,
  cancelarFiscalEmissao,
  obterArquivoEmissao,
  ensureNfseExtraColumns,
};
