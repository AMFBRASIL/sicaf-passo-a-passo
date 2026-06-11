/**
 * Central de Alertas Admin — alertas computados do banco + estado tratado/ignorado.
 */
const { getDb } = require('../database/connection');
const { fixMojibake } = require('../utils/text-encoding');
const { calcDaysRemaining } = require('../utils/sicaf-status');

const TOM_ORDER = { rose: 0, amber: 1, violet: 2 };

function clienteNome(row) {
  return fixMojibake(row.razao_social || row.nome_fantasia || 'Cliente');
}

function formatEmDias(dias) {
  if (dias === null || dias === undefined) return '—';
  if (dias === 0) return 'Hoje';
  if (dias < 0) return `${Math.abs(dias)}d`;
  return `${dias}d`;
}

function mapTomToDb(tom) {
  if (tom === 'rose') return 'urgent';
  if (tom === 'violet') return 'info';
  return 'warning';
}

function mapDbTom(tipo) {
  if (tipo === 'urgent') return 'rose';
  if (tipo === 'info') return 'violet';
  return 'amber';
}

function buildAlerta({
  id,
  categoria,
  referenciaId,
  clienteId,
  tipo,
  cli,
  det,
  em,
  tom,
  acaoUrl,
}) {
  return {
    id,
    categoria,
    referenciaId,
    clienteId: clienteId || null,
    tipo,
    cli,
    det,
    em,
    tom,
    acaoUrl: acaoUrl || null,
    estado: 'ativo',
  };
}

async function safeQuery(fallback, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[AdminAlertas] Consulta ignorada:', e.message);
    return fallback;
  }
}

async function hasTable(db, name) {
  return safeQuery(false, () => db.schema.hasTable(name));
}

async function loadResolucoesMap(db) {
  const hasAlertas = await hasTable(db, 'alertas');
  if (!hasAlertas) return { ativos: new Set(), historico: [] };

  const rows = await safeQuery([], () =>
    db('alertas as a')
      .leftJoin('clientes as c', 'c.id', 'a.cliente_id')
      .where(function () {
        this.where('a.lido', 1).orWhere('a.ignorado', 1);
      })
      .orderBy('a.lido_em', 'desc')
      .orderBy('a.created_at', 'desc')
      .limit(200)
      .select(
        'a.id',
        'a.titulo',
        'a.descricao',
        'a.categoria',
        'a.referencia_tipo',
        'a.referencia_id',
        'a.cliente_id',
        'a.lido',
        'a.ignorado',
        'a.lido_em',
        'a.created_at',
        'a.tipo',
        'a.acao_url',
        'c.razao_social',
        'c.nome_fantasia',
      ),
  );

  const ativos = new Set();
  const historico = [];

  for (const row of rows) {
    const cat = row.categoria || row.referencia_tipo;
    const refId = row.referencia_id;
    if (cat && refId) {
      ativos.add(`${cat}:${refId}`);
    }
    historico.push({
      id: cat && refId ? `${cat}:${refId}` : `registro:${row.id}`,
      dbId: row.id,
      tipo: row.titulo || 'Alerta',
      cli: clienteNome(row),
      det: row.descricao || '',
      em: row.lido_em ? new Date(row.lido_em).toLocaleDateString('pt-BR') : '—',
      tom: mapDbTom(row.tipo),
      categoria: cat || 'outro',
      referenciaId: refId || null,
      clienteId: row.cliente_id || null,
      estado: row.ignorado ? 'ignorado' : 'tratado',
      acaoUrl: row.acao_url || null,
    });
  }

  return { ativos, historico };
}

async function computeAlertas(db) {
  const [
    hasClientes,
    hasCertidoes,
    hasManutBoletos,
    hasTickets,
    hasSicaf,
    hasDocumentos,
    hasPagamentosGn,
    hasTaxas,
  ] = await Promise.all([
    hasTable(db, 'clientes'),
    hasTable(db, 'certidoes'),
    hasTable(db, 'manutencao_boletos'),
    hasTable(db, 'tickets'),
    hasTable(db, 'sicaf_cadastros'),
    hasTable(db, 'documentos'),
    hasTable(db, 'pagamentos_gerencianet'),
    hasTable(db, 'taxas_sicaf'),
  ]);

  const alertas = [];

  if (hasCertidoes && hasClientes) {
    const certVencidas = await safeQuery([], () =>
      db('certidoes as ce')
        .leftJoin('clientes as c', 'c.id', 'ce.cliente_id')
        .leftJoin('tipo_certidoes as tc', 'tc.id', 'ce.tipo_certidao_id')
        .where('ce.status', 'Vencida')
        .whereNull('ce.deleted_at')
        .select('ce.id', 'ce.cliente_id', 'c.razao_social', 'c.nome_fantasia', 'c.documento', 'tc.nome as tipo_nome', 'ce.data_validade')
        .orderBy('ce.data_validade', 'asc')
        .limit(40),
    );
    for (const row of certVencidas) {
      const dias = calcDaysRemaining(row.data_validade);
      alertas.push(
        buildAlerta({
          id: `certidao:${row.id}`,
          categoria: 'certidao',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: `${row.tipo_nome || 'Certidão'} vencida`,
          cli: clienteNome(row),
          det: dias !== null ? `Vencida há ${Math.abs(dias)} dias` : 'Certidão irregular',
          em: formatEmDias(dias),
          tom: 'rose',
          acaoUrl: row.documento ? `/sicaf?cnpj=${encodeURIComponent(row.documento)}` : '/admin/clientes',
        }),
      );
    }

    const certVencendo = await safeQuery([], () =>
      db('certidoes as ce')
        .leftJoin('clientes as c', 'c.id', 'ce.cliente_id')
        .leftJoin('tipo_certidoes as tc', 'tc.id', 'ce.tipo_certidao_id')
        .where(function () {
          this.where('ce.status', 'Vencendo').orWhereRaw(
            'ce.data_validade IS NOT NULL AND DATEDIFF(ce.data_validade, CURDATE()) BETWEEN 0 AND 30',
          );
        })
        .whereNot('ce.status', 'Vencida')
        .whereNull('ce.deleted_at')
        .select('ce.id', 'ce.cliente_id', 'c.razao_social', 'c.nome_fantasia', 'c.documento', 'tc.nome as tipo_nome', 'ce.data_validade')
        .orderBy('ce.data_validade', 'asc')
        .limit(40),
    );
    for (const row of certVencendo) {
      const dias = calcDaysRemaining(row.data_validade);
      alertas.push(
        buildAlerta({
          id: `certidao:${row.id}`,
          categoria: 'certidao',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: `${row.tipo_nome || 'Certidão'} vencendo`,
          cli: clienteNome(row),
          det: dias !== null ? `Vence em ${dias} dias` : 'Renovação necessária',
          em: formatEmDias(dias),
          tom: dias !== null && dias <= 3 ? 'rose' : 'amber',
          acaoUrl: row.documento ? `/sicaf?cnpj=${encodeURIComponent(row.documento)}` : '/admin/clientes',
        }),
      );
    }
  }

  if (hasManutBoletos && hasClientes) {
    const boletos = await safeQuery([], () =>
      db('manutencao_boletos as b')
        .leftJoin('clientes as c', 'c.id', 'b.cliente_id')
        .whereIn('b.status', ['Atrasado', 'Vencido', 'atrasado', 'vencido'])
        .select('b.id', 'b.cliente_id', 'b.valor', 'b.data_vencimento', 'c.razao_social', 'c.nome_fantasia', 'c.documento')
        .orderBy('b.data_vencimento', 'asc')
        .limit(30),
    );
    for (const row of boletos) {
      const dias = calcDaysRemaining(row.data_vencimento);
      const valor = Number(row.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      alertas.push(
        buildAlerta({
          id: `boleto:${row.id}`,
          categoria: 'boleto',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'Boleto vencido',
          cli: clienteNome(row),
          det: `${valor} — ${dias !== null && dias < 0 ? `vencido há ${Math.abs(dias)} dias` : 'em atraso'}`,
          em: formatEmDias(dias),
          tom: 'rose',
          acaoUrl: '/admin/financeiro',
        }),
      );
    }
  }

  if (hasPagamentosGn && hasClientes) {
    const pendentes = await safeQuery([], () =>
      db('pagamentos_gerencianet as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .whereIn('p.status', ['pendente', 'aguardando', 'aberto', 'Pendente', 'Aguardando'])
        .select('p.id', 'p.cliente_id', 'p.valor', 'p.data_vencimento', 'p.created_at', 'c.razao_social', 'c.nome_fantasia')
        .orderBy('p.data_vencimento', 'asc')
        .limit(25),
    );
    for (const row of pendentes) {
      const ref = row.data_vencimento || row.created_at;
      const dias = calcDaysRemaining(ref);
      alertas.push(
        buildAlerta({
          id: `pagamento:${row.id}`,
          categoria: 'pagamento',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'Cliente sem pagamento',
          cli: clienteNome(row),
          det: `Fatura em aberto${dias !== null && dias < 0 ? ` há ${Math.abs(dias)} dias` : ''}`,
          em: formatEmDias(dias),
          tom: dias !== null && dias < 0 ? 'rose' : 'amber',
          acaoUrl: '/admin/financeiro',
        }),
      );
    }
  }

  if (hasTaxas && hasClientes) {
    const taxasPend = await safeQuery([], () =>
      db('taxas_sicaf as t')
        .leftJoin('clientes as c', 'c.id', 't.cliente_id')
        .whereIn('t.status', ['Pendente', 'pendente'])
        .select('t.id', 't.cliente_id', 't.valor', 't.created_at', 'c.razao_social', 'c.nome_fantasia')
        .orderBy('t.created_at', 'asc')
        .limit(20),
    );
    for (const row of taxasPend) {
      const dias = calcDaysRemaining(row.created_at);
      alertas.push(
        buildAlerta({
          id: `taxa_sicaf:${row.id}`,
          categoria: 'taxa_sicaf',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'Taxa SICAF pendente',
          cli: clienteNome(row),
          det: 'Cadastro aguardando pagamento da taxa',
          em: formatEmDias(dias),
          tom: 'amber',
          acaoUrl: '/admin/financeiro',
        }),
      );
    }
  }

  if (hasTickets && hasClientes) {
    const tickets = await safeQuery([], () =>
      db('tickets as t')
        .leftJoin('clientes as c', 'c.id', 't.cliente_id')
        .whereIn('t.status', ['aberto', 'em_andamento'])
        .where(function () {
          this.where('t.sla_minutos_restantes', '<=', 0).orWhereRaw(
            't.sla_prazo IS NOT NULL AND t.sla_prazo < NOW()',
          );
        })
        .select('t.id', 't.codigo', 't.titulo', 't.cliente_id', 't.sla_minutos_restantes', 'c.razao_social', 'c.nome_fantasia')
        .orderBy('t.created_at', 'asc')
        .limit(25),
    );
    for (const row of tickets) {
      alertas.push(
        buildAlerta({
          id: `ticket:${row.id}`,
          categoria: 'ticket',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'Ticket sem resposta',
          cli: clienteNome(row) || row.titulo,
          det: row.titulo || 'SLA estourado',
          em: row.sla_minutos_restantes <= 0 ? 'SLA estourado' : 'SLA crítico',
          tom: 'rose',
          acaoUrl: '/admin/suporte',
        }),
      );
    }
  }

  if (hasSicaf && hasClientes) {
    const sicafVencidos = await safeQuery([], () =>
      db('sicaf_cadastros as s')
        .leftJoin('clientes as c', 'c.id', 's.cliente_id')
        .whereRaw('s.data_validade IS NOT NULL AND DATEDIFF(s.data_validade, CURDATE()) < 0')
        .select('s.id', 's.cliente_id', 's.data_validade', 'c.razao_social', 'c.nome_fantasia', 'c.documento')
        .orderBy('s.data_validade', 'asc')
        .limit(30),
    );
    for (const row of sicafVencidos) {
      const dias = calcDaysRemaining(row.data_validade);
      alertas.push(
        buildAlerta({
          id: `sicaf:${row.id}`,
          categoria: 'sicaf',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'SICAF vencido',
          cli: clienteNome(row),
          det: `Vencido há ${Math.abs(dias || 0)} dias — sem renovação`,
          em: formatEmDias(dias),
          tom: 'rose',
          acaoUrl: row.documento ? `/sicaf?cnpj=${encodeURIComponent(row.documento)}` : '/admin/sicaf',
        }),
      );
    }

    const sicafVencendo = await safeQuery([], () =>
      db('sicaf_cadastros as s')
        .leftJoin('clientes as c', 'c.id', 's.cliente_id')
        .whereRaw('s.data_validade IS NOT NULL AND DATEDIFF(s.data_validade, CURDATE()) BETWEEN 0 AND 30')
        .select('s.id', 's.cliente_id', 's.data_validade', 'c.razao_social', 'c.nome_fantasia', 'c.documento')
        .orderBy('s.data_validade', 'asc')
        .limit(25),
    );
    for (const row of sicafVencendo) {
      const dias = calcDaysRemaining(row.data_validade);
      alertas.push(
        buildAlerta({
          id: `sicaf:${row.id}`,
          categoria: 'sicaf',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'SICAF vencendo',
          cli: clienteNome(row),
          det: `Validade em ${dias} dias`,
          em: formatEmDias(dias),
          tom: 'amber',
          acaoUrl: row.documento ? `/sicaf?cnpj=${encodeURIComponent(row.documento)}` : '/admin/sicaf',
        }),
      );
    }

    const sicafPendente = await safeQuery([], () =>
      db('sicaf_cadastros as s')
        .leftJoin('clientes as c', 'c.id', 's.cliente_id')
        .where('s.status', 'Pendente')
        .whereRaw('(s.data_validade IS NULL OR DATEDIFF(s.data_validade, CURDATE()) >= 0)')
        .select('s.id', 's.cliente_id', 's.updated_at', 'c.razao_social', 'c.nome_fantasia', 'c.documento')
        .orderBy('s.updated_at', 'desc')
        .limit(20),
    );
    for (const row of sicafPendente) {
      alertas.push(
        buildAlerta({
          id: `sicaf_pendente:${row.id}`,
          categoria: 'sicaf_pendente',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: 'SICAF pendente',
          cli: clienteNome(row),
          det: 'Cadastro aguardando conclusão',
          em: 'Hoje',
          tom: 'amber',
          acaoUrl: row.documento ? `/sicaf?cnpj=${encodeURIComponent(row.documento)}` : '/admin/sicaf',
        }),
      );
    }
  }

  if (hasDocumentos && hasClientes) {
    const docs = await safeQuery([], () =>
      db('documentos as d')
        .leftJoin('clientes as c', 'c.id', 'd.cliente_id')
        .whereIn('d.status', ['expired', 'expiring'])
        .whereNull('d.deleted_at')
        .select('d.id', 'd.cliente_id', 'd.nome', 'd.status', 'd.data_validade', 'c.razao_social', 'c.nome_fantasia', 'c.documento')
        .orderBy('d.data_validade', 'asc')
        .limit(25),
    );
    for (const row of docs) {
      const dias = calcDaysRemaining(row.data_validade);
      const vencido = row.status === 'expired' || (dias !== null && dias < 0);
      alertas.push(
        buildAlerta({
          id: `documento:${row.id}`,
          categoria: 'documento',
          referenciaId: row.id,
          clienteId: row.cliente_id,
          tipo: vencido ? 'Documento vencido' : 'Documento pendente',
          cli: clienteNome(row),
          det: `${row.nome || 'Documento'}${vencido ? ' — irregular' : ' — vencendo'}`,
          em: formatEmDias(dias),
          tom: vencido ? 'rose' : 'amber',
          acaoUrl: row.documento ? `/sicaf?cnpj=${encodeURIComponent(row.documento)}` : '/admin/clientes',
        }),
      );
    }
  }

  const byId = new Map();
  for (const a of alertas) {
    if (!byId.has(a.id)) byId.set(a.id, a);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const ta = TOM_ORDER[a.tom] ?? 9;
    const tb = TOM_ORDER[b.tom] ?? 9;
    return ta - tb;
  });
}

async function persistirResolucao(db, usuarioId, alerta, { ignorado, observacao, acao }) {
  const hasAlertas = await hasTable(db, 'alertas');
  if (!hasAlertas) return { ok: true };

  const descricao = [alerta.cli, alerta.det, observacao || acao].filter(Boolean).join(' · ');
  const payload = {
    tipo: mapTomToDb(alerta.tom),
    titulo: alerta.tipo,
    descricao,
    categoria: alerta.categoria,
    referencia_tipo: alerta.categoria,
    referencia_id: alerta.referenciaId,
    cliente_id: alerta.clienteId || null,
    usuario_id: usuarioId || null,
    lido: ignorado ? 0 : 1,
    ignorado: ignorado ? 1 : 0,
    lido_em: db.fn.now(),
    acao_url: alerta.acaoUrl || null,
  };

  const existing = await db('alertas')
    .where({
      categoria: alerta.categoria,
      referencia_tipo: alerta.categoria,
      referencia_id: alerta.referenciaId,
    })
    .first();

  if (existing) {
    await db('alertas').where('id', existing.id).update(payload);
  } else {
    await db('alertas').insert(payload);
  }

  return { ok: true };
}

async function getAdminAlertas() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const [{ ativos: resolvidos, historico }, computados] = await Promise.all([
    loadResolucoesMap(db),
    computeAlertas(db),
  ]);

  const ativos = computados.filter((a) => !resolvidos.has(a.id));

  const counts = {
    ativos: ativos.length,
    tratados: historico.filter((h) => h.estado === 'tratado').length,
    ignorados: historico.filter((h) => h.estado === 'ignorado').length,
    rose: ativos.filter((a) => a.tom === 'rose').length,
    amber: ativos.filter((a) => a.tom === 'amber').length,
  };

  return {
    ok: true,
    ativos,
    historico: (historico || []).slice(0, 60),
    counts,
    totalComputados: computados.length,
  };
}

async function tratarAlerta(usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  if (!dados?.categoria || !dados?.referenciaId) {
    return { ok: false, error: 'Alerta inválido' };
  }
  await persistirResolucao(db, usuarioId, dados, {
    ignorado: false,
    observacao: dados.observacao,
    acao: dados.acao,
  });
  return { ok: true, message: 'Alerta tratado' };
}

async function ignorarAlerta(usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  if (!dados?.categoria || !dados?.referenciaId) {
    return { ok: false, error: 'Alerta inválido' };
  }
  if (!dados.motivo?.trim()) {
    return { ok: false, error: 'Informe o motivo para ignorar' };
  }
  await persistirResolucao(db, usuarioId, dados, {
    ignorado: true,
    observacao: dados.motivo.trim(),
    acao: null,
  });
  return { ok: true, message: 'Alerta ignorado' };
}

async function marcarTodosVistos(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const painel = await getAdminAlertas();
  if (!painel.ok) return painel;

  for (const alerta of painel.ativos || []) {
    await persistirResolucao(db, usuarioId, alerta, {
      ignorado: true,
      observacao: 'Marcado como visto em lote',
      acao: null,
    });
  }

  return { ok: true, message: `${painel.ativos?.length || 0} alertas marcados como vistos` };
}

module.exports = {
  getAdminAlertas,
  tratarAlerta,
  ignorarAlerta,
  marcarTodosVistos,
};
