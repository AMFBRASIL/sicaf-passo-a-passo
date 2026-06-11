/**
 * Documents Service — CRUD de documentos e pastas.
 * Unifica dados das tabelas `documentos` e `certidoes`.
 */
const { getDb } = require('../database/connection');

/**
 * Lista documentos unificados (tabela documentos + certidoes) com filtros.
 */
async function listDocuments({ search, pasta, clienteId, usuarioId, page = 1, limit = 50 } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // ── 1. Buscar da tabela `documentos` ──
    let docQuery = db('documentos as d')
      .leftJoin('clientes as c', 'd.cliente_id', 'c.id')
      .leftJoin('usuarios as u', 'd.uploaded_by', 'u.id')
      .whereNull('d.deleted_at')
      .select(
        'd.id',
        db.raw("'doc' as origem"),
        'd.nome',
        'd.pasta',
        'd.tipo_arquivo as tipo_arquivo',
        'd.tamanho',
        'd.nivel_sicaf',
        'd.data_validade',
        'd.status',
        'd.arquivo_url',
        'd.data_upload',
        'd.created_at',
        'c.id as cliente_id',
        'c.razao_social as cliente_nome',
        'c.documento as cliente_documento',
        'u.nome as uploaded_by_nome'
      );

    // Filtro por usuário logado (clientes veem apenas seus documentos)
    if (usuarioId) {
      docQuery = docQuery.where('c.usuario_id', usuarioId);
    }

    if (search) {
      docQuery = docQuery.where(function () {
        this.where('d.nome', 'like', `%${search}%`)
          .orWhere('c.razao_social', 'like', `%${search}%`)
          .orWhere('d.pasta', 'like', `%${search}%`);
      });
    }
    if (pasta && pasta !== 'all') {
      docQuery = docQuery.where('d.pasta', pasta);
    }
    if (clienteId) {
      docQuery = docQuery.where('d.cliente_id', clienteId);
    }

    const docRows = await docQuery.orderBy('d.created_at', 'desc');

    // ── 2. Buscar da tabela `certidoes` ──
    let certQuery = db('certidoes as cert')
      .leftJoin('tipo_certidoes as tc', 'cert.tipo_certidao_id', 'tc.id')
      .leftJoin('clientes as c', 'cert.cliente_id', 'c.id')
      .select(
        'cert.id',
        db.raw("'cert' as origem"),
        db.raw('COALESCE(cert.arquivo_nome, tc.nome) as nome'),
        db.raw("COALESCE(CONCAT('Nível ', cert.nivel_sicaf, ' - Certidões'), tc.nome, 'Certidões') as pasta"),
        db.raw("'PDF' as tipo_arquivo"),
        'cert.arquivo_tamanho as tamanho',
        'cert.nivel_sicaf',
        'cert.data_validade',
        db.raw("CASE cert.status WHEN 'Válida' THEN 'valid' WHEN 'Vencendo' THEN 'expiring' WHEN 'Vencida' THEN 'expired' ELSE 'valid' END as status"),
        'cert.arquivo_url',
        'cert.data_emissao as data_upload',
        'cert.created_at',
        'c.id as cliente_id',
        'c.razao_social as cliente_nome',
        'c.documento as cliente_documento',
        db.raw("NULL as uploaded_by_nome")
      );

    // Filtro por usuário logado (clientes veem apenas suas certidões)
    if (usuarioId) {
      certQuery = certQuery.where('c.usuario_id', usuarioId);
    }

    if (search) {
      certQuery = certQuery.where(function () {
        this.where('cert.arquivo_nome', 'like', `%${search}%`)
          .orWhere('tc.nome', 'like', `%${search}%`)
          .orWhere('c.razao_social', 'like', `%${search}%`);
      });
    }
    if (pasta && pasta !== 'all') {
      // Filtro por pasta: se for "Certidões", mostrar todas certidões
      if (pasta === 'Certidões') {
        // Sem filtro extra — já busca de certidoes
      } else if (pasta.startsWith('Nível ')) {
        const nivelMatch = pasta.match(/Nível\s+(\w+)/);
        if (nivelMatch) {
          certQuery = certQuery.where('cert.nivel_sicaf', nivelMatch[1]);
        }
      } else {
        // Se a pasta não é de certidões, retornar vazio
        certQuery = certQuery.where(db.raw('1 = 0'));
      }
    }
    if (clienteId) {
      certQuery = certQuery.where('cert.cliente_id', clienteId);
    }

    const certRows = await certQuery.orderBy('cert.created_at', 'desc');

    // ── 3. Unificar e ordenar por data ──
    const allRows = [...docRows, ...certRows];
    allRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = allRows.length;
    const paginatedRows = limit > 0 ? allRows.slice((page - 1) * limit, page * limit) : allRows;

    const documents = paginatedRows.map((r) => ({
      id: r.id,
      origem: r.origem,
      nome: r.nome,
      pasta: r.pasta || 'Geral',
      tipoArquivo: r.tipo_arquivo,
      tamanho: r.tamanho,
      nivelSicaf: r.nivel_sicaf,
      dataValidade: r.data_validade,
      status: r.status,
      arquivoUrl: r.arquivo_url,
      dataUpload: r.data_upload,
      createdAt: r.created_at,
      clienteId: r.cliente_id,
      clienteNome: r.cliente_nome,
      clienteDocumento: r.cliente_documento,
      uploadedBy: r.uploaded_by_nome,
    }));

    return { ok: true, documents, total, totalPages: Math.ceil(total / (limit || total || 1)) };
  } catch (e) {
    console.error('[Documents] Erro listDocuments:', e.message);
    return { ok: false, error: 'Erro interno: ' + e.message };
  }
}

/**
 * Lista pastas com contagem de documentos (ambas tabelas).
 */
async function listFolders(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // Contagem da tabela documentos
    let docQuery = db('documentos as d')
      .leftJoin('clientes as c', 'd.cliente_id', 'c.id')
      .select('d.pasta')
      .count('d.id as count')
      .groupBy('d.pasta');

    if (usuarioId) {
      docQuery = docQuery.where('c.usuario_id', usuarioId);
    }

    const docRows = await docQuery;

    // Contagem da tabela certidoes (filtrada por usuário se necessário)
    let certCountQuery = db('certidoes as cert');
    if (usuarioId) {
      certCountQuery = certCountQuery
        .leftJoin('clientes as cl', 'cert.cliente_id', 'cl.id')
        .where('cl.usuario_id', usuarioId);
    }
    const certCount = await certCountQuery.count('cert.id as total').first();
    const totalCerts = parseInt(certCount?.total || '0', 10);

    // Cores fixas para pastas conhecidas
    const colorMap = {
      'Contratos Sociais': 'text-blue-500',
      'Certidões': 'text-emerald-500',
      'Propostas': 'text-purple-500',
      'Editais': 'text-amber-500',
      'Atestados': 'text-pink-500',
      'Balanços': 'text-cyan-500',
      'Documentos Gerais': 'text-slate-500',
      'SICAF': 'text-green-500',
      'Geral': 'text-gray-500',
    };

    const folderMap = {};
    for (const r of docRows) {
      if (r.pasta) {
        folderMap[r.pasta] = (folderMap[r.pasta] || 0) + parseInt(r.count, 10);
      }
    }

    // Adicionar pasta "Certidões" com contagem da tabela certidoes
    if (totalCerts > 0) {
      folderMap['Certidões'] = (folderMap['Certidões'] || 0) + totalCerts;
    }

    let idx = 1;
    const folders = Object.entries(folderMap)
      .map(([name, count]) => ({
        id: idx++,
        name,
        count,
        color: colorMap[name] || 'text-blue-500',
      }))
      .sort((a, b) => b.count - a.count);

    const totalDocs = folders.reduce((s, f) => s + f.count, 0);

    return { ok: true, folders, totalDocs };
  } catch (e) {
    console.error('[Documents] Erro listFolders:', e.message);
    return { ok: false, error: 'Erro interno: ' + e.message };
  }
}

/**
 * Insere um documento na base (após upload via storageService).
 */
async function createDocument({ clienteId, nome, pasta, tipoArquivo, tamanho, nivelSicaf, dataValidade, arquivoUrl, uploadedBy }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const [id] = await db('documentos').insert({
      cliente_id: clienteId || null,
      nome,
      pasta: pasta || 'Geral',
      tipo_arquivo: tipoArquivo || 'PDF',
      tamanho: tamanho || null,
      nivel_sicaf: nivelSicaf || null,
      data_validade: dataValidade || null,
      status: 'valid',
      arquivo_url: arquivoUrl || null,
      data_upload: db.fn.now(),
      uploaded_by: uploadedBy || null,
    });

    console.log(`[Documents] Documento #${id} criado: ${nome}`);
    return { ok: true, documentId: id, message: 'Documento enviado com sucesso!' };
  } catch (e) {
    console.error('[Documents] Erro createDocument:', e.message);
    return { ok: false, error: 'Erro interno: ' + e.message };
  }
}

/**
 * Exclui um documento (da tabela documentos OU certidoes).
 */
async function deleteDocument(id, origem) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    if (origem === 'cert') {
      const cert = await db('certidoes').where('id', id).first();
      if (!cert) return { ok: false, error: 'Certidão não encontrada' };
      await db('certidoes').where('id', id).del();
      console.log(`[Documents] Certidão #${id} excluída`);
    } else {
      const doc = await db('documentos').where('id', id).first();
      if (!doc) return { ok: false, error: 'Documento não encontrado' };
      await db('documentos').where('id', id).del();
      console.log(`[Documents] Documento #${id} excluído`);
    }
    return { ok: true, message: 'Documento excluído com sucesso!' };
  } catch (e) {
    console.error('[Documents] Erro deleteDocument:', e.message);
    return { ok: false, error: 'Erro interno: ' + e.message };
  }
}

module.exports = {
  listDocuments,
  listFolders,
  createDocument,
  deleteDocument,
};
