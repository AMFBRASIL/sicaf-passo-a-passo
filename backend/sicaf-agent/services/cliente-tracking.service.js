/**
 * Tracking de origem / Google Ads por cliente (tracking_sessoes).
 */
const { getDb } = require('../database/connection');

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDateBr(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch (_) {
    return String(value);
  }
}

function fixMojibake(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  if (/Ã|Â|Ê|Ô|Õ|Ç/.test(s)) {
    try {
      return Buffer.from(s, 'latin1').toString('utf8').trim();
    } catch (_) {
      return s;
    }
  }
  return s;
}

function isGoogleAdsSession(row) {
  const gclid = String(row.gclid || '').trim();
  const source = String(row.utm_source || '').toLowerCase();
  return (
    !!gclid ||
    source === 'google' ||
    source === 'googleads' ||
    !!String(row.gad_campaignid || '').trim() ||
    !!String(row.gad_source || '').trim()
  );
}

function canalLabel(row) {
  if (isGoogleAdsSession(row)) return 'Google Ads';
  const source = fixMojibake(row.utm_source);
  if (source) return source;
  const ref = String(row.referrer || '').trim();
  if (ref) {
    try {
      return new URL(ref).hostname.replace(/^www\./, '');
    } catch (_) {
      return ref.slice(0, 80);
    }
  }
  return 'Direto / desconhecido';
}

function mapSessao(row) {
  const converted = row.converted === 1 || row.converted === true;
  return {
    id: row.id,
    sessionId: row.session_id,
    primeiraVisita: formatDateBr(row.first_visit_at || row.created_at),
    ultimaAtividade: formatDateBr(row.last_activity_at || row.updated_at),
    criadoEm: formatDateBr(row.created_at),
    utmSource: fixMojibake(row.utm_source) || null,
    utmMedium: fixMojibake(row.utm_medium) || null,
    utmCampaign: fixMojibake(row.utm_campaign) || null,
    utmTerm: fixMojibake(row.utm_term) || null,
    utmContent: fixMojibake(row.utm_content) || null,
    gclid: row.gclid || null,
    gbraid: row.gbraid || null,
    wbraid: row.wbraid || null,
    gadSource: row.gad_source || null,
    gadCampaignId: row.gad_campaignid || null,
    fbclid: row.fbclid || null,
    msclkid: row.msclkid || null,
    landingPage: row.landing_page || null,
    referrer: row.referrer || null,
    exitPage: row.exit_page || null,
    deviceType: row.device_type || null,
    browser: row.browser || null,
    os: row.os || null,
    geoCountry: row.geo_country || null,
    geoState: row.geo_state || null,
    geoCity: row.geo_city || null,
    ipAddress: row.ip_address || null,
    pagesViewed: toNumber(row.pages_viewed),
    sessionDuration: toNumber(row.session_duration),
    bounce: row.bounce === 1 || row.bounce === true,
    scrollDepthMax: toNumber(row.scroll_depth_max),
    converted,
    conversionType: row.conversion_type || null,
    conversionValue: row.conversion_value != null ? toNumber(row.conversion_value) : null,
    conversionAt: formatDateBr(row.conversion_at),
    funnelStep: row.funnel_step || null,
    canal: canalLabel(row),
    googleAds: isGoogleAdsSession(row),
  };
}

function buildResumo(sessoes) {
  if (!sessoes.length) return null;

  const cronologico = [...sessoes].sort(
    (a, b) =>
      new Date(a.first_visit_at || a.created_at).getTime() -
      new Date(b.first_visit_at || b.created_at).getTime(),
  );
  const primeira = cronologico[0];
  const ultima = [...sessoes].sort(
    (a, b) =>
      new Date(b.last_activity_at || b.updated_at || b.created_at).getTime() -
      new Date(a.last_activity_at || a.updated_at || a.created_at).getTime(),
  )[0];

  const convertida = sessoes.find((s) => s.converted === 1 || s.converted === true) || null;
  const googleAds = sessoes.filter(isGoogleAdsSession);
  const comPalavra = sessoes.find((s) => String(s.utm_term || '').trim());

  const palavraOrigem = fixMojibake(
    (convertida && convertida.utm_term) ||
      (comPalavra && comPalavra.utm_term) ||
      (primeira && primeira.utm_term) ||
      '',
  );

  return {
    totalSessoes: sessoes.length,
    primeiraVisita: formatDateBr(primeira?.first_visit_at || primeira?.created_at),
    ultimaVisita: formatDateBr(ultima?.last_activity_at || ultima?.updated_at || ultima?.created_at),
    canalPrincipal: canalLabel(primeira),
    origem: fixMojibake(primeira?.utm_source) || canalLabel(primeira),
    midia: fixMojibake(primeira?.utm_medium) || null,
    campanha: fixMojibake(primeira?.utm_campaign) || null,
    palavraChave: palavraOrigem || null,
    palavraConvertida: convertida ? fixMojibake(convertida.utm_term) || palavraOrigem || null : null,
    gclid: (convertida && convertida.gclid) || primeira?.gclid || googleAds[0]?.gclid || null,
    googleAds: googleAds.length > 0,
    sessoesGoogleAds: googleAds.length,
    convertido: !!convertida,
    tipoConversao: convertida?.conversion_type || null,
    valorConversao: convertida?.conversion_value != null ? toNumber(convertida.conversion_value) : null,
    conversaoEm: formatDateBr(convertida?.conversion_at),
    landingPage: primeira?.landing_page || null,
    referrer: primeira?.referrer || null,
  };
}

async function getClienteTracking(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes')
    .where('id', clienteId)
    .select('id', 'usuario_id', 'razao_social', 'created_at')
    .first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const hasTracking = await db.schema.hasTable('tracking_sessoes');
  if (!hasTracking) {
    return {
      ok: true,
      resumo: null,
      sessoes: [],
      message: 'Tabela de tracking não disponível neste ambiente.',
    };
  }

  const rows = await db('tracking_sessoes as ts')
    .where(function assignClienteOuUsuario() {
      this.where('ts.cliente_id', clienteId);
      if (cliente.usuario_id) {
        this.orWhere('ts.usuario_id', cliente.usuario_id);
      }
    })
    .select(
      'ts.id',
      'ts.session_id',
      'ts.cliente_id',
      'ts.usuario_id',
      'ts.utm_source',
      'ts.utm_medium',
      'ts.utm_campaign',
      'ts.utm_term',
      'ts.utm_content',
      'ts.gclid',
      'ts.gbraid',
      'ts.wbraid',
      'ts.gad_source',
      'ts.gad_campaignid',
      'ts.fbclid',
      'ts.msclkid',
      'ts.landing_page',
      'ts.referrer',
      'ts.exit_page',
      'ts.device_type',
      'ts.browser',
      'ts.os',
      'ts.geo_country',
      'ts.geo_state',
      'ts.geo_city',
      'ts.ip_address',
      'ts.pages_viewed',
      'ts.session_duration',
      'ts.bounce',
      'ts.scroll_depth_max',
      'ts.converted',
      'ts.conversion_type',
      'ts.conversion_value',
      'ts.conversion_at',
      'ts.funnel_step',
      'ts.first_visit_at',
      'ts.last_activity_at',
      'ts.created_at',
      'ts.updated_at',
    )
    .orderBy('ts.created_at', 'desc')
    .limit(100);

  const resumo = buildResumo(rows);

  return {
    ok: true,
    cliente: {
      id: cliente.id,
      razaoSocial: cliente.razao_social || null,
      cadastroEm: formatDateBr(cliente.created_at),
    },
    resumo,
    sessoes: rows.map(mapSessao),
  };
}

module.exports = {
  getClienteTracking,
};
