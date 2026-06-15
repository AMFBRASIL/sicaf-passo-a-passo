/**
 * Pipeline de upload PDF — Situação do Fornecedor / certidões SICAF.
 */
const pdfParse = require("pdf-parse");
const { getDb } = require("./database/connection");
const iaService = require("./services/ia.service");
const { saveCertidoesToDB } = require("./modules/sicaf-assistant/services/certidoes.service");

function buildAnalysisPrompt(fileName, truncatedText, isSituacaoFornecedor) {
  if (isSituacaoFornecedor) {
    const sfDateMatch = truncatedText.match(
      /Data de Vencimento do Cadastro[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    );
    const validadeCadastro = sfDateMatch ? sfDateMatch[1] : "";
    const hasNivelV = /V\s*[-–]\s*Qualifica/i.test(truncatedText);
    const hasNivelVI = /VI\s*[-–]\s*Qualifica/i.test(truncatedText);
    const viDateMatch = truncatedText.match(/VI\s*[-–][^\n]*[\n\r]+(\d{2}\/\d{2}\/\d{4})/i);
    const validadeVI = viDateMatch ? viDateMatch[1] : "";

    return `📄 **DOCUMENTO ANEXADO: ${fileName}**

Analise o documento "Situação do Fornecedor" abaixo.

Primeiro identifique e mostre:
- **Nome/Razão Social** do fornecedor
- **CNPJ/CPF**
- **Tipo do documento:** Situação do Fornecedor

### Análise por Nível SICAF:

COMECE A ANÁLISE COM EXATAMENTE ESTE TEXTO (copie literal, não altere nada):

**📋 Nível I — Credenciamento** ✅ Habilitado
• Credenciamento ativo (pré-requisito obrigatório do SICAF)${validadeCadastro ? `\n• Validade do cadastro: ${validadeCadastro}` : ""}

**📜 Nível II — Habilitação Jurídica** ✅ Habilitado
• Habilitação jurídica ativa (pré-requisito obrigatório do SICAF)

DEPOIS, analise os Níveis III a VI usando os dados do documento:

Para CADA certidão dos Níveis III e IV, liste: nome, validade e status.
- Use ✅ para Regular/Válido, ⚠️ para vencendo em até 30 dias, ❌ para Vencido
- ATENÇÃO: Se o nível contém "(Possui Pendência)" no documento, use ❌ Pendência
- Indique "(Automática)" ou "(Manual)" conforme o tipo de consulta
- Mostre a data de validade de CADA certidão

Para os Níveis V e VI:
${hasNivelV ? '- O Nível V aparece como cabeçalho no documento → mostre como "✅ Habilitado"' : '- O Nível V NÃO aparece no documento → mostre como "⚪ Não informado no documento"'}
${hasNivelVI ? `- O Nível VI aparece como cabeçalho no documento → mostre como "✅ Habilitado"${validadeVI ? ` com Validade: ${validadeVI}` : ""}` : '- O Nível VI NÃO aparece no documento → mostre como "⚪ Não informado no documento"'}

Ao final, informe que os dados estão sendo salvos automaticamente no sistema CadBrasil.

---
CONTEÚDO DO DOCUMENTO:
${truncatedText}`;
  }

  return `📄 **DOCUMENTO ANEXADO: ${fileName}**

Analise o documento abaixo. Primeiro identifique:
- **Nome/Razão Social** do fornecedor
- **CNPJ/CPF**
- **Tipo do documento** (CRC, Certidão individual, etc.)

Depois, organize a análise **POR BLOCO DE NÍVEL SICAF** (I a VI). Para CADA nível, use este formato:

**🏦 Nível III — Regularidade Fiscal Federal** ✅ Regular
Liste CADA certidão deste nível:
• CND Conjunta Federal (RFB+PGFN) — Validade: DD/MM/YYYY — ✅ Regular (Automática)

REGRAS IMPORTANTES:
- Use ✅ para Regular/Válido, ⚠️ para vencendo em até 30 dias, ❌ para Vencido/Pendência, ⚪ para Não informado
- ATENÇÃO: Se o nível contém "(Possui Pendência)" no documento, use ❌ Pendência
- Mostre a data de validade de CADA certidão individualmente
- Se uma certidão é obtida automaticamente pelo SICAF, indique "(Automática)"
- Se é enviada manualmente, indique "(Manual)"
- Se o nível não tem dados no documento, indique "⚪ Não informado no documento"
- Ao final, informe que os dados estão sendo salvos automaticamente no sistema CadBrasil

---
CONTEÚDO DO DOCUMENTO:
${truncatedText}`;
}

function appendDbContextToPrompt(analysisPrompt, dbResult, isSituacaoFornecedor) {
  if (!dbResult?.saved) return analysisPrompt;

  let dbContextForPrompt = `\n\n---\n[ATUALIZAÇÃO DO BANCO DE DADOS — Sistema CadBrasil]\n`;
  dbContextForPrompt += `Os dados deste documento foram salvos automaticamente no sistema CadBrasil.\n`;
  dbContextForPrompt += `• Cliente: ${dbResult.clienteNome} (${dbResult.cnpj})\n`;
  dbContextForPrompt += `• Certidões inseridas: ${dbResult.certidoesInserted}\n`;
  dbContextForPrompt += `• Certidões atualizadas: ${dbResult.certidoesUpdated}\n`;
  dbContextForPrompt += `• Total de certidões processadas: ${dbResult.certidoesCount}\n`;
  if (dbResult.niveisAfetados?.length) {
    dbContextForPrompt += `• Níveis SICAF afetados: ${dbResult.niveisAfetados.join(", ")}\n`;
  }
  if (dbResult.sicafStatus) {
    dbContextForPrompt += `• Status geral SICAF: ${dbResult.sicafStatus.status || "?"}\n`;
    dbContextForPrompt += `• Completude SICAF: ${dbResult.sicafStatus.completude || 0}%\n`;
  }
  if (isSituacaoFornecedor) {
    dbContextForPrompt += `\nATENÇÃO: Este é um documento "Situação do Fornecedor". Níveis I e II SEMPRE são ✅ Habilitado.\n`;
  }
  dbContextForPrompt += `---\n`;
  return analysisPrompt + dbContextForPrompt;
}

async function processPdfUpload(fileBuffer, fileName) {
  if (!fileBuffer || fileBuffer.length < 100) {
    return { ok: false, error: "Arquivo inválido ou vazio", status: 400 };
  }

  const ext = fileName.toLowerCase().split(".").pop();
  if (ext !== "pdf") {
    return {
      ok: false,
      error: "Para melhor análise, envie o documento em formato PDF.",
      status: 400,
    };
  }

  let extractedText = "";
  try {
    const pdfData = await pdfParse(fileBuffer);
    extractedText = pdfData.text || "";
  } catch (pdfErr) {
    return { ok: false, error: "Erro ao ler PDF: " + pdfErr.message, status: 400 };
  }

  if (!extractedText || extractedText.trim().length < 20) {
    return {
      ok: false,
      error:
        "Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.",
      status: 400,
    };
  }

  const truncatedText = extractedText.substring(0, 4000);
  const isSituacaoFornecedor = /Situa[çc][ãa]o do Fornecedor/i.test(truncatedText);
  let analysisPrompt = buildAnalysisPrompt(fileName, truncatedText, isSituacaoFornecedor);

  let dbResult = null;
  const db = getDb();
  if (db && (await iaService.isReady())) {
    try {
      const jsonData = await iaService.extractCertidoesJSON(extractedText);
      if (jsonData?.cnpj) {
        if (isSituacaoFornecedor) jsonData.tipo_documento = "Situação do Fornecedor";
        const result = await saveCertidoesToDB(jsonData);
        if (result.saved) {
          dbResult = {
            saved: true,
            clienteId: result.clienteId,
            clienteNome: result.clienteNome,
            clienteEmail: result.clienteEmail,
            cnpj: result.cnpj,
            tipoDocumento: jsonData.tipo_documento || null,
            certidoesInserted: result.certidoesInserted,
            certidoesUpdated: result.certidoesUpdated,
            certidoesCount: result.certidoesCount,
            niveisAfetados: result.niveisAfetados,
            niveisEvidencias: result.niveisEvidencias || [],
            sicafStatus: result.sicafStatus,
            emailNotificacao: result.emailNotificacao || null,
          };
        } else {
          dbResult = { saved: false, reason: result.reason };
        }
      } else {
        dbResult = { saved: false, reason: "Não foi possível extrair CNPJ do documento" };
      }
    } catch (e) {
      dbResult = { saved: false, reason: e.message };
    }
  }

  analysisPrompt = appendDbContextToPrompt(analysisPrompt, dbResult, isSituacaoFornecedor);

  return {
    ok: true,
    fileName,
    textLength: extractedText.length,
    prompt: analysisPrompt,
    dbResult,
  };
}

module.exports = { processPdfUpload };
