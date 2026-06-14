/**
 * Painel Gerenciar empresa — dados reais para EmpresaDetalhesSheet (/empresas).
 */
const { getDb } = require('../database/connection');
const { assertClienteAcessivel } = require('./client-access.service');
const {
  resolveSicafDisplayStatus,
  calcDaysRemaining,
  needsSicafTaxaPayment,
  isSicafAcessoLiberado,
} = require('../utils/sicaf-status');
const { getCertidoesStatus } = require('./clients.service');
const { getChecklistDocumentosAdmin } = require('./certidoes.service');

const NIVEIS_SICAF_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function pushPendenciaUnica(pendencias, item) {
  if (!pendencias.some((p) => p.titulo === item.titulo)) {
    pendencias.push(item);
  }
}

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function certStatusToUi(status, diasRestantes) {
  const s = String(status || '').toLowerCase();
  if (s.includes('vencid') || (diasRestantes != null && diasRestantes < 0)) return 'danger';
  if (s.includes('vencendo') || (diasRestantes != null && diasRestantes <= 30)) return 'warn';
  if (s.includes('válid') || s.includes('valid') || s.includes('habilit')) return 'ok';
  return 'idle';
}

function nivelStatusToUi(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('válid') || s.includes('valid') || s.includes('habilit')) return 'validado';
  if (s.includes('vencendo') || s.includes('a vencer')) return 'vencendo';
  if (s.includes('vencid')) return 'vencido';
  if (s.includes('pend')) return 'pendente';
  return 'nao_cadastrado';
}

function isPaidStatus(status) {
  const s = String(status || '').toLowerCase();
  return ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado', 'liberado', 'liberada'].includes(s);
}

function docChecklistStatusToUi(status) {
  if (status === 'ok') return 'ok';
  if (status === 'vencida') return 'danger';
  if (status === 'vencendo') return 'warn';
  return 'idle';
}

function buildDocChecklistDescricao(item) {
  if (item.status === 'ok' && item.validade && item.validade !== '—') {
    return `Válido até ${item.validade}`;
  }
  if (item.status === 'vencida') {
    return item.validade && item.validade !== '—' ? `Vencido · ${item.validade}` : 'Vencido';
  }
  if (item.status === 'vencendo') {
    return item.validade && item.validade !== '—' ? `Vence em breve · ${item.validade}` : 'Vence em breve';
  }
  if (item.arquivoUrl) {
    return item.validade && item.validade !== '—' ? `Enviado · válido até ${item.validade}` : 'Enviado';
  }
  if (item.uploadManual === false) return 'Obtido via Assistente SICAF';
  return 'Aguardando envio';
}

const PAPEL_LABEL = {
  proprietario: 'Sócio',
  colaborador: 'Colaborador',
  leitura: 'Consulta',
};

async function getValoresConfig(db) {
  let valorCadastroSicaf = 985;
  let valorManutencaoMensal = 155;
  try {
    const [cad, manut] = await Promise.all([
      db('configuracoes_sistema').where('chave', 'valor_cadastro_sicaf').first(),
      db('configuracoes_sistema').where('chave', 'valor_manutencao_mensal').first(),
    ]);
    if (cad) valorCadastroSicaf = parseFloat(cad.valor);
    if (manut) valorManutencaoMensal = parseFloat(manut.valor);
  } catch (_) {}
  return { valorCadastroSicaf, valorManutencaoMensal };
}

async function getGerenciarPainel(clienteId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  const valores = await getValoresConfig(db);

  let certidoes = [];
  try {
    certidoes = await db('certidoes as cert')
      .leftJoin('tipo_certidoes as tc', 'cert.tipo_certidao_id', 'tc.id')
      .where('cert.cliente_id', clienteId)
      .select(
        'cert.id',
        'cert.numero',
        'cert.nivel_sicaf',
        'cert.data_emissao',
        'cert.data_validade',
        'cert.status',
        'cert.dias_restantes',
        'cert.arquivo_url',
        'cert.arquivo_nome',
        'tc.nome as tipo_nome',
        'tc.orgao_emissor',
        'tc.codigo as tipo_codigo',
      )
      .orderBy('cert.nivel_sicaf', 'asc');
  } catch (_) {}

  let documentos = [];
  try {
    documentos = await db('documentos')
      .where('cliente_id', clienteId)
      .whereNull('deleted_at')
      .orderBy('data_upload', 'desc')
      .limit(50);
  } catch (_) {}

  let sicafNiveis = [];
  if (sicaf?.id) {
    try {
      sicafNiveis = await db('sicaf_niveis')
        .where('sicaf_id', sicaf.id)
        .select('nivel', 'habilitado', 'status', 'observacao');
    } catch (_) {}
  }

  let manutencao = null;
  let manutencaoAcoes = [];
  try {
    manutencao = await db('manutencoes')
      .where('cliente_id', clienteId)
      .whereIn('status', ['Ativo', 'ativo', 'A Vencer', 'a vencer', 'Vencendo', 'vencendo'])
      .orderBy('created_at', 'desc')
      .first();

    if (manutencao) {
      const boletos = await db('manutencao_boletos')
        .where('manutencao_id', manutencao.id)
        .orderBy('created_at', 'desc')
        .limit(5);
      manutencaoAcoes = boletos.map((b) => ({
        titulo: `Boleto manutenção ${String(b.mes_referencia || '').padStart(2, '0')}/${b.ano_referencia || ''}`,
        descricao: `${isPaidStatus(b.status) ? 'Pago' : 'Pendente'}${b.data_vencimento ? ` · venc. ${fmtDate(b.data_vencimento)}` : ''}`,
        status: isPaidStatus(b.status) ? 'ok' : 'warn',
      }));
    }
  } catch (_) {}

  let taxasSicaf = [];
  try {
    taxasSicaf = await db('taxas_sicaf').where('cliente_id', clienteId).orderBy('created_at', 'desc');
  } catch (_) {}

  let pagamentos = [];
  try {
    pagamentos = await db('pagamentos')
      .where('cliente_id', clienteId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(30);
  } catch (_) {}

  let historicoAcoes = [];
  try {
    const hasAudit = await db.schema.hasTable('auditoria_log');
    if (hasAudit) {
      historicoAcoes = await db('auditoria_log')
        .where(function () {
          this.where('entidade', 'clientes').andWhere('entidade_id', clienteId);
        })
        .orderBy('created_at', 'desc')
        .limit(20)
        .select('id', 'acao', 'created_at');
    }
  } catch (_) {}

  let ultimaAnalise = null;
  try {
    ultimaAnalise = await db('sicaf_analises')
      .where('cliente_id', clienteId)
      .orderBy('created_at', 'desc')
      .first();
  } catch (_) {}

  const certidoesUi = certidoes.map((c) => {
    const dias = c.dias_restantes != null ? Number(c.dias_restantes) : null;
    let desc = c.data_validade ? `Válida até ${fmtDate(c.data_validade)}` : c.status || 'Sem validade';
    if (dias != null && dias < 0) desc = `Vencida em ${fmtDate(c.data_validade)}`;
    else if (dias != null && dias <= 30) desc = `Vence em ${dias} dias`;
    return {
      id: c.id,
      titulo: c.tipo_nome || c.arquivo_nome || 'Certidão',
      descricao: desc,
      emissor: c.orgao_emissor || '',
      status: certStatusToUi(c.status, dias),
      nivel: c.nivel_sicaf,
      dataValidade: fmtDate(c.data_validade),
      arquivoUrl: c.arquivo_url,
    };
  });

  const documentosUi = [];
  const docIdsVistos = new Set();

  try {
    const checklistRes = await getChecklistDocumentosAdmin(clienteId);
    if (checklistRes.ok && checklistRes.docsPorNivel) {
      for (const items of Object.values(checklistRes.docsPorNivel)) {
        for (const item of items) {
          docIdsVistos.add(`tc-${item.tipoCertidaoId}`);
          documentosUi.push({
            id: item.tipoCertidaoId,
            titulo: item.nome,
            descricao: buildDocChecklistDescricao(item),
            status: docChecklistStatusToUi(item.status),
            nivel: item.nivelSicaf,
            dataValidade: item.validade && item.validade !== '—' ? item.validade : null,
            arquivoUrl: item.arquivoUrl,
            codigo: item.codigo,
            uploadManual: item.uploadManual,
          });
        }
      }
    }
  } catch (_) {}

  for (const d of documentos) {
    const key = `doc-${d.id}`;
    if (docIdsVistos.has(key)) continue;
    documentosUi.push({
      id: d.id,
      titulo: d.nome,
      descricao: d.data_validade
        ? `Válido até ${fmtDate(d.data_validade)}`
        : d.data_upload
          ? `Enviado em ${fmtDate(d.data_upload)}`
          : d.status === 'expired'
            ? 'Vencido'
            : 'Sem data',
      status: d.status === 'expired' ? 'danger' : d.status === 'expiring' ? 'warn' : d.arquivo_url ? 'ok' : 'idle',
      nivel: d.nivel_sicaf || null,
      dataValidade: fmtDate(d.data_validade),
      arquivoUrl: d.arquivo_url,
    });
  }

  let colaboradoresUi = [];
  try {
    const vinculos = await db('usuario_clientes as uc')
      .join('usuarios as u', 'u.id', 'uc.usuario_id')
      .where('uc.cliente_id', clienteId)
      .whereNull('u.deleted_at')
      .select(
        'u.id',
        'u.nome',
        'u.email',
        'u.telefone',
        'u.departamento',
        'u.status',
        'u.email_verificado_em',
        'u.ultimo_login',
        'uc.papel',
      )
      .orderBy('u.nome', 'asc');

    colaboradoresUi = vinculos.map((v) => {
      const ativo = String(v.status || '').toLowerCase() === 'ativo';
      const verificado = !!v.email_verificado_em;
      let statusUi = 'ativo';
      if (!ativo) statusUi = 'inativo';
      else if (!verificado) statusUi = 'convite';

      let ultimoAcesso = null;
      if (v.ultimo_login) {
        const dt = new Date(v.ultimo_login);
        if (!Number.isNaN(dt.getTime())) {
          ultimoAcesso = fmtDate(v.ultimo_login);
        }
      }

      return {
        id: v.id,
        nome: v.nome,
        email: v.email,
        telefone: v.telefone,
        cargo: v.departamento || PAPEL_LABEL[v.papel] || 'Colaborador',
        papel: v.papel,
        papelLabel: PAPEL_LABEL[v.papel] || v.papel,
        status: statusUi,
        ultimoAcesso,
      };
    });
  } catch (_) {}

  try {
    const contatos = await db('cliente_contatos')
      .where('cliente_id', clienteId)
      .orderBy('principal', 'desc')
      .orderBy('nome', 'asc');

    for (const c of contatos) {
      const jaExiste = colaboradoresUi.some(
        (col) => col.email && c.email && String(col.email).toLowerCase() === String(c.email).toLowerCase(),
      );
      if (jaExiste) continue;
      colaboradoresUi.push({
        id: `contato-${c.id}`,
        nome: c.nome,
        email: c.email,
        telefone: c.telefone,
        cargo: c.cargo || 'Contato',
        papel: 'contato',
        papelLabel: c.principal ? 'Contato principal' : 'Contato',
        status: 'ativo',
        ultimoAcesso: null,
      });
    }
  } catch (_) {}

  const niveisDetail = {};
  for (const n of sicafNiveis) {
    niveisDetail[n.nivel] = {
      status: nivelStatusToUi(n.status || (n.habilitado ? 'validado' : 'nao_cadastrado')),
      observacao: n.observacao || undefined,
    };
  }

  const hasPaidTaxRecord = taxasSicaf.some((t) => isPaidStatus(t.status));
  const sicafDisplayStatus = sicaf
    ? resolveSicafDisplayStatus(sicaf.status, sicaf.data_validade, true)
    : 'Sem SICAF';
  const taxaAccessParams = {
    hasSicaf: !!sicaf,
    status: sicafDisplayStatus,
    financialReleased: hasPaidTaxRecord,
  };
  const taxaPendente = needsSicafTaxaPayment(taxaAccessParams);
  const taxaPaga = hasPaidTaxRecord;
  const acessoLiberado = isSicafAcessoLiberado(taxaAccessParams);
  const ultimaTaxa = taxasSicaf[0] || null;

  const pagamentosHistorico = pagamentos.map((p) => ({
    id: p.id,
    titulo: p.descricao || `${p.origem || 'Pagamento'} ${p.tipo || ''}`.trim(),
    descricao: `${isPaidStatus(p.status) ? 'Pago' : 'Pendente'}${p.data_pagamento ? ` em ${fmtDate(p.data_pagamento)}` : ''}${p.tipo ? ` · ${String(p.tipo).toUpperCase()}` : ''}`,
    status: isPaidStatus(p.status) ? 'ok' : 'warn',
    valor: Number(p.valor),
    linkPdf: p.link_pdf,
    linkBoleto: p.link_boleto,
  }));

  const proximoBoletoManut = manutencao
    ? await db('manutencao_boletos')
        .where('manutencao_id', manutencao.id)
        .whereNotIn('status', ['pago', 'paga', 'cancelado'])
        .orderBy('data_vencimento', 'asc')
        .first()
        .catch(() => null)
    : null;

  const manutencaoAtiva =
    !!manutencao &&
    ['ativo', 'a vencer', 'vencendo'].includes(String(manutencao.status || '').toLowerCase());

  const certVencidas = certidoesUi.filter((c) => c.status === 'danger').length;

  const pendencias = [];

  if (ultimaAnalise?.analise_json) {
    let analise = ultimaAnalise.analise_json;
    if (typeof analise === 'string') {
      try { analise = JSON.parse(analise); } catch { analise = {}; }
    }
    for (const p of analise.pendencias || []) {
      pushPendenciaUnica(pendencias, {
        titulo: p.titulo || p.problema || 'Pendência',
        descricao: p.problema || p.solucao || '',
        status: String(p.prioridade || '').toLowerCase() === 'alta' ? 'danger' : 'warn',
        nivel: p.nivel || null,
      });
    }
  }

  for (const c of certidoesUi) {
    if (c.status === 'danger' || c.status === 'warn') {
      pushPendenciaUnica(pendencias, {
        titulo: c.titulo,
        descricao: c.descricao,
        status: c.status,
        nivel: c.nivel,
      });
    }
  }

  for (const n of sicafNiveis) {
    const st = String(n.status || '');
    if (['Pendente', 'Vencido', 'A Vencer'].includes(st)) {
      pushPendenciaUnica(pendencias, {
        titulo: `Nível ${n.nivel} — ${st}`,
        descricao: n.observacao || 'Regularize no portal SICAF',
        status: st === 'Vencido' ? 'danger' : 'warn',
        nivel: n.nivel,
      });
    }
  }

  const certFull = await getCertidoesStatus(clienteId);
  if (certFull.ok && Array.isArray(certFull.items)) {
    for (const item of certFull.items) {
      if (item.status === 'valid') continue;

      let descricao = item.descricao || '';
      let status = 'warn';

      if (item.status === 'missing') {
        descricao = descricao || 'Documento ou certidão não cadastrada';
        status = 'danger';
      } else if (item.status === 'expired') {
        const validadeFmt = item.dataValidade ? fmtDate(item.dataValidade) : null;
        descricao = validadeFmt ? `Vencida em ${validadeFmt}` : 'Certidão vencida';
        status = 'danger';
      } else if (item.status === 'expiring') {
        const dias = item.diasRestantes != null ? Number(item.diasRestantes) : null;
        descricao = dias != null ? `Vence em ${dias} dias` : 'Vencendo em breve';
        status = 'warn';
      }

      pushPendenciaUnica(pendencias, {
        titulo: item.nome,
        descricao,
        status,
        nivel: item.nivelSicaf || null,
      });
    }
  }

  for (const nivel of NIVEIS_SICAF_ROMAN) {
    const det = niveisDetail[nivel];
    if (det?.status === 'validado') continue;

    const jaTemNivel = pendencias.some(
      (p) => p.nivel === nivel || String(p.titulo || '').includes(`Nível ${nivel}`),
    );
    if (jaTemNivel) continue;

    const label =
      det?.status === 'nao_cadastrado'
        ? 'não cadastrado'
        : det?.status === 'pendente'
          ? 'pendente'
          : det?.status || 'incompleto';

    pushPendenciaUnica(pendencias, {
      titulo: `Nível ${nivel} — ${label}`,
      descricao: det?.observacao || 'Atualize este nível em /sicaf ou com o Assistente CADBRASIL',
      status: det?.status === 'vencido' ? 'danger' : 'warn',
      nivel,
    });
  }

  if (!sicaf) {
    pushPendenciaUnica(pendencias, {
      titulo: 'Cadastro SICAF',
      descricao: 'Empresa ainda não possui cadastro SICAF. Gere a taxa e inicie o processo.',
      status: 'warn',
    });
  } else if (taxaPendente) {
    const taxaGeradaAguardando = taxasSicaf.some((t) => !isPaidStatus(t.status));
    pushPendenciaUnica(pendencias, {
      titulo: 'Pagamento da taxa SICAF',
      descricao: taxaGeradaAguardando
        ? 'Taxa gerada — aguardando confirmação do pagamento'
        : 'Gere e pague a taxa para liberar o cadastro SICAF',
      status: 'warn',
    });
  }

  const docsEnviados = documentosUi.filter((d) => d.status === 'ok' || d.arquivoUrl).length;
  if (docsEnviados < 4) {
    pushPendenciaUnica(pendencias, {
      titulo: 'Documentação da empresa',
      descricao: `Envie os documentos básicos (${docsEnviados}/4 mínimos enviados)`,
      status: 'warn',
    });
  }

  if (sicaf) {
    const completude = sicaf.completude != null ? Number(sicaf.completude) : 0;
    const niveisValidados = NIVEIS_SICAF_ROMAN.filter((n) => niveisDetail[n]?.status === 'validado').length;
    if (completude < 100 && niveisValidados < NIVEIS_SICAF_ROMAN.length) {
      pushPendenciaUnica(pendencias, {
        titulo: 'Completude do SICAF',
        descricao: `${niveisValidados} de 6 níveis validados · ${Math.round(completude)}% de completude`,
        status: niveisValidados === 0 ? 'danger' : 'warn',
      });
    }
  }

  return {
    ok: true,
    cliente: {
      id: cliente.id,
      razaoSocial: cliente.razao_social,
      nomeFantasia: cliente.nome_fantasia,
      documento: cliente.documento,
      email: cliente.email,
      telefone: cliente.telefone,
      celular: cliente.celular,
      endereco: cliente.endereco,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      inscricaoEstadual: cliente.inscricao_estadual,
      inscricaoMunicipal: cliente.inscricao_municipal,
      ramoAtividade: cliente.ramo_atividade,
      responsavel: cliente.responsavel_nome,
      responsavelEmail: cliente.responsavel_email,
      responsavelTelefone: cliente.responsavel_telefone,
    },
    sicaf: sicaf
      ? {
          id: sicaf.id,
          status: resolveSicafDisplayStatus(sicaf.status, sicaf.data_validade, true),
          validade: fmtDate(sicaf.data_validade),
          diasValidade: sicaf.data_validade ? Math.max(0, calcDaysRemaining(sicaf.data_validade) ?? 0) : null,
          completude: sicaf.completude != null ? Number(sicaf.completude) : 0,
          manutencaoAtiva: sicaf.manutencao_ativa === 1,
        }
      : null,
    niveisDetail,
    certidoes: certidoesUi,
    documentos: documentosUi,
    colaboradores: colaboradoresUi,
    pendencias,
    manutencao: {
      ativa: manutencaoAtiva,
      valorMensal: valores.valorManutencaoMensal,
      valorMensalFmt: fmtMoney(valores.valorManutencaoMensal),
      diaVencimento: proximoBoletoManut?.data_vencimento
        ? new Date(proximoBoletoManut.data_vencimento).getDate()
        : manutencao?.data_inicio
          ? new Date(manutencao.data_inicio).getDate()
          : null,
      proximoVencimento: proximoBoletoManut?.data_vencimento ? fmtDate(proximoBoletoManut.data_vencimento) : null,
      acoes: manutencaoAcoes,
      historico: historicoAcoes.map((h) => ({
        titulo: h.acao,
        descricao: fmtDate(h.created_at) || '',
        status: 'ok',
      })),
    },
    financeiro: {
      valorCadastroSicaf: valores.valorCadastroSicaf,
      valorCadastroSicafFmt: fmtMoney(valores.valorCadastroSicaf),
      valorManutencaoMensal: valores.valorManutencaoMensal,
      valorManutencaoMensalFmt: fmtMoney(valores.valorManutencaoMensal),
      taxaPendente,
      taxaPaga,
      acessoLiberado,
      ultimaTaxa: ultimaTaxa
        ? {
            valor: Number(ultimaTaxa.valor),
            status: ultimaTaxa.status,
            ano: ultimaTaxa.ano_referencia,
          }
        : null,
      proximaCobranca:
        manutencaoAtiva && proximoBoletoManut
          ? {
              valor: Number(proximoBoletoManut.valor || valores.valorManutencaoMensal),
              valorFmt: fmtMoney(proximoBoletoManut.valor || valores.valorManutencaoMensal),
              data: fmtDate(proximoBoletoManut.data_vencimento),
            }
          : null,
      renovacaoSicaf: sicaf?.data_validade
        ? { data: fmtDate(sicaf.data_validade), valorFmt: fmtMoney(valores.valorCadastroSicaf) }
        : null,
      historico: pagamentosHistorico,
    },
    badges: {
      faltam: pendencias.length,
      certidoes: certVencidas,
      manutencao: manutencaoAtiva ? 'ativo' : undefined,
      documentos: documentosUi.length
        ? `${documentosUi.filter((d) => d.status === 'ok').length}/${documentosUi.length}`
        : undefined,
      colaboradores: colaboradoresUi.length ? String(colaboradoresUi.length) : undefined,
    },
  };
}

async function updateClienteEmpresa(clienteId, usuarioId, payload) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const str = (v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  const updates = {};
  if (payload.razao_social !== undefined || payload.nome !== undefined) {
    updates.razao_social = str(payload.razao_social ?? payload.nome) ?? cliente.razao_social;
  }
  if (payload.email !== undefined) updates.email = str(payload.email);
  if (payload.telefone !== undefined) updates.telefone = str(payload.telefone);
  if (payload.endereco !== undefined) updates.endereco = str(payload.endereco);
  if (payload.cidade !== undefined) updates.cidade = str(payload.cidade);
  if (payload.estado !== undefined || payload.uf !== undefined) {
    const e = str(payload.estado ?? payload.uf);
    updates.estado = e ? e.slice(0, 2).toUpperCase() : null;
  }
  if (payload.ramo_atividade !== undefined || payload.ramoAtividade !== undefined) {
    updates.ramo_atividade = str(payload.ramo_atividade ?? payload.ramoAtividade);
  }
  if (payload.inscricao_estadual !== undefined || payload.inscricaoEstadual !== undefined) {
    updates.inscricao_estadual = str(payload.inscricao_estadual ?? payload.inscricaoEstadual);
  }
  if (payload.inscricao_municipal !== undefined || payload.inscricaoMunicipal !== undefined) {
    updates.inscricao_municipal = str(payload.inscricao_municipal ?? payload.inscricaoMunicipal);
  }
  if (payload.responsavel_nome !== undefined || payload.responsavel !== undefined) {
    updates.responsavel_nome = str(payload.responsavel_nome ?? payload.responsavel);
  }
  if (payload.cep !== undefined) {
    const c = str(payload.cep);
    updates.cep = c ? c.replace(/\D/g, '') : null;
  }

  if (!Object.keys(updates).length) {
    return { ok: false, error: 'Nenhum campo para atualizar' };
  }

  updates.updated_at = db.fn.now();
  await db('clientes').where('id', clienteId).update(updates);

  return getGerenciarPainel(clienteId, usuarioId);
}

module.exports = { getGerenciarPainel, updateClienteEmpresa };
