/**
 * Servidor HTTP do Assistente SICAF.
 * Rotas: painel HTML, chat IA (SSE), upload de PDF, eventos SSE, status.
 */
const http = require('http');
const pdfParse = require('pdf-parse');
const config = require('../../../config');
const iaService = require('../../../services/ia.service');
const { saveCertidoesToDB } = require('../services/certidoes.service');
const { executeAction } = require('../services/sicaf-navigator');
const { buildAssistantHTML } = require('./assistant-view');

let sseClients = [];
let pageState = null;
let getSicafPage = null;

/**
 * Broadcast SSE para todos os clientes conectados.
 */
function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((c) => {
    try { c.write(payload); } catch (_) {}
  });
}

function sendStep(step, extra) {
  broadcastSSE({ type: 'step', step, ...extra });
}

function sendClientData(data) {
  broadcastSSE({ type: 'client-data', data });
}

/**
 * Inicia o servidor HTTP do assistente.
 * @param {Object} options
 * @param {Object} options.pageState - Referência ao estado da página
 * @param {Function} options.getSicafPage - Função que retorna a página SICAF atual
 */
function startAssistantServer(options) {
  pageState = options.pageState;
  getSicafPage = options.getSicafPage;

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // ── Painel HTML ──
    if (req.method === 'GET' && (req.url === '/' || req.url === '/assistant')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildAssistantHTML());
      return;
    }

    // ── Status ──
    if (req.method === 'GET' && req.url === '/status') {
      const status = await iaService.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        openai: status.ready,
        configured: status.configured,
        model: status.model,
        apiKeySource: status.apiKeySource,
        step: pageState.step,
      }));
      return;
    }

    // ── SSE Events ──
    if (req.method === 'GET' && req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'step', step: pageState.step })}\n\n`);
      if (pageState.clientData) {
        res.write(`data: ${JSON.stringify({ type: 'client-data', data: pageState.clientData })}\n\n`);
      }
      sseClients.push(res);
      req.on('close', () => { sseClients = sseClients.filter((c) => c !== res); });
      return;
    }

    // ── Chat IA (SSE Streaming) ──
    if (req.method === 'POST' && req.url === '/chat') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        try {
          const { message } = JSON.parse(body);
          await iaService.streamChatResponse(message, pageState, res, async (actions) => {
            const page = getSicafPage();
            if (page) {
              for (const action of actions) {
                try { await executeAction(page, action); } catch (_) {}
              }
            }
          });
        } catch (e) {
          console.error('[Chat Error]', e.message);
          if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          }
          res.write('data: ' + JSON.stringify({ done: true, fullText: '⚠ Erro: ' + e.message }) + '\n\n');
          res.end();
        }
      });
      return;
    }

    // ── Executar ação SICAF (navegar CRC, Situação, etc.) ──
    if (req.method === 'POST' && req.url === '/action') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        try {
          const { action } = JSON.parse(body);
          const page = getSicafPage();
          if (!page) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Página SICAF não disponível. Verifique se o navegador está aberto.' }));
            return;
          }

          const allowedActions = ['abrir_crc', 'abrir_situacao_fornecedor'];
          if (!allowedActions.includes(action)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Ação não permitida: ' + action }));
            return;
          }

          console.log(`  [Action] Executando: ${action}`);
          await executeAction(page, action);
          console.log(`  [Action] Concluído: ${action}`);

          broadcastSSE({ type: 'action-done', action });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, action }));
        } catch (e) {
          console.error(`  [Action] Erro: ${e.message}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao executar ação: ' + e.message }));
        }
      });
      return;
    }

    // ── Upload de PDF ──
    if (req.method === 'POST' && req.url === '/upload') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try {
          const rawBody = Buffer.concat(chunks);
          const contentType = req.headers['content-type'] || '';
          let fileBuffer = null;
          let fileName = 'documento';

          if (contentType.includes('multipart/form-data')) {
            const boundaryMatch = contentType.match(/boundary=(.+)/);
            if (!boundaryMatch) throw new Error('Boundary não encontrado');
            const boundary = boundaryMatch[1];
            const parts = rawBody.toString('binary').split('--' + boundary);

            for (const part of parts) {
              if (part.includes('filename=')) {
                const fnMatch = part.match(/filename="(.+?)"/);
                if (fnMatch) fileName = fnMatch[1];
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd >= 0) {
                  const bodyStr = part.substring(headerEnd + 4);
                  const cleanBody = bodyStr.replace(/\r\n$/, '');
                  fileBuffer = Buffer.from(cleanBody, 'binary');
                }
                break;
              }
            }
          }

          if (!fileBuffer || fileBuffer.length < 100) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Arquivo inválido ou vazio' }));
            return;
          }

          let extractedText = '';
          const ext = fileName.toLowerCase().split('.').pop();

          if (ext === 'pdf') {
            try {
              const pdfData = await pdfParse(fileBuffer);
              extractedText = pdfData.text || '';
            } catch (pdfErr) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Erro ao ler PDF: ' + pdfErr.message }));
              return;
            }
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Para melhor análise, envie o documento em formato PDF.' }));
            return;
          }

          if (!extractedText || extractedText.trim().length < 20) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.' }));
            return;
          }

          const truncatedText = extractedText.substring(0, 4000);
          const isSituacaoFornecedor = /Situa[çc][ãa]o do Fornecedor/i.test(truncatedText);

          let analysisPrompt;

          if (isSituacaoFornecedor) {
            const dateMatch = truncatedText.match(/Data de Vencimento do Cadastro[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
            const validadeCadastro = dateMatch ? dateMatch[1] : '';
            const hasNivelV = /V\s*[-–]\s*Qualifica/i.test(truncatedText);
            const hasNivelVI = /VI\s*[-–]\s*Qualifica/i.test(truncatedText);
            const viDateMatch = truncatedText.match(/VI\s*[-–][^\n]*[\n\r]+(\d{2}\/\d{2}\/\d{4})/i);
            const validadeVI = viDateMatch ? viDateMatch[1] : '';

            analysisPrompt = `📄 **DOCUMENTO ANEXADO: ${fileName}**

Analise o documento "Situação do Fornecedor" abaixo.

Primeiro identifique e mostre:
- **Nome/Razão Social** do fornecedor
- **CNPJ/CPF**
- **Tipo do documento:** Situação do Fornecedor

### Análise por Nível SICAF:

COMECE A ANÁLISE COM EXATAMENTE ESTE TEXTO (copie literal, não altere):

**📋 Nível I — Credenciamento** ✅ Habilitado
• Credenciamento ativo (pré-requisito obrigatório do SICAF)${validadeCadastro ? `\n• Validade do cadastro: ${validadeCadastro}` : ''}

**📜 Nível II — Habilitação Jurídica** ✅ Habilitado
• Habilitação jurídica ativa (pré-requisito obrigatório do SICAF)

DEPOIS, analise os Níveis III a VI usando os dados do documento:

Para CADA certidão dos Níveis III e IV, liste: nome, validade e status.
- Use ✅ para Regular/Válido, ⚠️ para vencendo em até 30 dias, ❌ para Vencido
- Indique "(Automática)" ou "(Manual)" conforme o tipo de consulta
- Mostre a data de validade de CADA certidão

Para os Níveis V e VI:
${hasNivelV ? '- O Nível V aparece como cabeçalho no documento → mostre como "✅ Habilitado"' : '- O Nível V NÃO aparece no documento → mostre como "⚪ Não informado no documento"'}
${hasNivelVI ? `- O Nível VI aparece como cabeçalho no documento → mostre como "✅ Habilitado"${validadeVI ? ` com Validade: ${validadeVI}` : ''}` : '- O Nível VI NÃO aparece no documento → mostre como "⚪ Não informado no documento"'}

Ao final, informe que os dados estão sendo salvos automaticamente no sistema CadBrasil.

---
CONTEÚDO DO DOCUMENTO:
${truncatedText}`;
          } else {
            analysisPrompt = `📄 **DOCUMENTO ANEXADO: ${fileName}**

Analise o documento abaixo. Primeiro identifique:
- **Nome/Razão Social** do fornecedor
- **CNPJ/CPF**
- **Tipo do documento** (CRC, Certidão individual, etc.)

Depois, organize a análise **POR BLOCO DE NÍVEL SICAF** (I a VI). Para CADA nível, use este formato:

**🏦 Nível III — Regularidade Fiscal Federal** ✅ Regular
Liste CADA certidão deste nível:
• CND Conjunta Federal (RFB+PGFN) — Validade: DD/MM/YYYY — ✅ Regular (Automática)

REGRAS IMPORTANTES:
- Use ✅ para Regular/Válido, ⚠️ para vencendo em até 30 dias, ❌ para Vencido, ⚪ para Não informado
- Mostre a data de validade de CADA certidão individualmente
- Se uma certidão é obtida automaticamente pelo SICAF, indique "(Automática)"
- Se é enviada manualmente, indique "(Manual)"
- Se o nível não aparece no documento, indique "⚪ Não informado no documento"
- Ao final, informe que os dados estão sendo salvos automaticamente no sistema CadBrasil

---
CONTEÚDO DO DOCUMENTO:
${truncatedText}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            fileName,
            textLength: extractedText.length,
            prompt: analysisPrompt,
          }));

          // ═══ BACKGROUND: Extrair JSON, salvar certidões e atualizar SICAF ═══
          const { getDb } = require('../../../database/connection');
          if (getDb() && (await iaService.isReady())) {
            (async () => {
              try {
                console.log('  [DB] Extraindo dados estruturados do PDF...');
                broadcastSSE({ type: 'processing', message: 'Analisando documento e extraindo dados...' });

                const jsonData = await iaService.extractCertidoesJSON(extractedText);
                if (jsonData && jsonData.cnpj) {
                  if (isSituacaoFornecedor) jsonData.tipo_documento = 'Situação do Fornecedor';
                  console.log(`  [DB] CNPJ: ${jsonData.cnpj} — ${(jsonData.certidoes || []).length} certidões`);
                  broadcastSSE({ type: 'processing', message: `CNPJ identificado: ${jsonData.cnpj}. Buscando cliente no sistema...` });

                  const result = await saveCertidoesToDB(jsonData);
                  if (result.saved) {
                    broadcastSSE({
                      type: 'db-saved',
                      data: {
                        cnpj: result.cnpj,
                        clienteId: result.clienteId,
                        clienteNome: result.clienteNome,
                        certidoesCount: result.certidoesCount,
                        certidoesInserted: result.certidoesInserted,
                        certidoesUpdated: result.certidoesUpdated,
                        niveisAfetados: result.niveisAfetados,
                        sicafStatus: result.sicafStatus,
                      },
                    });
                    console.log(`  [DB] ✔ Salvo: ${result.certidoesCount} certidões para ${result.clienteNome} (#${result.clienteId})`);
                    if (result.sicafStatus && result.sicafStatus.niveis) {
                      const niveisKeys = Object.keys(result.sicafStatus.niveis);
                      console.log(`  [DB] ✔ Níveis atualizados: ${niveisKeys.join(', ') || 'nenhum'}`);
                    }
                    if (result.sicafStatus && result.sicafStatus.status) {
                      console.log(`  [DB] ✔ SICAF: ${result.sicafStatus.status} | ${result.sicafStatus.completude || 0}% completo`);
                    }
                  } else {
                    broadcastSSE({
                      type: 'db-error',
                      data: { message: result.reason },
                    });
                    console.log(`  [DB] ✖ Não salvou: ${result.reason}`);
                  }
                } else {
                  broadcastSSE({
                    type: 'db-error',
                    data: { message: 'Não foi possível extrair CNPJ do documento' },
                  });
                  console.log('  [DB] ⚠ Não foi possível extrair JSON estruturado');
                }
              } catch (e) {
                broadcastSSE({
                  type: 'db-error',
                  data: { message: 'Erro ao processar: ' + e.message.substring(0, 60) },
                });
                console.log(`  [DB] ✖ Erro background: ${e.message.substring(0, 60)}`);
              }
            })();
          }
        } catch (e) {
          console.error('[Upload Error]', e.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro no processamento: ' + e.message }));
        }
      });
      return;
    }

    // ── Close ──
    if (req.url === '/close') {
      res.writeHead(200); res.end('ok');
      process.emit('SIGINT');
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(config.sicaf.assistantPort, '127.0.0.1');
  return server;
}

module.exports = {
  startAssistantServer,
  broadcastSSE,
  sendStep,
  sendClientData,
};
