/**
 * Serviço de persistência de certidões e atualização do SICAF no MySQL.
 * Usa as tabelas: clientes, certidoes, tipo_certidoes, sicaf_cadastros, sicaf_niveis
 */
const { getDb } = require('../../../database/connection');
const { CERTIDAO_TIPO_MAP } = require('../constants');
const { parseDate, calcDiasVencimento } = require('../../../utils/helpers');

// Cache de tipo_certidoes (codigo → { id, nivel_sicaf }) carregado uma vez do banco
let tipoCertidoesCache = null;

/**
 * Carrega o mapeamento codigo → { id, nivel_sicaf } da tabela tipo_certidoes.
 */
async function loadTipoCertidoesCache() {
  if (tipoCertidoesCache) return tipoCertidoesCache;
  const db = getDb();
  if (!db) return {};

  try {
    const rows = await db('tipo_certidoes').select('id', 'codigo', 'nivel_sicaf');
    tipoCertidoesCache = {};
    for (const row of rows) {
      tipoCertidoesCache[row.codigo] = { id: row.id, nivel_sicaf: row.nivel_sicaf };
    }
    console.log(`  [DB] ✔ Cache tipo_certidoes carregado: ${rows.length} tipos`);
    return tipoCertidoesCache;
  } catch (e) {
    console.log(`  [DB] ⚠ Erro ao carregar tipo_certidoes: ${e.message.substring(0, 60)}`);
    return {};
  }
}

/**
 * Mapeia o nome da certidão (texto livre) → código interno (ex: 'cnd_federal').
 */
function mapCertidaoCodigo(nome) {
  const lower = (nome || '').toLowerCase();
  for (const [key, val] of Object.entries(CERTIDAO_TIPO_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'outro';
}

/**
 * Resolve o tipo_certidao_id e nivel_sicaf a partir do nome da certidão.
 * @param {string} nome - Nome da certidão (texto livre)
 * @returns {Promise<{id: number, nivel_sicaf: string|null}|null>}
 */
async function resolveTipoCertidao(nome) {
  const codigo = mapCertidaoCodigo(nome);
  const cache = await loadTipoCertidoesCache();
  return cache[codigo] || cache['outro'] || null;
}

/**
 * Converte situação do documento para o ENUM do banco.
 * @param {string} situacao - Texto da situação
 * @param {number|null} dias - Dias para vencimento
 * @returns {string} 'Válida' | 'Vencendo' | 'Vencida'
 */
function mapCertidaoStatus(situacao, dias) {
  const lower = (situacao || '').toLowerCase();
  
  // Se tiver dias calculados, usar como referência
  if (dias !== null && dias !== undefined) {
    if (dias < 0) return 'Vencida';
    if (dias <= 30) return 'Vencendo';
    return 'Válida';
  }

  // Fallback pelo texto
  if (lower.includes('vencida') || lower.includes('expirad')) return 'Vencida';
  if (lower.includes('pendência') || lower.includes('pendencia') || lower.includes('irregular')) return 'Vencida';
  if (lower.includes('próxima') || lower.includes('proxima') || lower.includes('vencendo')) return 'Vencendo';
  if (lower.includes('regular') || lower.includes('negativa') || lower.includes('válida') || lower.includes('valida')) return 'Válida';
  return 'Válida';
}

/**
 * Salva/atualiza certidões no MySQL a partir de dados extraídos do PDF.
 * Busca o cliente pela tabela `clientes` usando o CNPJ.
 * Após salvar, atualiza o status do SICAF.
 *
 * @param {Object} data - { cnpj, razao_social, certidoes: [...] }
 * @returns {Object} Resultado da operação
 */
async function saveCertidoesToDB(data) {
  const db = getDb();
  if (!db || !data || !data.cnpj) {
    return { saved: false, reason: 'Sem conexão MySQL ou CNPJ ausente' };
  }

  try {
    const tipoDocumentoLower = String(data.tipo_documento || '').toLowerCase();
    const isSituacaoFornecedor = tipoDocumentoLower.includes('situação do fornecedor') || tipoDocumentoLower.includes('situacao do fornecedor');

    // Limpar documento (remover formatação)
    const docClean = data.cnpj.replace(/[.\-\/]/g, '').trim();
    const docFormatted = data.cnpj.trim();

    // Garantir que o cache está carregado
    await loadTipoCertidoesCache();

    // 1. Buscar o cliente no banco (campo documento = CPF ou CNPJ)
    let cliente = await db('clientes')
      .where('documento', docFormatted)
      .orWhereRaw("REPLACE(REPLACE(REPLACE(documento, '.', ''), '/', ''), '-', '') = ?", [docClean])
      .first();

    if (!cliente) {
      console.log(`  [DB] ⚠ Cliente não encontrado para documento: ${docFormatted}`);
      return { saved: false, reason: `Cliente não encontrado no sistema para CPF/CNPJ: ${docFormatted}` };
    }

    console.log(`  [DB] ✔ Cliente encontrado: ${cliente.razao_social} (id: ${cliente.id})`);

    // 1b. Atualizar razão social se o PDF trouxer uma mais atualizada
    // (exceto para "Situação do Fornecedor", que deve atualizar apenas sicaf_niveis)
    if (!isSituacaoFornecedor && data.razao_social && data.razao_social.trim().length > 3) {
      const pdfNome = data.razao_social.trim().toUpperCase();
      const dbNome = (cliente.razao_social || '').trim().toUpperCase();
      if (pdfNome !== dbNome && pdfNome.length >= dbNome.length) {
        await db('clientes').where('id', cliente.id).update({ razao_social: data.razao_social.trim() });
        console.log(`  [DB] ℹ Razão social atualizada: "${dbNome}" → "${pdfNome}"`);
        cliente.razao_social = data.razao_social.trim();
      }
    }

    // 2. Buscar ou criar sicaf_cadastros
    let sicaf = await db('sicaf_cadastros').where('cliente_id', cliente.id).first();
    if (!sicaf) {
      const [sicafId] = await db('sicaf_cadastros').insert({
        cliente_id: cliente.id,
        status: isSituacaoFornecedor ? 'Ativo' : 'Pendente',
        completude: 0,
        data_ultima_atualizacao: db.fn.now(),
      });
      sicaf = { id: sicafId };
      console.log(`  [DB] ✔ SICAF cadastro criado para cliente #${cliente.id}`);
    }

    // 3. Upsert certidões
    let inserted = 0;
    let updated = 0;
    const niveisAfetados = new Set();

    for (const cert of data.certidoes || []) {
      const tipoCert = await resolveTipoCertidao(cert.nome);
      if (!tipoCert) {
        console.log(`  [DB] ⚠ Tipo não encontrado para: ${cert.nome} — ignorando`);
        continue;
      }

      const dataEmissao = parseDate(cert.data_emissao);
      const dataValidade = parseDate(cert.data_validade);
      const dias = calcDiasVencimento(dataValidade);
      const status = mapCertidaoStatus(cert.situacao, dias);
      const nivelSicaf = tipoCert.nivel_sicaf || null;

      if (nivelSicaf) niveisAfetados.add(nivelSicaf);

      // Verificar se já existe certidão desse tipo para esse cliente
      const existing = await db('certidoes')
        .where({ cliente_id: cliente.id, tipo_certidao_id: tipoCert.id })
        .first();

      if (existing) {
        await db('certidoes').where('id', existing.id).update({
          nivel_sicaf: nivelSicaf,
          data_emissao: dataEmissao || existing.data_emissao,
          data_validade: dataValidade || existing.data_validade,
          status,
          dias_restantes: dias || 0,
          sicaf_id: sicaf.id,
          observacoes: cert.situacao || existing.observacoes,
          updated_at: db.fn.now(),
        });
        updated++;
        console.log(`  [DB]   ↻ Atualizado: ${cert.nome} → ${status} (val: ${dataValidade || '?'}, dias: ${dias || '?'})`);
      } else {
        await db('certidoes').insert({
          cliente_id: cliente.id,
          sicaf_id: sicaf.id,
          tipo_certidao_id: tipoCert.id,
          nivel_sicaf: nivelSicaf,
          data_emissao: dataEmissao,
          data_validade: dataValidade,
          status,
          dias_restantes: dias || 0,
          observacoes: cert.situacao,
        });
        inserted++;
        console.log(`  [DB]   ✚ Inserido: ${cert.nome} → ${status} (val: ${dataValidade || '?'}, dias: ${dias || '?'})`);
      }
    }

    // 4. Usar niveis_sicaf do PDF para habilitar/desabilitar níveis
    //    O PDF "Situação do Fornecedor" é a fonte de verdade para quais níveis estão ativos.
    //    Níveis marcados como "Não habilitado" devem ser desabilitados no banco.
    const niveisResult = {};
    const todosNiveis = ['I', 'II', 'III', 'IV', 'V', 'VI'];

    if (data.niveis_sicaf && typeof data.niveis_sicaf === 'object') {
      const niveisPresentes = [];
      const niveisNaoHabilitados = [];

      for (const [nivel, info] of Object.entries(data.niveis_sicaf)) {
        if (info && typeof info === 'object' && info.situacao) {
          const sit = (info.situacao || '').toLowerCase();
          if (sit === 'não habilitado' || sit === 'nao habilitado') {
            niveisNaoHabilitados.push(nivel);
          } else {
            niveisPresentes.push(nivel);
            niveisResult[nivel] = {
              status: info.situacao,
              descricao: info.descricao || '',
              validade: info.validade || null,
            };
          }
        }
      }

      // Situação do Fornecedor: I e II sempre existem (o fornecedor está credenciado)
      if (isSituacaoFornecedor) {
        if (!niveisPresentes.includes('I')) {
          niveisPresentes.push('I');
          niveisResult['I'] = { status: 'Regular', descricao: 'Credenciamento (validado via Situação do Fornecedor)' };
          const idx1 = niveisNaoHabilitados.indexOf('I');
          if (idx1 >= 0) niveisNaoHabilitados.splice(idx1, 1);
        }
        if (!niveisPresentes.includes('II')) {
          niveisPresentes.push('II');
          niveisResult['II'] = { status: 'Regular', descricao: 'Habilitação Jurídica (validado via Situação do Fornecedor)' };
          const idx2 = niveisNaoHabilitados.indexOf('II');
          if (idx2 >= 0) niveisNaoHabilitados.splice(idx2, 1);
        }
        // Garantir que I e II não fiquem com status diferente de Válido/Regular
        if (niveisResult['I'] && !niveisResult['I'].status) niveisResult['I'].status = 'Regular';
        if (niveisResult['II'] && !niveisResult['II'].status) niveisResult['II'].status = 'Regular';
        console.log(`  [DB] ℹ Situação do Fornecedor → habilitando I e II automaticamente como Válido`);
      }

      // Regra cumulativa: se qualquer nível >= III está presente, I e II devem estar também
      const temNivelAlto = niveisPresentes.some(n => ['III', 'IV', 'V', 'VI'].includes(n));
      if (temNivelAlto && !isSituacaoFornecedor) {
        if (!niveisPresentes.includes('I')) {
          niveisPresentes.push('I');
          niveisResult['I'] = { status: 'Regular', descricao: 'Credenciamento (implícito)' };
          const idx1 = niveisNaoHabilitados.indexOf('I');
          if (idx1 >= 0) niveisNaoHabilitados.splice(idx1, 1);
        }
        if (!niveisPresentes.includes('II')) {
          niveisPresentes.push('II');
          niveisResult['II'] = { status: 'Regular', descricao: 'Habilitação Jurídica (implícito)' };
          const idx2 = niveisNaoHabilitados.indexOf('II');
          if (idx2 >= 0) niveisNaoHabilitados.splice(idx2, 1);
        }
        console.log(`  [DB] ℹ Níveis III+ detectados no PDF → habilitando I e II automaticamente`);
      }

      // Mapeamento de situação do PDF → status do banco
      // Pendência explícita no PDF tem prioridade; caso contrário, nível presente = regular.
      function mapNivelStatus(situacao, descricao) {
        const s = String(situacao || '').toLowerCase().trim();
        const d = String(descricao || '').toLowerCase();

        const temPendenciaExplicita =
          d.includes('possui pendência') ||
          d.includes('possui pendencia') ||
          s.includes('possui pendência') ||
          s.includes('possui pendencia') ||
          s === 'pendente' ||
          s.includes('pendência') ||
          s.includes('pendencia');

        if (temPendenciaExplicita) return 'Pendente';
        if (s.includes('vencido') || s.includes('expirad')) return 'Vencido';
        if (s.includes('vencendo') || s.includes('próxim') || s.includes('proxim')) return 'Vencendo';

        if (
          s.includes('regular') ||
          s.includes('válido') ||
          s.includes('valido') ||
          s.includes('habilitado') ||
          s.includes('credenciado') ||
          s.includes('ativo')
        ) {
          return 'Válido';
        }

        // Nível listado no PDF sem marcador de problema → considerar regular
        return 'Válido';
      }

      // Habilitar cada nível presente no PDF (com status e observação do PDF)
      for (const nivel of niveisPresentes) {
        niveisAfetados.add(nivel);
        const info = niveisResult[nivel] || {};
        const nivelStatusPdf = mapNivelStatus(info.status || '', info.descricao || '');
        const nivelObs = [info.descricao, info.validade ? `Validade: ${info.validade}` : null].filter(Boolean).join(' — ') || null;

        const existeNivel = await db('sicaf_niveis')
          .where({ sicaf_id: sicaf.id, nivel })
          .first();

        if (existeNivel) {
          await db('sicaf_niveis')
            .where({ sicaf_id: sicaf.id, nivel })
            .update({ habilitado: 1, status: nivelStatusPdf, observacao: nivelObs });
          console.log(`  [DB]   ✔ Nível ${nivel} habilitado → ${nivelStatusPdf} (via PDF)`);
        } else {
          await db('sicaf_niveis').insert({
            sicaf_id: sicaf.id,
            nivel,
            habilitado: 1,
            status: nivelStatusPdf,
            observacao: nivelObs,
          });
          console.log(`  [DB]   ✚ Nível ${nivel} criado → ${nivelStatusPdf} (via PDF)`);
        }
      }

      // Desabilitar níveis que o PDF indica como "Não habilitado"
      for (const nivel of niveisNaoHabilitados) {
        const existeNivel = await db('sicaf_niveis')
          .where({ sicaf_id: sicaf.id, nivel })
          .first();

        if (existeNivel) {
          await db('sicaf_niveis')
            .where({ sicaf_id: sicaf.id, nivel })
            .update({ habilitado: 0, status: 'Não informado', observacao: null });
          console.log(`  [DB]   ✖ Nível ${nivel} desabilitado (não informado no PDF)`);
        } else {
          await db('sicaf_niveis').insert({
            sicaf_id: sicaf.id,
            nivel,
            habilitado: 0,
            status: 'Não informado',
            observacao: null,
          });
          console.log(`  [DB]   ✚ Nível ${nivel} criado como não informado`);
        }
      }
    }

    // 5. Recalcular completude e níveis.
    // Regra de negócio: em "Situação do Fornecedor", NÃO alterar sicaf_cadastros.status.
    const sicafStatusResult = await updateSicafStatus(cliente.id, sicaf.id, {
      preserveSicafStatus: isSituacaoFornecedor,
      preserveNivelStatusFromPdf: isSituacaoFornecedor,
    });
    if (isSituacaoFornecedor) {
      console.log('  [DB] ✔ Níveis/certidões/completude atualizados (status geral do SICAF preservado)');
    } else {
      console.log(`  [DB] ✔ Níveis, certidões e completude atualizados.`);
    }

    // 6. Montar evidências por nível (I..VI) para email/relatório
    const niveisDbRows = await db('sicaf_niveis')
      .where('sicaf_id', sicaf.id)
      .select('nivel', 'habilitado', 'status', 'observacao');
    const niveisDbMap = {};
    for (const row of niveisDbRows) niveisDbMap[row.nivel] = row;
    const niveisEvidencias = ['I', 'II', 'III', 'IV', 'V', 'VI'].map((nivel) => {
      const r = niveisDbMap[nivel];
      return {
        nivel,
        habilitado: r ? !!r.habilitado : false,
        status: r?.status || 'Não informado',
        observacao: r?.observacao || null,
      };
    });

    let emailNotificacao = { enviado: false, motivo: 'nao_aplicavel' };
    if (isSituacaoFornecedor) {
      try {
        const situacaoEmailService = require('../../../services/sicaf-situacao-email.service');
        emailNotificacao = await situacaoEmailService.sendSituacaoFornecedorEmail({
          cliente,
          cnpj: docFormatted,
          niveisEvidencias,
          sicafStatus: sicafStatusResult,
          certidoesCount: inserted + updated,
        });
      } catch (emailErr) {
        emailNotificacao = { enviado: false, motivo: 'erro_envio', erro: emailErr.message };
        console.log(`  [Email] ✖ Falha ao enviar resumo: ${emailErr.message.substring(0, 80)}`);
      }
    }

    return {
      saved: true,
      clienteId: cliente.id,
      clienteNome: cliente.razao_social,
      clienteEmail: cliente.email || null,
      cnpj: docFormatted,
      sicafId: sicaf.id,
      certidoesInserted: inserted,
      certidoesUpdated: updated,
      certidoesCount: inserted + updated,
      niveisAfetados: Array.from(niveisAfetados),
      niveisEvidencias,
      sicafStatus: sicafStatusResult || { niveis: niveisResult },
      emailNotificacao,
    };
  } catch (e) {
    console.log(`  [DB] ✖ Erro ao salvar: ${e.message.substring(0, 120)}`);
    return { saved: false, reason: e.message };
  }
}

/**
 * Recalcula e atualiza o status do SICAF de um cliente.
 * Analisa todas as certidões válidas e determina a completude de cada nível.
 *
 * @param {number} clienteId
 * @param {number} sicafId
 * @param {Object} [options]
 * @param {boolean} [options.preserveSicafStatus=false] - Se true, NÃO altera sicaf_cadastros.status
 * @param {boolean} [options.preserveNivelStatusFromPdf=false] - Se true, mantém status dos níveis já gravados pelo PDF
 * @returns {Object} { status, completude, niveis }
 */
async function updateSicafStatus(clienteId, sicafId, options = {}) {
  const db = getDb();
  if (!db) return null;
  const preserveSicafStatus = !!options.preserveSicafStatus;
  const preserveNivelStatusFromPdf = !!options.preserveNivelStatusFromPdf;

  try {
    // 1. Buscar todas as certidões do cliente com nivel_sicaf definido
    const certidoes = await db('certidoes')
      .where('cliente_id', clienteId)
      .whereNotNull('nivel_sicaf');

    // 2. Buscar todos os tipos de certidões ativos com nivel_sicaf definido
    const tiposCertidoes = await db('tipo_certidoes')
      .where('ativo', 1)
      .whereNotNull('nivel_sicaf');

    // Agrupar tipos necessários por nível
    const tiposPorNivel = {};
    for (const t of tiposCertidoes) {
      if (!tiposPorNivel[t.nivel_sicaf]) tiposPorNivel[t.nivel_sicaf] = [];
      tiposPorNivel[t.nivel_sicaf].push(t.id);
    }

    // Agrupar certidões do cliente por nível
    const certPorNivel = {};
    for (const c of certidoes) {
      if (!certPorNivel[c.nivel_sicaf]) certPorNivel[c.nivel_sicaf] = [];
      certPorNivel[c.nivel_sicaf].push(c);
    }

    // 3. Buscar níveis habilitados (informados no documento ou habilitados anteriormente)
    const niveisHabilitadosRows = await db('sicaf_niveis')
      .where({ sicaf_id: sicafId, habilitado: 1 });
    const niveisHabilitadosSet = new Set(niveisHabilitadosRows.map(n => n.nivel));

    // Calcular status de cada nível — SOMENTE os que estão habilitados no sicaf_niveis
    const niveis = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    let totalNiveis = 0;
    let niveisCompletos = 0;
    let temVencido = false;
    let temVencendo = false;
    const niveisStatus = {};

    for (const nivel of niveis) {
      const tiposRequeridos = tiposPorNivel[nivel] || [];
      if (tiposRequeridos.length === 0) continue;

      // Só considerar para completude se o nível está habilitado (informado no SICAF)
      const nivelHabilitado = niveisHabilitadosSet.has(nivel);
      if (!nivelHabilitado) {
        // Nível não habilitado — não conta para completude, marcar como "Não informado"
        niveisStatus[nivel] = {
          status: 'Não informado',
          cobertas: 0,
          total: tiposRequeridos.length,
        };
        continue;
      }

      totalNiveis++;
      const certDoNivel = certPorNivel[nivel] || [];

      // Verificar quantos tipos estão cobertos com certidão válida
      let cobertas = 0;
      let nivelTemVencido = false;
      let nivelTemVencendo = false;

      for (const tipoId of tiposRequeridos) {
        const cert = certDoNivel.find(c => c.tipo_certidao_id === tipoId);
        if (cert) {
          if (cert.status === 'Válida') {
            cobertas++;
          } else if (cert.status === 'Vencendo') {
            cobertas++; // Vencendo ainda conta como coberta
            nivelTemVencendo = true;
          } else if (cert.status === 'Vencida') {
            nivelTemVencido = true;
          }
        }
      }

      let nivelStatus;
      if (cobertas === tiposRequeridos.length && !nivelTemVencido) {
        if (nivelTemVencendo) {
          nivelStatus = 'Vencendo';
          temVencendo = true;
        } else {
          nivelStatus = 'Válido';
        }
        niveisCompletos++;
      } else if (cobertas > 0 || nivelTemVencido) {
        nivelStatus = nivelTemVencido ? 'Vencido' : 'Parcial';
        temVencido = temVencido || nivelTemVencido;
      } else {
        nivelStatus = 'Pendente';
      }

      niveisStatus[nivel] = {
        status: nivelStatus,
        cobertas,
        total: tiposRequeridos.length,
      };
    }

    // 3b. Regra cumulativa: se nível III+ está habilitado, I e II também devem estar
    const temNivelAlto = niveisHabilitadosSet.has('III') || niveisHabilitadosSet.has('IV') || niveisHabilitadosSet.has('V') || niveisHabilitadosSet.has('VI');
    if (temNivelAlto) {
      for (const baseNivel of ['I', 'II']) {
        if (!niveisHabilitadosSet.has(baseNivel)) {
          const existeBase = await db('sicaf_niveis')
            .where({ sicaf_id: sicafId, nivel: baseNivel })
            .first();
          if (existeBase) {
            await db('sicaf_niveis')
              .where({ sicaf_id: sicafId, nivel: baseNivel })
              .update({ habilitado: 1 });
          } else {
            await db('sicaf_niveis').insert({
              sicaf_id: sicafId,
              nivel: baseNivel,
              habilitado: 1,
            });
          }
          niveisHabilitadosSet.add(baseNivel);
          console.log(`  [DB] ℹ Nível ${baseNivel} habilitado automaticamente (cumulative: III+ presente)`);

          // Recalcular status deste nível recém-habilitado
          const tiposReq = tiposPorNivel[baseNivel] || [];
          if (tiposReq.length > 0) {
            totalNiveis++;
            const certDoNivel = certPorNivel[baseNivel] || [];
            let cob = 0;
            let nVencido = false;
            let nVencendo = false;
            for (const tipoId of tiposReq) {
              const cert = certDoNivel.find(c => c.tipo_certidao_id === tipoId);
              if (cert) {
                if (cert.status === 'Válida') { cob++; }
                else if (cert.status === 'Vencendo') { cob++; nVencendo = true; }
                else if (cert.status === 'Vencida') { nVencido = true; }
              }
            }
            let nStatus;
            if (cob === tiposReq.length && !nVencido) {
              nStatus = nVencendo ? 'Vencendo' : 'Válido';
              niveisCompletos++;
              if (nVencendo) temVencendo = true;
            } else if (cob > 0 || nVencido) {
              nStatus = nVencido ? 'Vencido' : 'Parcial';
              if (nVencido) temVencido = true;
            } else {
              nStatus = 'Pendente';
            }
            niveisStatus[baseNivel] = { status: nStatus, cobertas: cob, total: tiposReq.length };
          }
        }
      }
    }

    // 4. Calcular completude geral
    const completude = totalNiveis > 0
      ? Math.round((niveisCompletos / totalNiveis) * 100)
      : 0;

    // 5. Determinar status geral do SICAF
    let statusGeral;
    if (completude === 100 && !temVencido) {
      statusGeral = temVencendo ? 'Vencendo' : 'Ativo';
    } else if (temVencido) {
      statusGeral = completude > 50 ? 'Vencendo' : 'Vencido';
    } else if (completude > 0) {
      statusGeral = 'Pendente';
    } else {
      statusGeral = 'Pendente';
    }

    // 6. Calcular dias de validade (baseado na certidão que vence mais cedo)
    const certsComValidade = certidoes.filter(c => c.data_validade && c.status !== 'Vencida');
    let diasValidade = 0;
    let dataValidade = null;
    if (certsComValidade.length > 0) {
      const maisProxima = certsComValidade.reduce((min, c) => {
        return new Date(c.data_validade) < new Date(min.data_validade) ? c : min;
      });
      dataValidade = maisProxima.data_validade;
      diasValidade = calcDiasVencimento(
        typeof dataValidade === 'string' ? dataValidade : dataValidade.toISOString().split('T')[0]
      ) || 0;
    }

    // 6b. Persistir status e observação de cada nível em sicaf_niveis (baseado nas certidões reais)
    const tipoIdToNome = {};
    for (const t of tiposCertidoes) { tipoIdToNome[t.id] = t.nome; }

    for (const [nivel, info] of Object.entries(niveisStatus)) {
      const tiposRequeridos = tiposPorNivel[nivel] || [];
      const certDoNivel = certPorNivel[nivel] || [];
      const temCertidoesReais = certDoNivel.length > 0;

      try {
        const existeNivel = await db('sicaf_niveis').where({ sicaf_id: sicafId, nivel }).first();
        const certStatus = info.status;

        let finalStatus = certStatus;
        let observacao = null;

        if (temCertidoesReais) {
          const obs = [];
          for (const tipoId of tiposRequeridos) {
            const cert = certDoNivel.find((c) => c.tipo_certidao_id === tipoId);
            const nome = tipoIdToNome[tipoId] || `Tipo #${tipoId}`;
            if (cert) {
              const valStr = cert.data_validade
                ? new Date(cert.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                : '—';
              obs.push(`${nome}: ${cert.status} (Val: ${valStr})`);
            } else {
              obs.push(`${nome}: Não informado`);
            }
          }
          observacao = obs.join('\n');
        }

        if (preserveNivelStatusFromPdf && existeNivel?.status) {
          finalStatus = existeNivel.status;
          if (existeNivel.observacao) {
            observacao = existeNivel.observacao;
          } else if (observacao && finalStatus === 'Pendente' && certStatus !== 'Pendente') {
            observacao = `⚠️ POSSUI PENDÊNCIA (conforme SICAF)\n${observacao}`;
          }
        } else {
          // Prioridade de severidade: Pendente (do PDF/SICAF) não pode ser rebaixado por certidões
          const SEVERITY = {
            Pendente: 4,
            Vencido: 3,
            Parcial: 2,
            Vencendo: 1,
            Válido: 0,
            'Não informado': -1,
          };
          const dbStatus = existeNivel?.status || 'Não informado';
          const dbSev = SEVERITY[dbStatus] ?? -1;
          const certSev = SEVERITY[certStatus] ?? -1;
          finalStatus = dbSev > certSev ? dbStatus : certStatus;

          if (finalStatus !== certStatus) {
            console.log(`  [DB]   ⚠ Nível ${nivel}: cert=${certStatus} → mantendo ${finalStatus} (do PDF/SICAF)`);
          }

          if (observacao) {
            if (finalStatus === 'Pendente' && certStatus !== 'Pendente') {
              observacao = `⚠️ POSSUI PENDÊNCIA (conforme SICAF)\n${observacao}`;
            }
          }
        }

        const updateFields = { status: finalStatus };
        if (observacao) updateFields.observacao = observacao;

        if (existeNivel) {
          await db('sicaf_niveis').where({ sicaf_id: sicafId, nivel }).update(updateFields);
        } else {
          await db('sicaf_niveis').insert({
            sicaf_id: sicafId,
            nivel,
            habilitado: finalStatus !== 'Não informado' ? 1 : 0,
            ...updateFields,
          });
        }
      } catch (_) {}
    }
    console.log(`  [DB] ✔ Status dos níveis persistidos em sicaf_niveis`);

    // 6c. Buscar status finais dos níveis (para retorno, sem alterar statusGeral)
    // O statusGeral do SICAF é baseado apenas na validade das certidões/pagamento,
    // NÃO nas pendências de nível do PDF (que são informativas por nível)
    const niveisFinais = await db('sicaf_niveis').where('sicaf_id', sicafId).where('habilitado', 1).select('nivel', 'status');

    // 7. Atualizar sicaf_cadastros
    const sicafAtual = await db('sicaf_cadastros').where('id', sicafId).first();

    // Completude SEMPRE é atualizada (é dado factual baseado nas certidões reais)
    const updateData = {
      data_ultima_atualizacao: new Date(),
      updated_at: db.fn.now(),
      completude,
    };
    if (!preserveSicafStatus) {
      updateData.status = statusGeral;
    }

    // Só atualizar validade se não tinha uma definida ou se a nova é mais recente
    if (dataValidade) {
      if (!sicafAtual?.data_validade || new Date(dataValidade) > new Date(sicafAtual.data_validade)) {
        updateData.data_validade = dataValidade;
        updateData.dias_validade = diasValidade;
      }
    }

    await db('sicaf_cadastros').where('id', sicafId).update(updateData);

    if (preserveSicafStatus) {
      console.log(`  [DB] ✔ SICAF atualizado sem alterar status geral | completude: ${completude}% | ${totalNiveis} níveis habilitados de ${Object.keys(niveisStatus).length}`);
    } else {
      console.log(`  [DB] ✔ SICAF atualizado: ${statusGeral} | completude: ${completude}% | ${totalNiveis} níveis habilitados de ${Object.keys(niveisStatus).length}`);
    }

    // Construir niveis finais com os status reais do banco (pós-merge com PDF)
    const niveisStatusFinal = { ...niveisStatus };
    for (const nf of niveisFinais) {
      if (niveisStatusFinal[nf.nivel]) {
        niveisStatusFinal[nf.nivel].status = nf.status;
      }
    }

    const statusRetorno = preserveSicafStatus ? (sicafAtual?.status || statusGeral) : statusGeral;

    return {
      status: statusRetorno,
      completude,
      diasValidade,
      niveis: niveisStatusFinal,
    };
  } catch (e) {
    console.log(`  [DB] ✖ Erro ao atualizar SICAF: ${e.message.substring(0, 80)}`);
    return null;
  }
}

/**
 * Invalida o cache para forçar recarga na próxima operação.
 */
function invalidateTipoCertidoesCache() {
  tipoCertidoesCache = null;
}

module.exports = {
  mapCertidaoCodigo,
  mapCertidaoStatus,
  resolveTipoCertidao,
  saveCertidoesToDB,
  updateSicafStatus,
  loadTipoCertidoesCache,
  invalidateTipoCertidoesCache,
};
