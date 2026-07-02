/**
 * Regras compartilhadas entre /admin/clientes (card Pagamento SICAF) e /admin/cobranca.
 */
const {
  calcDaysRemaining,
  resolveSicafDisplayStatus,
  resolveFinancialReleased,
} = require('./sicaf-status');

function formatDateBr(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return String(d);
  }
}

function diasAteValidadeSicaf(sicafValidade) {
  return calcDaysRemaining(sicafValidade);
}

function isCredencialVigente(sicafValidade, sicafStatus, hasSicaf = true) {
  if (!hasSicaf) return false;
  const display = resolveSicafDisplayStatus(sicafStatus, sicafValidade, hasSicaf);
  if (display === 'Vencido') return false;
  const dias = diasAteValidadeSicaf(sicafValidade);
  return dias !== null && dias > 0;
}

function isClienteSicafFinanceiroLiberado({
  hasSicaf,
  sicafStatus,
  sicafValidade,
  taxaReleased,
}) {
  return resolveFinancialReleased({
    hasSicaf,
    sicafStatus,
    dataValidade: sicafValidade,
    taxaReleased,
  });
}

/** Mesma regra do card "Pagamento SICAF" no modal de detalhe (Resumo). */
function derivePagamentoSicafResumo({
  sicafStatus,
  sicafValidade,
  temTaxaAberta,
  temPagamentoPendente,
  hasSicaf = true,
  taxaReleased = false,
}) {
  const displayStatus = resolveSicafDisplayStatus(sicafStatus, sicafValidade, hasSicaf);
  const financialReleased = isClienteSicafFinanceiroLiberado({
    hasSicaf,
    sicafStatus,
    sicafValidade,
    taxaReleased,
  });
  const temAberto = temTaxaAberta || temPagamentoPendente;
  const vigente = isCredencialVigente(sicafValidade, sicafStatus, hasSicaf);
  const dias = diasAteValidadeSicaf(sicafValidade);
  const validadeFmt = formatDateBr(sicafValidade);

  if (vigente && validadeFmt) {
    const vencendoEmBreve = dias !== null && dias <= 30;
    if (temAberto) {
      return {
        pagou: true,
        pagamentoSicafStatus: vencendoEmBreve ? 'Vencendo' : 'Vigente',
        pagamentoSicafDetalhe: `Válido até ${validadeFmt} · renovação em aberto`,
      };
    }
    return {
      pagou: true,
      pagamentoSicafStatus: vencendoEmBreve ? 'Vencendo' : 'Em dia',
      pagamentoSicafDetalhe: vencendoEmBreve
        ? `Válido até ${validadeFmt}`
        : 'Taxa SICAF quitada',
    };
  }

  if (dias !== null && dias <= 0) {
    return {
      pagou: financialReleased,
      pagamentoSicafStatus: 'Vencido',
      pagamentoSicafDetalhe: validadeFmt
        ? `Validade expirada em ${validadeFmt}`
        : 'Credenciamento expirado',
    };
  }

  if (temAberto) {
    return {
      pagou: false,
      pagamentoSicafStatus: 'Pendente',
      pagamentoSicafDetalhe: 'Taxa pendente · sem vigência ativa no cadastro',
    };
  }

  if (displayStatus === 'Vencido') {
    return {
      pagou: financialReleased,
      pagamentoSicafStatus: 'Vencido',
      pagamentoSicafDetalhe: 'SICAF vencido',
    };
  }

  if (financialReleased) {
    return {
      pagou: true,
      pagamentoSicafStatus: 'Pago',
      pagamentoSicafDetalhe: 'Taxa SICAF quitada',
    };
  }

  return {
    pagou: false,
    pagamentoSicafStatus: 'Sem vigência',
    pagamentoSicafDetalhe: 'Nenhum credenciamento SICAF vigente',
  };
}

/**
 * Elegível para /admin/cobranca: só quem NÃO pagou ou está vencido.
 * Exclui vigente/em dia (mesmo com renovação em aberto).
 */
function isClienteElegivelCobrancaSicaf(resumo) {
  if (!resumo) return false;
  if (resumo.pagamentoSicafStatus === 'Vencido') return true;
  if (resumo.pagou === false) return true;
  return false;
}

/** Conta cancelada/inativa ou SICAF cancelado — não recebe cobrança (disparo em massa, régua, e-mail). */
function isClienteBloqueadoCobranca({ clienteStatus, sicafStatus } = {}) {
  const cs = String(clienteStatus || '').trim().toLowerCase();
  if (['inativo', 'cancelado', 'cancelada'].includes(cs)) return true;
  const ss = String(sicafStatus || '').trim().toLowerCase();
  if (['cancelado', 'cancelada'].includes(ss)) return true;
  return false;
}

const TAXA_SICAF_PAGA_WHERE =
  "(LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";

module.exports = {
  formatDateBr,
  diasAteValidadeSicaf,
  isCredencialVigente,
  isClienteSicafFinanceiroLiberado,
  derivePagamentoSicafResumo,
  isClienteElegivelCobrancaSicaf,
  isClienteBloqueadoCobranca,
  TAXA_SICAF_PAGA_WHERE,
};
