/**
 * Boletim diário de licitações segmentadas por cliente (ramo_atividade / segmento).
 * Elegibilidade: manutenção ativa ou primeiros N dias após cadastro (trial).
 */
const { getDb } = require('../database/connection');
const emailService = require('./email.service');

const LOG_PREFIX = '[BoletimLicitacoes]';

/** Status de manutenção considerados ativos (mesma regra do admin/funil). */
const MANUTENCAO_ATIVA_SQL =
  "LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo','ativa','a vencer','vencendo')";

const DIAS_TRIAL_PADRAO = 10;

function diasTrialBoletim() {
  const n = Number(process.env.LICITACOES_BOLETIM_DIAS_TRIAL || DIAS_TRIAL_PADRAO);
  return Math.max(1, Math.min(Number.isFinite(n) ? n : DIAS_TRIAL_PADRAO, 90));
}

function clienteElegivelBoletimWhereRaw(diasTrial) {
  const dias = Math.max(1, Math.min(Number(diasTrial) || DIAS_TRIAL_PADRAO, 90));
  return `(
    EXISTS (
      SELECT 1 FROM manutencoes m
      WHERE m.cliente_id = clientes.id
      AND ${MANUTENCAO_ATIVA_SQL}
    )
    OR EXISTS (
      SELECT 1 FROM sicaf_cadastros s
      WHERE s.cliente_id = clientes.id
      AND COALESCE(s.manutencao_ativa, 0) = 1
    )
    OR clientes.created_at >= DATE_SUB(NOW(), INTERVAL ${dias} DAY)
  )`;
}

async function resolveElegibilidadeBoletim(db, cliente) {
  const diasTrial = diasTrialBoletim();
  const clienteId = Number(cliente.id);
  if (!Number.isFinite(clienteId) || clienteId <= 0) {
    return { elegivel: false, motivo: 'invalido', error: 'Cliente inválido.' };
  }

  const manutRow = await db('manutencoes as m')
    .where('m.cliente_id', clienteId)
    .whereRaw(MANUTENCAO_ATIVA_SQL)
    .first();
  if (manutRow) {
    return { elegivel: true, motivo: 'manutencao_ativa', diasTrialRestantes: null };
  }

  const sicafRow = await db('sicaf_cadastros')
    .where('cliente_id', clienteId)
    .whereRaw('COALESCE(manutencao_ativa, 0) = 1')
    .first();
  if (sicafRow) {
    return { elegivel: true, motivo: 'manutencao_ativa', diasTrialRestantes: null };
  }

  const createdAt = cliente.created_at ? new Date(cliente.created_at) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    const diffDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= diasTrial) {
      return {
        elegivel: true,
        motivo: 'periodo_teste',
        diasTrialRestantes: Math.max(0, Math.ceil(diasTrial - diffDays)),
      };
    }
  }

  return {
    elegivel: false,
    motivo: 'sem_plano',
    error: `Cliente sem plano de manutenção ativo e fora do período de teste (${diasTrial} dias após o cadastro).`,
    diasTrial,
  };
}

const SEGMENT_KEYWORDS = {
  Tecnologia: [
    'informática',
    'informatica',
    'software',
    'hardware',
    'ti',
    'tecnologia',
    'computador',
    'notebook',
    'servidor',
    'rede',
    'cloud',
    'dados',
    'digital',
    'sistema informat',
    'licença de software',
    'licenca de software',
    'suprimento de informática',
    'equipamento de informática',
  ],
  Informática: [
    'informática',
    'informatica',
    'software',
    'hardware',
    'ti',
    'tecnologia',
    'computador',
    'notebook',
    'servidor',
    'rede',
    'cloud',
    'suprimento de informática',
  ],
  Construção: [
    'construção',
    'construcao',
    'obra',
    'engenharia civil',
    'reforma',
    'pavimentação',
    'pavimentacao',
    'edificação',
    'infraestrutura',
  ],
  Engenharia: ['engenharia', 'projeto', 'consultoria técnica', 'laudo', 'topografia'],
  Serviços: ['serviço', 'servico', 'prestação', 'prestacao', 'manutenção', 'manutencao', 'limpeza'],
  Comércio: ['comércio', 'comercio', 'fornecimento', 'aquisição', 'aquisicao', 'material', 'suprimento'],
  Comercio: ['comércio', 'comercio', 'fornecimento', 'aquisição', 'aquisicao', 'material', 'suprimento'],
  Energia: ['energia', 'elétrica', 'eletrica', 'solar', 'geração', 'geracao', 'combustível', 'combustivel'],
  Outro: [],
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function normalizeSegmentKey(ramo) {
  const r = String(ramo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!r) return null;
  for (const key of Object.keys(SEGMENT_KEYWORDS)) {
    const nk = key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (r === nk || r.includes(nk) || nk.includes(r)) return key;
  }
  if (r.includes('informatica') || r.includes('tecnologia') || r.includes('software')) return 'Tecnologia';
  if (r.includes('construcao') || r.includes('obra')) return 'Construção';
  return null;
}

function keywordsForCliente(cliente) {
  const ramo = String(cliente.ramo_atividade || '').trim();
  const segmentKey = normalizeSegmentKey(ramo);
  const set = new Set();

  if (segmentKey && SEGMENT_KEYWORDS[segmentKey]) {
    for (const k of SEGMENT_KEYWORDS[segmentKey]) set.add(k.toLowerCase());
  }

  for (const token of ramo.toLowerCase().split(/[\s,/;-]+/)) {
    const t = token.trim();
    if (t.length >= 4) set.add(t);
  }

  return { segmentKey: segmentKey || ramo || 'Geral', keywords: [...set] };
}

function licitacaoTexto(lic) {
  return `${lic.objeto_resumido || ''} ${lic.objeto || ''} ${lic.nome_orgao || ''}`.toLowerCase();
}

function matchLicitacao(lic, keywords, cliente, opts) {
  if (!keywords.length) return false;
  const texto = licitacaoTexto(lic);
  if (!keywords.some((k) => texto.includes(k))) return false;

  if (opts.filtrarUf && cliente.estado && lic.uf) {
    const ufCliente = String(cliente.estado).trim().toUpperCase();
    const ufLic = String(lic.uf).trim().toUpperCase();
    if (ufCliente && ufLic && ufCliente !== ufLic) return false;
  }

  return true;
}

function resolveEmail(cliente) {
  return String(cliente.responsavel_email || cliente.email || '').trim();
}

function resolveNome(cliente) {
  return (
    String(cliente.responsavel_nome || cliente.nome_fantasia || cliente.razao_social || 'Cliente').trim() ||
    'Cliente'
  );
}

function buildPncpUrl(lic) {
  const ctrl = String(lic.numero_controle_pncp || '').trim();
  if (ctrl) {
    const parts = ctrl.split('/');
    if (parts.length >= 3) {
      const [cnpj, ano, seq] = parts;
      return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
    }
  }
  if (lic.link_edital) return lic.link_edital;
  if (lic.link_portal) return lic.link_portal;
  return null;
}

function buildEmailHtml({ cliente, segmento, itens, portalBase }) {
  const nome = resolveNome(cliente);
  const empresa = cliente.nome_fantasia || cliente.razao_social || 'sua empresa';
  const linkPortal = `${portalBase}/licitacoes`;

  const rows = itens
    .map((lic) => {
      const url = buildPncpUrl(lic) || linkPortal;
      const objeto = escapeHtml(lic.objeto_resumido || lic.objeto || 'Licitação');
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#0f172a;">${objeto}</p>
            <p style="margin:0;font-size:12px;color:#64748b;">
              ${escapeHtml(lic.nome_orgao || 'Órgão')} · ${escapeHtml(lic.uf || '—')} · ${escapeHtml(lic.modalidade || '—')}
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#334155;">
              Valor estimado: <strong>${formatMoney(lic.valor_estimado)}</strong>
              · Encerramento: ${formatDate(lic.data_encerramento || lic.data_abertura)}
            </p>
            <p style="margin:8px 0 0;">
              <a href="${escapeHtml(url)}" style="font-size:12px;color:#2563eb;text-decoration:none;font-weight:600;">Ver edital →</a>
            </p>
          </td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px;color:#ffffff;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">CADBRASIL · Boletim de licitações</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;">Oportunidades para ${escapeHtml(empresa)}</h1>
            <p style="margin:8px 0 0;font-size:13px;opacity:.92;">Segmento: ${escapeHtml(segmento)} · ${itens.length} licitação(ões) compatível(is)</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
              Olá <strong>${escapeHtml(nome)}</strong>, selecionamos licitações alinhadas ao perfil de <strong>${escapeHtml(empresa)}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            <p style="margin:20px 0 0;text-align:center;">
              <a href="${escapeHtml(linkPortal)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">
                Ver todas no portal
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">
            Você recebe este boletim porque está cadastrado na CADBRASIL.<br/>
            Segmento cadastrado: ${escapeHtml(cliente.ramo_atividade || segmento)}.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function ensureEnviosTable(db) {
  const exists = await db.schema.hasTable('licitacoes_email_envios');
  if (exists) return;
  await db.raw(`
    CREATE TABLE licitacoes_email_envios (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      cliente_id INT NOT NULL,
      licitacao_id INT NOT NULL,
      processo_exec_id BIGINT UNSIGNED NULL,
      enviado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_lic_email_cliente_lic (cliente_id, licitacao_id),
      KEY idx_lic_email_cliente_data (cliente_id, enviado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const CLIENTE_SELECT_FIELDS = [
  'id',
  'razao_social',
  'nome_fantasia',
  'documento',
  'email',
  'responsavel_email',
  'responsavel_nome',
  'ramo_atividade',
  'estado',
  'cidade',
  'status',
  'created_at',
];

async function loadClientesElegiveis(db) {
  const hasTable = await db.schema.hasTable('clientes');
  if (!hasTable) return [];

  const diasTrial = diasTrialBoletim();

  return db('clientes')
    .select(...CLIENTE_SELECT_FIELDS)
    .whereRaw("COALESCE(NULLIF(TRIM(status), ''), 'Ativo') <> 'Inativo'")
    .whereRaw(
      "COALESCE(NULLIF(TRIM(responsavel_email), ''), NULLIF(TRIM(email), '')) IS NOT NULL",
    )
    .whereRaw("TRIM(COALESCE(ramo_atividade, '')) <> ''")
    .whereRaw(clienteElegivelBoletimWhereRaw(diasTrial))
    .orderBy('id', 'asc');
}

async function findClienteByIdentificador(db, identificador) {
  const raw = String(identificador || '').trim();
  if (!raw) {
    return { ok: false, error: 'Informe o e-mail ou CNPJ do cliente.' };
  }

  let row = null;

  if (raw.includes('@')) {
    const email = raw.toLowerCase();
    row = await db('clientes')
      .select(...CLIENTE_SELECT_FIELDS)
      .where(function whereEmail() {
        this.whereRaw('LOWER(TRIM(COALESCE(responsavel_email, ""))) = ?', [email]).orWhereRaw(
          'LOWER(TRIM(COALESCE(email, ""))) = ?',
          [email],
        );
      })
      .first();
    if (!row) {
      return { ok: false, error: 'Nenhum cliente encontrado com este e-mail.' };
    }
    return { ok: true, cliente: row };
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 11) {
    return { ok: false, error: 'Informe um CNPJ válido (14 dígitos) ou e-mail do cliente.' };
  }

  row = await db('clientes')
    .select(...CLIENTE_SELECT_FIELDS)
    .whereRaw(
      "REPLACE(REPLACE(REPLACE(COALESCE(documento, ''), '.', ''), '/', ''), '-', '') LIKE ?",
      [`%${digits}%`],
    )
    .first();

  if (!row) {
    return { ok: false, error: 'Nenhum cliente encontrado com este CNPJ.' };
  }

  return { ok: true, cliente: row };
}

async function matchLicitacoesParaCliente(db, cliente, licitacoes, opts) {
  const maxPorCliente = opts.maxPorCliente;
  const filtrarUf = opts.filtrarUf;
  const ignorarDedup = !!opts.ignorarDedup;

  const { segmentKey, keywords } = keywordsForCliente(cliente);
  if (!keywords.length) {
    return {
      ok: false,
      error: 'Cliente sem segmento configurado (ramo_atividade vazio ou sem palavras-chave).',
      segmentKey,
      keywords,
      matches: [],
    };
  }

  const jaEnviados = ignorarDedup ? new Set() : await loadEnviadosSet(db, cliente.id);
  const matches = [];

  for (const lic of licitacoes) {
    if (jaEnviados.has(Number(lic.id))) continue;
    if (!matchLicitacao(lic, keywords, cliente, { filtrarUf })) continue;
    matches.push(lic);
    if (matches.length >= maxPorCliente) break;
  }

  return { ok: true, segmentKey, keywords, matches };
}

async function loadLicitacoesRecentes(db, horasJanela) {
  const hasTable = await db.schema.hasTable('licitacoes');
  if (!hasTable) return [];

  const horas = Math.max(1, Math.min(Number(horasJanela) || 24, 168));
  return db('licitacoes')
    .select(
      'id',
      'numero_processo',
      'numero_controle_pncp',
      'objeto',
      'objeto_resumido',
      'nome_orgao',
      'uf',
      'modalidade',
      'esfera',
      'valor_estimado',
      'data_publicacao',
      'data_abertura',
      'data_encerramento',
      'link_edital',
      'link_portal',
      'created_at',
    )
    .whereRaw(
      `COALESCE(data_publicacao, created_at) >= DATE_SUB(NOW(), INTERVAL ${horas} HOUR)`,
    )
    .orderByRaw('COALESCE(data_publicacao, created_at) DESC')
    .limit(500);
}

async function loadEnviadosSet(db, clienteId) {
  const rows = await db('licitacoes_email_envios').where('cliente_id', clienteId).select('licitacao_id');
  return new Set(rows.map((r) => Number(r.licitacao_id)));
}

async function registrarEnvios(db, clienteId, licitacaoIds, processoExecId) {
  if (!licitacaoIds.length) return;
  const payload = licitacaoIds.map((licitacaoId) => ({
    cliente_id: clienteId,
    licitacao_id: licitacaoId,
    processo_exec_id: processoExecId || null,
    enviado_em: db.fn.now(),
  }));
  for (const row of payload) {
    try {
      await db('licitacoes_email_envios').insert(row);
    } catch (e) {
      if (!String(e.message || e).includes('Duplicate')) throw e;
    }
  }
}

async function runBoletimLicitacoes(options = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const log = typeof options.log === 'function' ? options.log : (msg) => console.log(`${LOG_PREFIX} ${msg}`);
  const horasJanela = Number(process.env.LICITACOES_BOLETIM_HORAS_JANELA || options.horasJanela || 24);
  const maxPorCliente = Number(process.env.LICITACOES_BOLETIM_MAX_POR_CLIENTE || options.maxPorCliente || 10);
  const filtrarUf = (process.env.LICITACOES_BOLETIM_FILTRAR_UF || 'false').toLowerCase() === 'true';
  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';
  const processoExecId = options.processoExecId || null;
  const dryRun = !!options.dryRun;

  await ensureEnviosTable(db);

  const clientes = await loadClientesElegiveis(db);
  const licitacoes = await loadLicitacoesRecentes(db, horasJanela);

  log(`Clientes elegíveis (manutenção ativa ou trial ${diasTrialBoletim()}d): ${clientes.length} · Licitações na janela (${horasJanela}h): ${licitacoes.length}`);

  if (!licitacoes.length) {
    return {
      ok: true,
      message: `Nenhuma licitação nova na janela de ${horasJanela}h.`,
      clientesElegiveis: clientes.length,
      licitacoesAnalisadas: 0,
      clientesComMatch: 0,
      emailsEnviados: 0,
      emailsErro: 0,
      emailsIgnorados: clientes.length,
      envios: [],
    };
  }

  const envios = [];
  let emailsEnviados = 0;
  let emailsErro = 0;
  let emailsIgnorados = 0;
  let clientesComMatch = 0;
  let totalLicitacoesEnviadas = 0;

  for (const cliente of clientes) {
    const email = resolveEmail(cliente);
    if (!email) {
      emailsIgnorados += 1;
      continue;
    }

    const { segmentKey, keywords } = keywordsForCliente(cliente);
    if (!keywords.length) {
      emailsIgnorados += 1;
      envios.push({
        clienteId: cliente.id,
        clienteNome: cliente.nome_fantasia || cliente.razao_social,
        email,
        segmento: segmentKey,
        licitacoesEnviadas: 0,
        status: 'ignorado',
        motivo: 'Segmento sem palavras-chave configuradas',
        itens: [],
      });
      continue;
    }

    const jaEnviados = await loadEnviadosSet(db, cliente.id);
    const matches = [];

    for (const lic of licitacoes) {
      if (jaEnviados.has(Number(lic.id))) continue;
      if (!matchLicitacao(lic, keywords, cliente, { filtrarUf })) continue;
      matches.push(lic);
      if (matches.length >= maxPorCliente) break;
    }

    if (!matches.length) {
      emailsIgnorados += 1;
      envios.push({
        clienteId: cliente.id,
        clienteNome: cliente.nome_fantasia || cliente.razao_social,
        email,
        segmento: segmentKey,
        licitacoesEnviadas: 0,
        status: 'sem_match',
        motivo: 'Nenhuma licitação compatível na janela',
        itens: [],
      });
      continue;
    }

    clientesComMatch += 1;
    const assunto = `CADBRASIL · ${matches.length} licitação(ões) para ${cliente.nome_fantasia || cliente.razao_social || 'sua empresa'}`;
    const html = buildEmailHtml({ cliente, segmento: segmentKey, itens: matches, portalBase });
    const text = matches
      .map(
        (lic, i) =>
          `${i + 1}. ${lic.objeto_resumido || lic.objeto || 'Licitação'} — ${lic.nome_orgao || ''} (${lic.uf || ''})`,
      )
      .join('\n');

    if (dryRun) {
      envios.push({
        clienteId: cliente.id,
        clienteNome: cliente.nome_fantasia || cliente.razao_social,
        email,
        segmento: segmentKey,
        licitacoesEnviadas: matches.length,
        status: 'simulado',
        itens: matches.map((l) => ({
          id: l.id,
          objeto: l.objeto_resumido || l.objeto,
          uf: l.uf,
          modalidade: l.modalidade,
          valor: l.valor_estimado,
        })),
      });
      totalLicitacoesEnviadas += matches.length;
      continue;
    }

    const sendResult = await emailService.send({
      to: email,
      subject: assunto,
      html,
      text: `Olá ${resolveNome(cliente)},\n\nLicitações compatíveis com seu segmento (${segmentKey}):\n\n${text}\n\nPortal: ${portalBase}/licitacoes`,
    });

    if (sendResult.ok) {
      emailsEnviados += 1;
      totalLicitacoesEnviadas += matches.length;
      await registrarEnvios(
        db,
        cliente.id,
        matches.map((m) => Number(m.id)),
        processoExecId,
      );
      envios.push({
        clienteId: cliente.id,
        clienteNome: cliente.nome_fantasia || cliente.razao_social,
        email,
        segmento: segmentKey,
        licitacoesEnviadas: matches.length,
        status: 'enviado',
        itens: matches.map((l) => ({
          id: l.id,
          objeto: l.objeto_resumido || l.objeto,
          uf: l.uf,
          modalidade: l.modalidade,
          valor: l.valor_estimado,
        })),
      });
      log(`E-mail enviado → ${email} (${matches.length} licitações)`);
    } else {
      emailsErro += 1;
      envios.push({
        clienteId: cliente.id,
        clienteNome: cliente.nome_fantasia || cliente.razao_social,
        email,
        segmento: segmentKey,
        licitacoesEnviadas: 0,
        status: 'erro',
        erro: sendResult.error || 'Falha ao enviar e-mail',
        itens: matches.map((l) => ({
          id: l.id,
          objeto: l.objeto_resumido || l.objeto,
          uf: l.uf,
        })),
      });
      log(`Erro ao enviar → ${email}: ${sendResult.error}`);
    }
  }

  const message = [
    `${emailsEnviados} e-mail(s) enviado(s)`,
    `${clientesComMatch} cliente(s) com match`,
    `${totalLicitacoesEnviadas} licitação(ões) no total`,
    emailsErro ? `${emailsErro} erro(s)` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    ok: true,
    message,
    clientesElegiveis: clientes.length,
    licitacoesAnalisadas: licitacoes.length,
    clientesComMatch,
    emailsEnviados,
    emailsErro,
    emailsIgnorados,
    licitacoesEnviadas: totalLicitacoesEnviadas,
    horasJanela,
    envios,
  };
}

async function runBoletimLicitacoesTeste(options = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const identificador = options.identificador;
  const simular = options.simular !== false;
  const horasJanela = Number(process.env.LICITACOES_BOLETIM_HORAS_JANELA || options.horasJanela || 24);
  const maxPorCliente = Number(process.env.LICITACOES_BOLETIM_MAX_POR_CLIENTE || options.maxPorCliente || 10);
  const filtrarUf = (process.env.LICITACOES_BOLETIM_FILTRAR_UF || 'false').toLowerCase() === 'true';
  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';

  await ensureEnviosTable(db);

  const found = await findClienteByIdentificador(db, identificador);
  if (!found.ok) return found;

  const cliente = found.cliente;
  const elegibilidade = await resolveElegibilidadeBoletim(db, cliente);
  if (!elegibilidade.elegivel) {
    return {
      ok: false,
      error: elegibilidade.error,
      cliente: {
        id: cliente.id,
        nome: cliente.nome_fantasia || cliente.razao_social,
        documento: cliente.documento,
        email: resolveEmail(cliente) || undefined,
      },
      elegibilidade: {
        motivo: elegibilidade.motivo,
        diasTrial: elegibilidade.diasTrial,
      },
    };
  }

  const elegibilidadeInfo = {
    motivo: elegibilidade.motivo,
    diasTrialRestantes: elegibilidade.diasTrialRestantes ?? null,
  };

  const email = resolveEmail(cliente);
  if (!email) {
    return {
      ok: false,
      error: 'Cliente encontrado, mas não possui e-mail cadastrado (responsavel_email ou email).',
      cliente: {
        id: cliente.id,
        nome: cliente.nome_fantasia || cliente.razao_social,
        documento: cliente.documento,
      },
    };
  }

  if (!String(cliente.ramo_atividade || '').trim()) {
    return {
      ok: false,
      error: 'Cliente sem ramo_atividade (segmento). Cadastre o segmento antes de testar.',
      cliente: {
        id: cliente.id,
        nome: cliente.nome_fantasia || cliente.razao_social,
        documento: cliente.documento,
        email,
      },
    };
  }

  const licitacoes = await loadLicitacoesRecentes(db, horasJanela);
  const matchResult = await matchLicitacoesParaCliente(db, cliente, licitacoes, {
    maxPorCliente,
    filtrarUf,
    ignorarDedup: true,
  });

  if (!matchResult.ok) {
    return {
      ok: false,
      error: matchResult.error,
      cliente: {
        id: cliente.id,
        nome: cliente.nome_fantasia || cliente.razao_social,
        documento: cliente.documento,
        email,
        ramoAtividade: cliente.ramo_atividade,
        segmento: matchResult.segmentKey,
      },
      licitacoesAnalisadas: licitacoes.length,
      keywords: matchResult.keywords || [],
    };
  }

  const { segmentKey, keywords, matches } = matchResult;
  const assunto = `CADBRASIL · ${matches.length} licitação(ões) para ${cliente.nome_fantasia || cliente.razao_social || 'sua empresa'}`;
  const previewHtml = buildEmailHtml({ cliente, segmento: segmentKey, itens: matches, portalBase });

  const clienteInfo = {
    id: cliente.id,
    nome: cliente.nome_fantasia || cliente.razao_social,
    documento: cliente.documento,
    email,
    ramoAtividade: cliente.ramo_atividade,
    segmento: segmentKey,
    estado: cliente.estado,
  };

  const itens = matches.map((l) => ({
    id: l.id,
    objeto: l.objeto_resumido || l.objeto,
    uf: l.uf,
    modalidade: l.modalidade,
    valor: l.valor_estimado,
    orgao: l.nome_orgao,
  }));

  if (!matches.length) {
    return {
      ok: true,
      simulado: true,
      message: `Nenhuma licitação compatível na janela de ${horasJanela}h para o segmento "${segmentKey}".`,
      assunto,
      previewHtml,
      cliente: clienteInfo,
      keywords,
      licitacoesAnalisadas: licitacoes.length,
      licitacoesEnviadas: 0,
      itens,
      enviado: false,
      elegibilidade: elegibilidadeInfo,
    };
  }

  if (simular) {
    return {
      ok: true,
      simulado: true,
      message: `Prévia gerada: ${matches.length} licitação(ões) para ${clienteInfo.nome}. Nenhum e-mail foi enviado.`,
      assunto,
      previewHtml,
      cliente: clienteInfo,
      keywords,
      licitacoesAnalisadas: licitacoes.length,
      licitacoesEnviadas: matches.length,
      itens,
      enviado: false,
      elegibilidade: elegibilidadeInfo,
    };
  }

  const text = matches
    .map(
      (lic, i) =>
        `${i + 1}. ${lic.objeto_resumido || lic.objeto || 'Licitação'} — ${lic.nome_orgao || ''} (${lic.uf || ''})`,
    )
    .join('\n');

  const sendResult = await emailService.send({
    to: email,
    subject: assunto,
    html: previewHtml,
    text: `Olá ${resolveNome(cliente)},\n\nLicitações compatíveis (${segmentKey}):\n\n${text}\n\nPortal: ${portalBase}/licitacoes`,
  });

  if (!sendResult.ok) {
    return {
      ok: false,
      error: sendResult.error || 'Falha ao enviar e-mail de teste.',
      assunto,
      previewHtml,
      cliente: clienteInfo,
      keywords,
      licitacoesAnalisadas: licitacoes.length,
      itens,
    };
  }

  return {
    ok: true,
    simulado: false,
    message: `E-mail de teste enviado para ${email} com ${matches.length} licitação(ões).`,
    assunto,
    previewHtml,
    cliente: clienteInfo,
    keywords,
    licitacoesAnalisadas: licitacoes.length,
    licitacoesEnviadas: matches.length,
    itens,
    enviado: true,
    messageId: sendResult.messageId,
    elegibilidade: elegibilidadeInfo,
  };
}

module.exports = {
  runBoletimLicitacoes,
  runBoletimLicitacoesTeste,
  keywordsForCliente,
  matchLicitacao,
  SEGMENT_KEYWORDS,
};
