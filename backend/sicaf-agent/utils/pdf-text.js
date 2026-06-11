/**
 * Extração de texto de PDF — carregado via CJS fora do bundle Next (evita erro worker.js).
 */
let pdfParseLib = null;

function getPdfParse() {
  if (!pdfParseLib) {
    pdfParseLib = require('pdf-parse');
  }
  return pdfParseLib;
}

async function extractPdfText(fileBuffer) {
  const pdfParse = getPdfParse();
  const pdfData = await pdfParse(fileBuffer);
  return pdfData.text || '';
}

module.exports = { getPdfParse, extractPdfText };
