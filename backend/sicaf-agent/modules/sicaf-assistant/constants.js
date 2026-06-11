/**
 * Constantes do módulo SICAF Assistant.
 */

// Mapeamento de nomes de certidões (texto livre) → código na tabela tipo_certidoes
const CERTIDAO_TIPO_MAP = {
  // Nível III — Regularidade Fiscal Federal
  'cnd conjunta federal': 'cnd_federal',
  'cnd federal': 'cnd_federal',
  'receita federal': 'cnd_federal',
  'pgfn': 'cnd_federal',
  'crf fgts': 'crf_fgts',
  'fgts': 'crf_fgts',
  'caixa econômica': 'crf_fgts',
  'cndt': 'cndt_trabalhista',
  'débitos trabalhistas': 'cndt_trabalhista',
  'trabalhista': 'cndt_trabalhista',
  'tst': 'cndt_trabalhista',
  // Nível IV — Regularidade Fiscal Estadual/Municipal
  'estadual': 'cnd_estadual',
  'distrital': 'cnd_estadual',
  'fiscal estadual': 'cnd_estadual',
  'icms': 'cnd_estadual',
  'municipal': 'cnd_municipal',
  'fiscal municipal': 'cnd_municipal',
  'iss': 'cnd_municipal',
  // SICAF
  'crc': 'sicaf_crc',
  'certificado de registro cadastral': 'sicaf_crc',
  'situação do fornecedor': 'sicaf_situacao',
  'situacao do fornecedor': 'sicaf_situacao',
  // Nível I — Credenciamento
  'ato constitutivo': 'contrato_social',
  'contrato social': 'contrato_social',
  'documento de identidade': 'documento_identidade',
  // Nível II — Habilitação Jurídica
  'estatuto': 'estatuto_consolidado',
  'consolidado': 'estatuto_consolidado',
  'junta comercial': 'certidao_junta_comercial',
  'certidão simplificada': 'certidao_junta_comercial',
  // Nível V — Qualificação Técnica
  'capacidade técnica': 'atestado_tecnico',
  'atestado': 'atestado_tecnico',
  // Nível VI — Qualificação Econômico-Financeira
  'falência': 'certidao_negativa_falencia',
  'recuperação judicial': 'certidao_negativa_falencia',
  'balanço': 'balanco_patrimonial',
  'dre': 'dre',
  'demonstração de resultado': 'dre',
};

// URLs dos níveis SICAF
const NIVEL_URLS = {
  '1': '/sicaf-web/private/credenciamento/manterNivel1.jsf',
  '2': '/sicaf-web/private/credenciamento/manterNivel2.jsf',
  '3': '/sicaf-web/private/credenciamento/manterNivel3.jsf',
  '4': '/sicaf-web/private/credenciamento/manterNivel4.jsf',
  '5': '/sicaf-web/private/credenciamento/manterNivel5.jsf',
  '6': '/sicaf-web/private/credenciamento/manterNivel6.jsf',
};

// Mapeamento de steps do login → progresso visual
const STEP_MAP = {
  sicaf_home: { idx: 1, prog: 16, icon: '🏛️', label: 'Portal CADBRASIL Auxilio ao SICAF' },
  gov_login: { idx: 2, prog: 32, icon: '🔐', label: 'Gov.br — Login' },
  captcha: { idx: 3, prog: 48, icon: '🧩', label: 'CAPTCHA' },
  cert_select: { idx: 4, prog: 60, icon: '🪪', label: 'Certificado' },
  processing: { idx: 5, prog: 72, icon: '⏳', label: 'Autenticando...' },
  logged_in: { idx: 5, prog: 85, icon: '✅', label: 'Login OK!' },
  dashboard: { idx: 6, prog: 100, icon: '📊', label: 'Painel SICAF' },
};

module.exports = {
  CERTIDAO_TIPO_MAP,
  NIVEL_URLS,
  STEP_MAP,
};
