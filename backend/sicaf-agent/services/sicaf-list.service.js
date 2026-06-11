/**
 * Listagem de empresas SICAF do usuário logado (portado do launcher legado).
 */
const { getDb } = require('../database/connection');
const { calcDaysRemaining, resolveSicafDisplayStatus } = require('../utils/sicaf-status');

async function listSicaf(search = '', usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let tipoUsuario = null;
    try {
      const u = await db('usuarios').where('id', usuarioId).select('tipo_usuario').first();
      tipoUsuario = u?.tipo_usuario || null;
    } catch (_) {
      // Coluna pode não existir ainda em ambientes pré-migration.
    }

    let query = db('clientes as c')
      .leftJoin('sicaf_cadastros as s', 'c.id', 's.cliente_id')
      .select(
        'c.id as cliente_id',
        'c.razao_social',
        'c.nome_fantasia',
        'c.tipo_documento',
        'c.documento',
        'c.email',
        'c.telefone',
        'c.cidade',
        'c.estado',
        'c.endereco',
        'c.status as cliente_status',
        's.id as sicaf_id',
        's.status as sicaf_status',
        's.completude',
        's.data_validade',
        's.data_ultima_atualizacao',
        's.dias_validade',
        's.credenciamento_anual',
        's.manutencao_ativa',
        's.observacoes as sicaf_obs',
      )
      .orderBy('c.created_at', 'desc');

    if (tipoUsuario === 'colaborador') {
      query = query.whereIn(
        'c.id',
        db('usuario_clientes').where('usuario_id', usuarioId).select('cliente_id'),
      );
    } else {
      query = query.where('c.usuario_id', usuarioId);
    }

    if (search && search.trim()) {
      const term = search.trim();
      const digitsOnly = term.replace(/\D/g, '');
      const isDoc = digitsOnly.length >= 3 && /^[\d.\/-\s]+$/.test(term);

      if (isDoc) {
        query = query.where(function () {
          this.where('c.documento', 'like', `%${term}%`)
            .orWhere('c.documento', 'like', `%${digitsOnly}%`)
            .orWhereRaw("REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '/', ''), '-', '') LIKE ?", [
              `%${digitsOnly}%`,
            ]);
        });
      } else {
        query = query.where(function () {
          this.where('c.razao_social', 'like', `%${term}%`).orWhere('c.nome_fantasia', 'like', `%${term}%`);
        });
      }
    }

    const rows = await query;
    const clienteIds = rows.map((r) => Number(r.cliente_id)).filter((id) => id > 0);

    let financialMap = {};
    if (clienteIds.length > 0) {
      try {
        const taxaRows = await db('taxas_sicaf')
          .whereIn('cliente_id', clienteIds)
          .select('cliente_id', 'status', 'data_pagamento', 'created_at')
          .orderBy('created_at', 'desc');
        for (const t of taxaRows) {
          const cid = Number(t.cliente_id || 0);
          if (!cid || financialMap[cid]) continue;
          const statusRaw = String(t.status || '').trim();
          const s = statusRaw.toLowerCase();
          const released = ['pago', 'paga', 'aprovado', 'aprovada', 'liberado', 'liberada'].includes(s);
          financialMap[cid] = {
            status: statusRaw || 'Não informado',
            released,
            paidAt: t.data_pagamento || null,
          };
        }
      } catch (_) {
        financialMap = {};
      }
    }

    const sicafIds = rows.filter((r) => r.sicaf_id).map((r) => r.sicaf_id);
    let niveisMap = {};
    let niveisDetailMap = {};
    const enabledSicafLevels = ['I', 'II', 'V', 'VI'];
    if (sicafIds.length > 0) {
      const niveis = await db('sicaf_niveis')
        .whereIn('sicaf_id', sicafIds)
        .select('sicaf_id', 'nivel', 'habilitado', 'status', 'observacao');
      for (const n of niveis) {
        if (n.habilitado) {
          if (!niveisMap[n.sicaf_id]) niveisMap[n.sicaf_id] = [];
          niveisMap[n.sicaf_id].push(n.nivel);
        }
        if (!niveisDetailMap[n.sicaf_id]) niveisDetailMap[n.sicaf_id] = {};
        const status = n.status || (n.habilitado ? 'Válido' : 'Não informado');
        niveisDetailMap[n.sicaf_id][n.nivel] = {
          status:
            n.habilitado && enabledSicafLevels.includes(n.nivel) && status === 'Pendente'
              ? 'Habilitado'
              : status,
          observacao: n.observacao || null,
        };
      }
    }

    let renewalMap = {};
    if (sicafIds.length > 0) {
      try {
        const renewals = await db('sicaf_renovacoes')
          .whereIn('sicaf_id', sicafIds)
          .groupBy('sicaf_id')
          .select('sicaf_id', db.raw('COUNT(*) as total'));
        for (const r of renewals) {
          renewalMap[r.sicaf_id] = r.total;
        }
      } catch (_) {
        // tabela pode não existir
      }
    }

    function fmtDate(d) {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = dt.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    const items = rows.map((r) => {
      const hasSicaf = !!r.sicaf_id;
      const daysRaw = r.data_validade ? calcDaysRemaining(r.data_validade) : null;
      const daysValid = daysRaw !== null ? Math.max(0, daysRaw) : null;
      const realStatus = resolveSicafDisplayStatus(r.sicaf_status, r.data_validade, hasSicaf);

      return {
        id: r.sicaf_id || 0,
        clienteId: r.cliente_id,
        client: r.razao_social || r.nome_fantasia || '',
        clientStatus: r.cliente_status || 'Não informado',
        fantasyName: r.nome_fantasia || '',
        tipoDocumento: r.tipo_documento || 'CNPJ',
        documento: r.documento || '',
        email: r.email || '',
        telefone: r.telefone || '',
        cidade: r.cidade || '',
        estado: r.estado || '',
        endereco: r.endereco || '',
        status: realStatus,
        lastUpdate: fmtDate(r.data_ultima_atualizacao),
        expiryDate: fmtDate(r.data_validade),
        completeness: r.completude ? parseFloat(r.completude) : 0,
        levels: hasSicaf ? niveisMap[r.sicaf_id] || [] : [],
        levelsDetail: hasSicaf ? niveisDetailMap[r.sicaf_id] || {} : {},
        renewalCount: hasSicaf ? renewalMap[r.sicaf_id] || 0 : 0,
        maintenanceActive: r.manutencao_ativa === 1,
        daysValid,
        annualCredential: r.credenciamento_anual === 1,
        financialStatus: financialMap[r.cliente_id]?.status || 'Não informado',
        financialReleased: !!financialMap[r.cliente_id]?.released,
        hasSicaf,
      };
    });

    let valorTaxa = 985.0;
    try {
      const cfgTaxa = await db('configuracoes_sistema').where('chave', 'valor_cadastro_sicaf').first();
      if (cfgTaxa) valorTaxa = parseFloat(cfgTaxa.valor);
    } catch (_) {}

    return { ok: true, items, total: items.length, valorTaxa };
  } catch (e) {
    console.error('[SICAF List] Erro:', e.message);
    return { ok: false, error: 'Erro interno: ' + e.message };
  }
}

module.exports = { listSicaf };
