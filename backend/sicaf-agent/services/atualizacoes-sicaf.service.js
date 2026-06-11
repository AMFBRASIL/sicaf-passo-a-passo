/** Stub — atualizações SICAF gratuitas (usado em getCertidoesStatus). */
async function hasPaidActiveAnnualSicaf() {
  return false;
}

async function buildAtualizacoesStatus() {
  return { disponivel: false, itens: [] };
}

module.exports = { hasPaidActiveAnnualSicaf, buildAtualizacoesStatus };
