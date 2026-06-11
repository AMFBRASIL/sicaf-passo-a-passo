/**
 * Painel admin — documentos, certidões e certificado digital do cliente.
 */
const { getDb } = require('../database/connection');
const documentsService = require('./documents.service');
const certidoesService = require('./certidoes.service');
const certificadoDigitalService = require('./certificado-digital.service');

async function getPainelDocumentos(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const [checklist, arquivos, certRes] = await Promise.all([
    certidoesService.getChecklistDocumentosAdmin(clienteId),
    documentsService.listDocuments({ clienteId, limit: 500 }),
    certificadoDigitalService.getCertificadoDigital(clienteId, { includeSenha: true }),
  ]);

  if (!checklist.ok) return checklist;

  const certidoesRaw = await db('certidoes as cert')
    .leftJoin('tipo_certidoes as tc', 'cert.tipo_certidao_id', 'tc.id')
    .where('cert.cliente_id', clienteId)
    .select(
      'cert.id',
      'cert.numero',
      'cert.nivel_sicaf',
      'cert.data_validade',
      'cert.status',
      'cert.arquivo_url',
      'cert.arquivo_nome',
      'cert.arquivo_tamanho',
      'cert.created_at',
      'tc.nome as tipo_nome',
      'tc.codigo as tipo_codigo',
    )
    .orderBy('cert.created_at', 'desc');

  return {
    ok: true,
    sicafStatus: checklist.sicafStatus,
    docsPorNivel: checklist.docsPorNivel,
    certidoes: certidoesRaw.map((c) => ({
      id: c.id,
      nome: c.tipo_nome || c.arquivo_nome || 'Certidão',
      codigo: c.tipo_codigo,
      nivelSicaf: c.nivel_sicaf,
      numero: c.numero,
      validade: c.data_validade,
      status: c.status,
      arquivoUrl: c.arquivo_url,
      arquivoNome: c.arquivo_nome,
      tamanho: c.arquivo_tamanho,
      createdAt: c.created_at,
    })),
    arquivos: arquivos.ok ? arquivos.documents || [] : [],
    certificadoDigital: certRes.ok ? certRes.certificado : null,
  };
}

module.exports = {
  getPainelDocumentos,
};
