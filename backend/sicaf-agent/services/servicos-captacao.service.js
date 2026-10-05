/**
 * Admin → Serviços: central de captação por serviço CADBRASIL.
 *
 * Cada serviço tem públicos-alvo (segmentos SQL sobre `clientes`), campanhas de e-mail
 * processadas em fila (servicos-captacao-cron), lista de contatos para WhatsApp/ligação,
 * exportação (CSV / Google Customer Match) e métricas de conversão por campanha.
 */
const crypto = require('crypto');
const { getDb } = require('../database/connection');

const LOG_PREFIX = '[Captacao]';
const T_CAMPANHAS = 'servicos_captacao_campanhas';
const T_ENVIOS = 'servicos_captacao_envios';
const T_CONTATOS = 'servicos_captacao_contatos';
const T_OPTOUT = 'email_optout';
const T_ROTINAS = 'servicos_captacao_rotinas';
const T_FORN = 'captacao_fornecedores';

const WHATSAPP_NUMERO = (process.env.CADBRASIL_WHATSAPP_NUMERO || '551121220202').replace(/\D/g, '');
const LOTE_PADRAO = Math.max(1, parseInt(process.env.CAPTACAO_LOTE || '30', 10) || 30);
const INTERVALO_MS = Math.max(5, parseInt(process.env.CAPTACAO_INTERVALO_SEG || '20', 10) || 20) * 1000;
const TIMEOUT_ENVIO_MS = 30000;

/**
 * O banco é o mesmo em dev e produção: por padrão o `next dev` local não dispara,
 * para uma máquina local (IP fora da allowlist do Mailgun) não consumir a fila.
 * CAPTACAO_FILA_ENABLED=true/false força o comportamento. CRON_CAPTACAO_ENABLED só controla o cron periódico.
 * NODE_ENV não serve: o backend/.env (carregado com override) e o PM2 podem defini-lo como development em produção.
 * NEXT_PRIVATE_WORKER=1 só existe no processo filho do `next dev`.
 */
function filaHabilitada() {
  const flag = String(process.env.CAPTACAO_FILA_ENABLED || '').toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NEXT_PRIVATE_WORKER !== '1';
}
const JANELA_CONVERSAO_DIAS = 60;

/* ------------------------------------------------------------------ */
/* SQL base                                                            */
/* ------------------------------------------------------------------ */

const EMAIL_SQL = "LOWER(TRIM(COALESCE(NULLIF(c.responsavel_email, ''), NULLIF(c.email, ''))))";
const TEL_SQL =
  "COALESCE(NULLIF(TRIM(c.responsavel_telefone), ''), NULLIF(TRIM(c.celular), ''), NULLIF(TRIM(c.telefone), ''), '')";
/** Normaliza UFs gravadas truncadas ("Sã" = São Paulo, "Mi" = Minas, "Di" = Distrito Federal). */
const UF_SQL =
  "(CASE UPPER(TRIM(COALESCE(c.estado, ''))) WHEN 'SÃ' THEN 'SP' WHEN 'MI' THEN 'MG' WHEN 'DI' THEN 'DF' ELSE UPPER(TRIM(COALESCE(c.estado, ''))) END)";

const TAXA_PAGA_SQL =
  "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pago','paga','aprovado','aprovada'))";
const TAXA_ABERTA_SQL =
  "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pendente','aguardando','gerado','vencido','atrasado','aberto'))";
const PAG_PAGO_SQL =
  "(LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','paid','confirmado','confirmada','liberado','liberada'))";
const MANUT_ATIVA_SQL =
  "(LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo','ativa','a vencer','vencendo') AND (m.data_fim IS NULL OR m.data_fim >= CURDATE()))";

const SQL = {
  sicafPago: `(EXISTS (SELECT 1 FROM taxas_sicaf t WHERE t.cliente_id = c.id AND ${TAXA_PAGA_SQL})
    OR EXISTS (SELECT 1 FROM pagamentos p WHERE p.cliente_id = c.id AND p.origem = 'sicaf' AND ${PAG_PAGO_SQL}))`,
  sicafCobranca: `(EXISTS (SELECT 1 FROM taxas_sicaf t WHERE t.cliente_id = c.id AND ${TAXA_ABERTA_SQL})
    OR EXISTS (SELECT 1 FROM pagamentos p WHERE p.cliente_id = c.id AND p.origem = 'sicaf'))`,
  manutAtiva: `EXISTS (SELECT 1 FROM manutencoes m WHERE m.cliente_id = c.id AND ${MANUT_ATIVA_SQL})`,
};

function pagouOrigem(origem) {
  return `EXISTS (SELECT 1 FROM pagamentos p WHERE p.cliente_id = c.id AND p.origem = '${origem}' AND ${PAG_PAGO_SQL})`;
}

function cobrancaSemPagar(origem) {
  return `(EXISTS (SELECT 1 FROM pagamentos p WHERE p.cliente_id = c.id AND p.origem = '${origem}') AND NOT ${pagouOrigem(origem)})`;
}

function assessoria(tabela, where = '1=1') {
  return `EXISTS (SELECT 1 FROM ${tabela} x WHERE x.cliente_id = c.id AND ${where})`;
}

function modulo(mod, where = '1=1') {
  return `EXISTS (SELECT 1 FROM modulos_assinaturas ma WHERE ma.cliente_id = c.id AND ma.modulo = '${mod}' AND ${where})`;
}

function pacoteIa(where = '1=1') {
  return `EXISTS (SELECT 1 FROM compras_pacotes_ia cp WHERE cp.usuario_id = c.usuario_id AND ${where})`;
}

/* ------------------------------------------------------------------ */
/* Modelos de e-mail                                                   */
/* ------------------------------------------------------------------ */

const EMAIL_FRIO = {
  assunto: '{{nome}}, conheça o {{servico}} da CADBRASIL',
  corpo: `Olá, {{nome}}!

{{resumo}}

Com a assessoria CADBRASIL, a {{empresa}} conta com:
{{beneficios}}

Investimento: {{preco}}.

Clique no botão abaixo para conhecer e contratar direto pelo portal — leva poucos minutos.`,
  cta: 'Quero conhecer',
};

const EMAIL_RELACIONAMENTO = {
  assunto: '{{nome}}, a {{empresa}} pode vender mais com o {{servico}}',
  corpo: `Olá, {{nome}}!

Obrigado por confiar na CADBRASIL. Queremos lembrar tudo o que o {{servico}} oferece para a {{empresa}}:
{{beneficios}}

Se tiver qualquer dúvida, nossa equipe está a um clique de distância no portal ou pelo WhatsApp.`,
  cta: 'Acessar o portal',
};

/* ------------------------------------------------------------------ */
/* Catálogo de serviços                                                */
/* ------------------------------------------------------------------ */

const SERVICOS = {
  sicaf: {
    id: 'sicaf',
    nome: 'Cadastro SICAF',
    sigla: 'SICAF',
    abrangencia: 'Governo Federal',
    resumo:
      'O SICAF é o cadastro obrigatório para vender ao Governo Federal pelo Compras.gov.br — sem ele, a empresa não participa das licitações federais.',
    cor: '#047857',
    rota: '/sicaf',
    chavePreco: 'valor_cadastro_sicaf',
    precoPadrao: 985,
    recorrencia: 'taxa única',
    origens: ['sicaf'],
    ativoLabel: 'Clientes pagantes',
    andamentoLabel: 'Cobrança em aberto',
    ativo: SQL.sicafPago,
    andamento: `(${SQL.sicafCobranca} AND NOT ${SQL.sicafPago})`,
    beneficios: [
      'Cadastro completo nos níveis do SICAF feito por especialistas',
      'Conferência de documentos e certidões antes do envio',
      'Acompanhamento até a habilitação no Compras.gov.br',
      'Suporte da equipe CADBRASIL durante todo o processo',
    ],
    pitch: {
      gancho:
        'Toda empresa que quer vender para o Governo Federal precisa do SICAF. A CADBRASIL resolve o cadastro sem o cliente perder tempo com o sistema do governo.',
      argumentos: [
        'O Governo Federal compra bilhões por ano — e só participa quem está no SICAF.',
        'Erros no cadastro travam a habilitação; nossa equipe confere tudo antes de enviar.',
        'O cliente acompanha cada etapa pelo portal, com avisos por e-mail.',
      ],
      objecoes: [
        {
          pergunta: 'Posso fazer sozinho?',
          resposta:
            'Pode, mas o sistema é burocrático e qualquer documento errado gera pendência. Com a CADBRASIL o cadastro sai certo na primeira vez.',
        },
        {
          pergunta: 'Ainda não tenho licitação em vista.',
          resposta:
            'O cadastro leva dias para ser validado. Quem já está habilitado aproveita a oportunidade quando ela aparece — sem correr contra o prazo.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. Vi que a {{empresa}} tem cadastro no nosso portal, mas o SICAF ainda não foi concluído. Posso te ajudar a finalizar hoje para vocês já poderem vender ao Governo Federal?',
    segmentos: [
      {
        id: 'novos_sem_pagamento',
        nome: 'Cadastrou nos últimos 30 dias e não pagou',
        descricao: 'Interesse recente — melhor momento para converter.',
        tipo: 'quente',
        where: `c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND NOT ${SQL.sicafPago}`,
        email: {
          assunto: '{{nome}}, falta pouco para a {{empresa}} vender ao Governo Federal',
          corpo: `Olá, {{nome}}!

Vimos que a {{empresa}} iniciou o cadastro no portal CADBRASIL, mas o SICAF ainda não foi concluído.

Sem o SICAF, sua empresa fica de fora de todas as licitações do Governo Federal. Nossa equipe cuida de tudo:
{{beneficios}}

Conclua agora e deixe o cadastro com a gente.`,
          cta: 'Concluir meu SICAF',
        },
      },
      {
        id: 'cobranca_aberta',
        nome: 'Gerou boleto/PIX e não pagou',
        descricao: 'Chegou até o pagamento e parou — lembrete direto.',
        tipo: 'quente',
        where: `${SQL.sicafCobranca} AND NOT ${SQL.sicafPago}`,
        email: {
          assunto: '{{nome}}, seu cadastro SICAF está esperando por você',
          corpo: `Olá, {{nome}}!

A {{empresa}} chegou até a etapa de pagamento do cadastro SICAF, mas ele ainda não foi confirmado.

Assim que o pagamento for identificado, nossa equipe inicia o cadastro imediatamente. Se o boleto venceu, é só gerar um novo pelo portal — leva menos de um minuto.

Ficou alguma dúvida? Responda este e-mail ou fale com a gente no WhatsApp.`,
          cta: 'Finalizar pagamento',
        },
      },
      {
        id: 'vencendo',
        nome: 'SICAF vencendo (60 dias) ou vencido',
        descricao: 'Validade entre 6 meses atrás e os próximos 60 dias.',
        tipo: 'renovacao',
        where:
          'EXISTS (SELECT 1 FROM sicaf_cadastros s WHERE s.cliente_id = c.id AND s.data_validade BETWEEN DATE_SUB(CURDATE(), INTERVAL 180 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY))',
        email: {
          assunto: '{{nome}}, o SICAF da {{empresa}} precisa de atenção',
          corpo: `Olá, {{nome}}!

O cadastro SICAF da {{empresa}} está vencido ou vence nos próximos dias. Com o SICAF irregular, a empresa pode ser inabilitada nas licitações federais.

A CADBRASIL atualiza o cadastro e as certidões para você continuar participando sem sustos.`,
          cta: 'Regularizar meu SICAF',
        },
      },
      {
        id: 'pagantes',
        nome: 'Clientes que já pagaram o SICAF',
        descricao: 'Base de relacionamento e indicação.',
        tipo: 'relacionamento',
        where: SQL.sicafPago,
      },
      {
        id: 'base_sem_pagamento',
        nome: 'Toda a base que nunca pagou o SICAF',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${SQL.sicafPago}`,
      },
    ],
  },

  manutencao: {
    id: 'manutencao',
    nome: 'Manutenção SICAF',
    sigla: 'Manutenção',
    abrangencia: 'Plano mensal',
    resumo:
      'A Manutenção CADBRASIL mantém o SICAF e as certidões sempre válidos, com monitoramento de vencimentos e atualização feita pela nossa equipe.',
    cor: '#0f766e',
    rota: '/pagamentos',
    chavePreco: 'valor_manutencao_mensal',
    precoPadrao: 155,
    recorrencia: 'por mês',
    origens: ['manutencao'],
    ativoLabel: 'Planos ativos',
    andamentoLabel: 'Vencendo em 30 dias',
    ativo: SQL.manutAtiva,
    andamento: `EXISTS (SELECT 1 FROM manutencoes m WHERE m.cliente_id = c.id AND ${MANUT_ATIVA_SQL} AND m.data_fim BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
    beneficios: [
      'Monitoramento diário da validade do SICAF e das certidões',
      'Atualização de documentos feita pela equipe CADBRASIL',
      'Alertas antes de cada vencimento — nada de inabilitação surpresa',
      'Suporte prioritário para dúvidas e pendências',
    ],
    pitch: {
      gancho:
        'Quem já pagou o SICAF precisa mantê-lo válido. A Manutenção evita que a empresa seja inabilitada por uma certidão vencida.',
      argumentos: [
        'Uma única certidão vencida pode desclassificar a empresa numa licitação ganha.',
        'A equipe CADBRASIL acompanha prazos e atualiza tudo sem o cliente precisar lembrar.',
        'Custa menos do que perder um único contrato.',
      ],
      objecoes: [
        {
          pergunta: 'Eu mesmo acompanho as certidões.',
          resposta:
            'São vários órgãos com prazos diferentes. A manutenção tira esse trabalho da rotina e garante que nada passe.',
        },
        {
          pergunta: 'Está caro.',
          resposta:
            'O valor mensal é menor que uma hora de trabalho perdida com burocracia — e protege contratos que valem muito mais.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. O SICAF da {{empresa}} já está com a gente — quer que nossa equipe cuide também das certidões e da validade todo mês? Assim vocês nunca são inabilitados por documento vencido.',
    segmentos: [
      {
        id: 'sicaf_sem_manutencao',
        nome: 'Pagou o SICAF e não tem manutenção',
        descricao: 'Já confia na CADBRASIL — venda natural.',
        tipo: 'quente',
        where: `${SQL.sicafPago} AND NOT ${SQL.manutAtiva}`,
        email: {
          assunto: '{{nome}}, proteja o SICAF da {{empresa}} contra vencimentos',
          corpo: `Olá, {{nome}}!

O SICAF da {{empresa}} foi feito com a CADBRASIL. Agora, o próximo passo é mantê-lo sempre válido — uma certidão vencida pode inabilitar a empresa mesmo depois de ganhar a licitação.

Com a Manutenção CADBRASIL você tem:
{{beneficios}}

Tudo isso por {{preco}}.`,
          cta: 'Ativar manutenção',
        },
      },
      {
        id: 'cobranca_aberta',
        nome: 'Gerou cobrança da manutenção e não pagou',
        descricao: 'Demonstrou interesse e parou no pagamento.',
        tipo: 'quente',
        where: `${cobrancaSemPagar('manutencao')} AND NOT ${SQL.manutAtiva}`,
        email: {
          assunto: '{{nome}}, sua manutenção SICAF ainda não foi ativada',
          corpo: `Olá, {{nome}}!

A {{empresa}} iniciou a contratação da Manutenção SICAF, mas o pagamento ainda não foi confirmado.

Assim que for identificado, nossa equipe começa a monitorar o SICAF e as certidões da empresa. Se o boleto venceu, gere um novo pelo portal.`,
          cta: 'Ativar minha manutenção',
        },
      },
      {
        id: 'vencendo',
        nome: 'Manutenção vence em até 30 dias',
        descricao: 'Garanta a renovação antes do fim do plano.',
        tipo: 'renovacao',
        where: `EXISTS (SELECT 1 FROM manutencoes m WHERE m.cliente_id = c.id AND ${MANUT_ATIVA_SQL} AND m.data_fim BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
        email: {
          assunto: '{{nome}}, a manutenção da {{empresa}} está terminando',
          corpo: `Olá, {{nome}}!

O plano de Manutenção SICAF da {{empresa}} termina nos próximos dias. Renove para continuar com o monitoramento das certidões e do cadastro sem interrupção.`,
          cta: 'Renovar manutenção',
        },
      },
      {
        id: 'encerrada',
        nome: 'Manutenção vencida ou cancelada',
        descricao: 'Ex-clientes do plano — reconquista.',
        tipo: 'recuperacao',
        where: `EXISTS (SELECT 1 FROM manutencoes m WHERE m.cliente_id = c.id) AND NOT ${SQL.manutAtiva}`,
        email: {
          assunto: '{{nome}}, o SICAF da {{empresa}} está sem acompanhamento',
          corpo: `Olá, {{nome}}!

A manutenção do SICAF da {{empresa}} não está mais ativa. Isso significa que ninguém está acompanhando os vencimentos das certidões e do cadastro.

Reative o plano e volte a contar com:
{{beneficios}}`,
          cta: 'Reativar manutenção',
        },
      },
      {
        id: 'ativos',
        nome: 'Clientes com manutenção ativa',
        descricao: 'Relacionamento, indicação e novos serviços.',
        tipo: 'relacionamento',
        where: SQL.manutAtiva,
      },
      {
        id: 'base_sem_manutencao',
        nome: 'Toda a base sem manutenção',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${SQL.manutAtiva}`,
      },
    ],
  },

  caufesp: {
    id: 'caufesp',
    nome: 'BEC · CAUFESP',
    sigla: 'CAUFESP',
    abrangencia: 'Estado de São Paulo',
    resumo:
      'O CAUFESP é o cadastro de fornecedores do Governo de SP. Com o CRC, a empresa disputa as compras da BEC/SP — secretarias, universidades e hospitais estaduais.',
    cor: '#0284c7',
    rota: '/caufesp',
    chavePreco: 'valor_caufesp',
    precoPadrao: 985.3,
    recorrencia: 'assessoria',
    origens: ['caufesp'],
    ativoLabel: 'Assessorias pagas',
    andamentoLabel: 'Em andamento',
    ativo: assessoria('caufesp_processos', 'x.pago = 1'),
    andamento: assessoria('caufesp_processos', "x.pago = 1 AND x.status NOT IN ('aprovado','indeferido')"),
    beneficios: [
      'Acesso às compras diárias do Governo do Estado de São Paulo',
      'Pregões eletrônicos e ofertas de compra na BEC/SP',
      'CRC aceito em todas as licitações estaduais',
      'Assessoria completa até a emissão do CRC',
    ],
    pitch: {
      gancho:
        'São Paulo é o maior comprador estadual do país. Com o CAUFESP a empresa vende para secretarias, universidades e hospitais de SP pela BEC.',
      argumentos: [
        'A BEC publica compras todos os dias — muitas por dispensa, com concorrência menor.',
        'O CRC dispensa reapresentar documentos a cada licitação estadual.',
        'Fazemos o pré-cadastro e acompanhamos a análise até o CRC sair.',
      ],
      objecoes: [
        {
          pergunta: 'Minha empresa não é de São Paulo.',
          resposta:
            'Não precisa ser. Empresas de qualquer estado podem se cadastrar e vender para o Governo de SP.',
        },
        {
          pergunta: 'Já tenho SICAF, preciso disso?',
          resposta:
            'O SICAF vale para o Governo Federal. As compras do Estado de SP exigem o CAUFESP — são mercados diferentes.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. A {{empresa}} já pensou em vender para o Governo do Estado de São Paulo? Fazemos o cadastro CAUFESP completo para vocês disputarem as compras da BEC. Posso te explicar como funciona?',
    segmentos: [
      {
        id: 'sicaf_sem_servico',
        nome: 'Pagou o SICAF e não tem CAUFESP',
        descricao: 'Já vende ao governo — expandir para SP.',
        tipo: 'quente',
        where: `${SQL.sicafPago} AND NOT ${assessoria('caufesp_processos')}`,
        email: {
          assunto: '{{nome}}, a {{empresa}} já pode vender também para o Governo de SP',
          corpo: `Olá, {{nome}}!

A {{empresa}} já está pronta para o Governo Federal. Que tal disputar também as compras do Estado de São Paulo, o maior comprador estadual do país?

Com o CAUFESP sua empresa tem:
{{beneficios}}

A assessoria completa custa {{preco}}.`,
          cta: 'Quero vender para SP',
        },
      },
      {
        id: 'sp_sem_servico',
        nome: 'Empresas de SP sem CAUFESP',
        descricao: 'Estão no estado — o CRC é o próximo passo.',
        tipo: 'quente',
        where: `${UF_SQL} = 'SP' AND NOT ${assessoria('caufesp_processos')}`,
        email: {
          assunto: '{{nome}}, a {{empresa}} está em SP — já pensou em vender ao Governo do Estado?',
          corpo: `Olá, {{nome}}!

Secretarias, universidades e hospitais estaduais de São Paulo compram todos os dias pela BEC/SP. Para disputar, a empresa precisa do cadastro CAUFESP.

A CADBRASIL faz tudo por você:
{{beneficios}}`,
          cta: 'Fazer meu CAUFESP',
        },
      },
      {
        id: 'iniciou_sem_pagar',
        nome: 'Abriu o processo e não pagou',
        descricao: 'Interesse declarado no portal.',
        tipo: 'quente',
        where: assessoria('caufesp_processos', 'x.pago = 0'),
        email: {
          assunto: '{{nome}}, seu cadastro CAUFESP está quase lá',
          corpo: `Olá, {{nome}}!

A {{empresa}} iniciou a assessoria CAUFESP no portal, mas o pagamento ainda não foi confirmado.

Assim que confirmarmos, nossa equipe começa a análise da documentação e o pré-cadastro na BEC/SP.`,
          cta: 'Continuar meu cadastro',
        },
      },
      {
        id: 'em_andamento',
        nome: 'Processo em andamento',
        descricao: 'Pagaram e aguardam a conclusão.',
        tipo: 'relacionamento',
        where: assessoria('caufesp_processos', "x.pago = 1 AND x.status NOT IN ('aprovado','indeferido')"),
      },
      {
        id: 'aprovados',
        nome: 'CRC aprovado',
        descricao: 'Clientes satisfeitos — ofereça outros portais.',
        tipo: 'relacionamento',
        where: assessoria('caufesp_processos', "x.status = 'aprovado'"),
      },
      {
        id: 'base_sem_servico',
        nome: 'Toda a base sem CAUFESP',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${assessoria('caufesp_processos')}`,
      },
    ],
  },

  bll: {
    id: 'bll',
    nome: 'BLL Compras',
    sigla: 'BLL',
    abrangencia: 'Municípios de todo o Brasil',
    resumo:
      'A BLL é a plataforma usada por prefeituras, câmaras e consórcios de todo o país. Um único cadastro dá acesso a pregões e dispensas municipais.',
    cor: '#ea580c',
    rota: '/bll',
    chavePreco: 'valor_assessoria_bll',
    precoPadrao: 479,
    recorrencia: 'assessoria',
    origens: ['bll'],
    ativoLabel: 'Assessorias pagas',
    andamentoLabel: 'Em andamento',
    ativo: assessoria('bll_processos', 'x.pago = 1'),
    andamento: assessoria('bll_processos', "x.pago = 1 AND x.status NOT IN ('aprovado','indeferido')"),
    beneficios: [
      'Licitações de prefeituras e câmaras de todo o Brasil',
      'Pregões, dispensas eletrônicas e leilões numa só plataforma',
      'Termo de Adesão e pré-cadastro feitos com a nossa equipe',
      'Ótima porta de entrada para pequenas e médias empresas',
    ],
    pitch: {
      gancho:
        'Milhares de prefeituras compram pela BLL. É o caminho mais rápido para pequenas e médias empresas começarem a vender ao governo.',
      argumentos: [
        'Municípios compram de tudo, o ano inteiro — e muitas compras são por dispensa.',
        'Um único cadastro vale para todos os órgãos que usam a BLL.',
        'Cuidamos do pré-cadastro, do Termo de Adesão e da validação.',
      ],
      objecoes: [
        {
          pergunta: 'A BLL cobra à parte?',
          resposta:
            'Sim, a BLL tem plano próprio pago direto a ela. A CADBRASIL cuida de toda a parte burocrática para o cadastro sair aprovado.',
        },
        {
          pergunta: 'Já tenho SICAF.',
          resposta:
            'O SICAF é federal. Prefeituras usam plataformas próprias como a BLL — é um mercado novo para a empresa.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. Sabia que milhares de prefeituras compram pela BLL? Fazemos o cadastro da {{empresa}} na plataforma para vocês disputarem licitações municipais no Brasil todo. Posso te explicar?',
    segmentos: [
      {
        id: 'sicaf_sem_servico',
        nome: 'Pagou o SICAF e não tem BLL',
        descricao: 'Já vende ao governo — expandir para municípios.',
        tipo: 'quente',
        where: `${SQL.sicafPago} AND NOT ${assessoria('bll_processos')}`,
        email: {
          assunto: '{{nome}}, leve a {{empresa}} para as licitações das prefeituras',
          corpo: `Olá, {{nome}}!

A {{empresa}} já está habilitada para o Governo Federal. Agora dá para abrir um novo mercado: as prefeituras, câmaras e consórcios que compram pela BLL.

Com a assessoria BLL você tem:
{{beneficios}}

Investimento na assessoria: {{preco}}.`,
          cta: 'Quero vender para prefeituras',
        },
      },
      {
        id: 'manutencao_sem_servico',
        nome: 'Tem manutenção ativa e não tem BLL',
        descricao: 'Clientes engajados — alta chance de compra.',
        tipo: 'quente',
        where: `${SQL.manutAtiva} AND NOT ${assessoria('bll_processos')}`,
        email: {
          assunto: '{{nome}}, um novo mercado para a {{empresa}}: prefeituras de todo o Brasil',
          corpo: `Olá, {{nome}}!

Como cliente da Manutenção CADBRASIL, a {{empresa}} já tem a documentação em dia — metade do caminho para entrar na BLL, plataforma usada por milhares de prefeituras.

Nós cuidamos do restante:
{{beneficios}}`,
          cta: 'Cadastrar na BLL',
        },
      },
      {
        id: 'iniciou_sem_pagar',
        nome: 'Abriu o processo e não pagou',
        descricao: 'Interesse declarado no portal.',
        tipo: 'quente',
        where: assessoria('bll_processos', 'x.pago = 0'),
        email: {
          assunto: '{{nome}}, seu cadastro na BLL está esperando',
          corpo: `Olá, {{nome}}!

A {{empresa}} iniciou a assessoria BLL no portal, mas o pagamento ainda não foi confirmado.

Assim que confirmarmos, nossa equipe começa a conferência dos documentos e o pré-cadastro na plataforma.`,
          cta: 'Continuar meu cadastro',
        },
      },
      {
        id: 'em_andamento',
        nome: 'Processo em andamento',
        descricao: 'Pagaram e aguardam a conclusão.',
        tipo: 'relacionamento',
        where: assessoria('bll_processos', "x.pago = 1 AND x.status NOT IN ('aprovado','indeferido')"),
      },
      {
        id: 'aprovados',
        nome: 'Cadastro aprovado na BLL',
        descricao: 'Clientes satisfeitos — ofereça outros portais.',
        tipo: 'relacionamento',
        where: assessoria('bll_processos', "x.status = 'aprovado'"),
      },
      {
        id: 'base_sem_servico',
        nome: 'Toda a base sem BLL',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${assessoria('bll_processos')}`,
      },
    ],
  },

  licitacoes_e: {
    id: 'licitacoes_e',
    nome: 'Assistente Licitações-e',
    sigla: 'Licitações-e',
    abrangencia: 'Banco do Brasil',
    resumo:
      'O Assistente Licitações-e acompanha a empresa do acesso ao resultado nas licitações do Banco do Brasil, de estados, municípios e estatais.',
    cor: '#d97706',
    rota: '/licitacoes-e',
    chavePreco: 'valor_modulo_licitacoes_e',
    precoPadrao: 299,
    recorrencia: 'por mês',
    origens: ['modulo_licitacoes_e'],
    ativoLabel: 'Assinantes',
    andamentoLabel: 'Em cortesia',
    ativo: modulo('licitacoes_e', 'ma.valido_ate >= CURDATE()'),
    andamento: modulo('licitacoes_e', 'ma.cortesia_ate >= CURDATE() AND (ma.valido_ate IS NULL OR ma.valido_ate < CURDATE())'),
    beneficios: [
      'Licitações do Banco do Brasil e de órgãos conveniados num só lugar',
      'Apoio da equipe CADBRASIL do credenciamento ao resultado',
      'Acompanhamento de editais e sessões',
      'Orientação para cada etapa da disputa',
    ],
    pitch: {
      gancho:
        'O Licitações-e do Banco do Brasil é usado por estados, municípios e estatais. O Assistente CADBRASIL tira o cliente do zero até a disputa.',
      argumentos: [
        'Muitos órgãos publicam exclusivamente no Licitações-e.',
        'O credenciamento e a operação do portal confundem quem está começando.',
        'Mensalidade baixa comparada ao valor de um único contrato.',
      ],
      objecoes: [
        {
          pergunta: 'Já participo em outros portais.',
          resposta:
            'Cada portal tem órgãos exclusivos. Estar no Licitações-e amplia as oportunidades sem competir com o que já faz.',
        },
        {
          pergunta: 'E se eu não usar todo mês?',
          resposta: 'A assinatura é mensal — o cliente pode pausar quando quiser.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. A {{empresa}} já participa das licitações do Banco do Brasil (Licitações-e)? Nosso Assistente acompanha vocês do credenciamento à disputa. Quer que eu libere para você conhecer?',
    segmentos: [
      {
        id: 'cortesia',
        nome: 'Em cortesia (converter antes de acabar)',
        descricao: 'Estão usando grátis — hora de assinar.',
        tipo: 'quente',
        where: modulo('licitacoes_e', 'ma.cortesia_ate >= CURDATE() AND (ma.valido_ate IS NULL OR ma.valido_ate < CURDATE())'),
        email: {
          assunto: '{{nome}}, sua cortesia do Assistente Licitações-e está acabando',
          corpo: `Olá, {{nome}}!

A {{empresa}} está aproveitando o Assistente Licitações-e em cortesia. Para continuar sem interrupção, assine agora por {{preco}}.

Você continua com:
{{beneficios}}`,
          cta: 'Assinar agora',
        },
      },
      {
        id: 'visitou_sem_assinar',
        nome: 'Abriu o módulo e não assinou',
        descricao: 'Visitou a página do Licitações-e no portal.',
        tipo: 'quente',
        where: `${modulo('licitacoes_e', 'ma.ultimo_pagamento_em IS NULL AND (ma.cortesia_ate IS NULL OR ma.cortesia_ate < CURDATE())')}`,
        email: {
          assunto: '{{nome}}, vimos seu interesse no Licitações-e',
          corpo: `Olá, {{nome}}!

Você conheceu o Assistente Licitações-e no portal CADBRASIL. Com ele, a {{empresa}} participa das licitações do Banco do Brasil com o apoio da nossa equipe:
{{beneficios}}

Assine por {{preco}} e comece hoje.`,
          cta: 'Ativar o Assistente',
        },
      },
      {
        id: 'sicaf_sem_modulo',
        nome: 'Pagou o SICAF e não assina',
        descricao: 'Já vende ao governo — amplie os portais.',
        tipo: 'quente',
        where: `${SQL.sicafPago} AND NOT ${modulo('licitacoes_e', 'ma.valido_ate >= CURDATE()')}`,
        email: {
          assunto: '{{nome}}, mais licitações para a {{empresa}}: Banco do Brasil e estatais',
          corpo: `Olá, {{nome}}!

Além do Governo Federal, estados, municípios e estatais publicam licitações no Licitações-e do Banco do Brasil. Com o Assistente CADBRASIL, a {{empresa}} participa com apoio especializado:
{{beneficios}}`,
          cta: 'Conhecer o Assistente',
        },
      },
      {
        id: 'vencendo',
        nome: 'Assinatura vence em até 7 dias',
        descricao: 'Lembrete de renovação.',
        tipo: 'renovacao',
        where: modulo('licitacoes_e', 'ma.valido_ate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)'),
        email: {
          assunto: '{{nome}}, renove o Assistente Licitações-e da {{empresa}}',
          corpo: `Olá, {{nome}}!

A assinatura do Assistente Licitações-e vence nos próximos dias. Renove para não perder o acompanhamento das licitações em andamento.`,
          cta: 'Renovar assinatura',
        },
      },
      {
        id: 'vencida',
        nome: 'Assinatura vencida',
        descricao: 'Ex-assinantes — reconquista.',
        tipo: 'recuperacao',
        where: modulo('licitacoes_e', 'ma.valido_ate < CURDATE() AND ma.ultimo_pagamento_em IS NOT NULL'),
        email: {
          assunto: '{{nome}}, sentimos sua falta no Licitações-e',
          corpo: `Olá, {{nome}}!

A assinatura do Assistente Licitações-e da {{empresa}} está vencida. Reative para voltar a acompanhar as licitações do Banco do Brasil com a nossa equipe.`,
          cta: 'Reativar assinatura',
        },
      },
      {
        id: 'assinantes',
        nome: 'Assinantes ativos',
        descricao: 'Relacionamento e novos serviços.',
        tipo: 'relacionamento',
        where: modulo('licitacoes_e', 'ma.valido_ate >= CURDATE()'),
      },
      {
        id: 'base_sem_modulo',
        nome: 'Toda a base sem assinatura',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${modulo('licitacoes_e', 'ma.valido_ate >= CURDATE()')}`,
      },
    ],
  },

  pncp: {
    id: 'pncp',
    nome: 'PNCP Inteligente',
    sigla: 'PNCP',
    abrangencia: 'Nacional · Lei 14.133',
    resumo:
      'O PNCP Inteligente reúne pesquisa de oportunidades, inteligência de mercado público e treinamento sobre o Portal Nacional de Contratações Públicas.',
    cor: '#4f46e5',
    rota: '/pncp',
    chavePreco: 'valor_modulo_pncp',
    precoPadrao: 699,
    recorrencia: 'por mês',
    origens: ['modulo_pncp'],
    ativoLabel: 'Assinantes',
    andamentoLabel: 'Em cortesia',
    ativo: modulo('pncp', 'ma.valido_ate >= CURDATE()'),
    andamento: modulo('pncp', 'ma.cortesia_ate >= CURDATE() AND (ma.valido_ate IS NULL OR ma.valido_ate < CURDATE())'),
    beneficios: [
      'Todas as licitações do país, de todos os entes, num só lugar',
      'Inteligência de mercado: preços praticados e concorrentes',
      'Consulta de atas de registro de preços e contratos',
      'Treinamento para usar o PNCP a favor da empresa',
    ],
    pitch: {
      gancho:
        'Pela Nova Lei de Licitações, tudo é publicado no PNCP. Quem sabe pesquisar ali encontra mais oportunidades e preços certeiros.',
      argumentos: [
        'Todo órgão público do país é obrigado a publicar no PNCP.',
        'Ver preços praticados e concorrentes ajuda a vencer mais disputas.',
        'Treinamento incluso para a equipe do cliente.',
      ],
      objecoes: [
        {
          pergunta: 'O PNCP é gratuito.',
          resposta:
            'O portal é aberto, mas encontrar e analisar as oportunidades certas toma tempo. O PNCP Inteligente entrega isso pronto.',
        },
        {
          pergunta: 'Já uso o Radar de Licitações.',
          resposta:
            'O módulo vai além: inteligência de preços, atas e treinamento para decidir onde disputar.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. Pela Nova Lei, todas as licitações do Brasil estão no PNCP. Nosso PNCP Inteligente mostra as oportunidades e os preços praticados no segmento da {{empresa}}. Quer conhecer?',
    segmentos: [
      {
        id: 'cortesia',
        nome: 'Em cortesia (converter antes de acabar)',
        descricao: 'Estão usando grátis — hora de assinar.',
        tipo: 'quente',
        where: modulo('pncp', 'ma.cortesia_ate >= CURDATE() AND (ma.valido_ate IS NULL OR ma.valido_ate < CURDATE())'),
        email: {
          assunto: '{{nome}}, sua cortesia do PNCP Inteligente está acabando',
          corpo: `Olá, {{nome}}!

A {{empresa}} está aproveitando o PNCP Inteligente em cortesia. Para continuar com acesso, assine agora por {{preco}}.

Você continua com:
{{beneficios}}`,
          cta: 'Assinar agora',
        },
      },
      {
        id: 'visitou_sem_assinar',
        nome: 'Abriu o módulo e não assinou',
        descricao: 'Visitou a página do PNCP no portal.',
        tipo: 'quente',
        where: modulo('pncp', 'ma.ultimo_pagamento_em IS NULL AND (ma.cortesia_ate IS NULL OR ma.cortesia_ate < CURDATE())'),
        email: {
          assunto: '{{nome}}, vimos seu interesse no PNCP Inteligente',
          corpo: `Olá, {{nome}}!

Você conheceu o PNCP Inteligente no portal CADBRASIL. Com ele, a {{empresa}} encontra oportunidades no país inteiro e entende os preços praticados:
{{beneficios}}

Assine por {{preco}}.`,
          cta: 'Ativar o PNCP Inteligente',
        },
      },
      {
        id: 'sicaf_sem_modulo',
        nome: 'Pagou o SICAF e não assina',
        descricao: 'Já vende ao governo — mais inteligência.',
        tipo: 'quente',
        where: `${SQL.sicafPago} AND NOT ${modulo('pncp', 'ma.valido_ate >= CURDATE()')}`,
        email: {
          assunto: '{{nome}}, encontre mais licitações para a {{empresa}} no PNCP',
          corpo: `Olá, {{nome}}!

Pela Nova Lei de Licitações, todos os órgãos publicam editais, atas e contratos no PNCP. O PNCP Inteligente transforma isso em oportunidades para a {{empresa}}:
{{beneficios}}`,
          cta: 'Conhecer o PNCP Inteligente',
        },
      },
      {
        id: 'vencendo',
        nome: 'Assinatura vence em até 7 dias',
        descricao: 'Lembrete de renovação.',
        tipo: 'renovacao',
        where: modulo('pncp', 'ma.valido_ate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)'),
        email: {
          assunto: '{{nome}}, renove o PNCP Inteligente da {{empresa}}',
          corpo: `Olá, {{nome}}!

A assinatura do PNCP Inteligente vence nos próximos dias. Renove para continuar com a pesquisa de oportunidades e a inteligência de mercado.`,
          cta: 'Renovar assinatura',
        },
      },
      {
        id: 'vencida',
        nome: 'Assinatura vencida',
        descricao: 'Ex-assinantes — reconquista.',
        tipo: 'recuperacao',
        where: modulo('pncp', 'ma.valido_ate < CURDATE() AND ma.ultimo_pagamento_em IS NOT NULL'),
        email: {
          assunto: '{{nome}}, o PNCP Inteligente da {{empresa}} está pausado',
          corpo: `Olá, {{nome}}!

A assinatura do PNCP Inteligente está vencida. Reative para voltar a receber oportunidades e análises de mercado.`,
          cta: 'Reativar assinatura',
        },
      },
      {
        id: 'assinantes',
        nome: 'Assinantes ativos',
        descricao: 'Relacionamento e novos serviços.',
        tipo: 'relacionamento',
        where: modulo('pncp', 'ma.valido_ate >= CURDATE()'),
      },
      {
        id: 'base_sem_modulo',
        nome: 'Toda a base sem assinatura',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${modulo('pncp', 'ma.valido_ate >= CURDATE()')}`,
      },
    ],
  },

  leitor_ia: {
    id: 'leitor_ia',
    nome: 'Leitor de Editais IA',
    sigla: 'Leitor IA',
    abrangencia: 'Pacotes de leitura',
    resumo:
      'O Leitor de Editais com IA resume editais em minutos: objeto, exigências de habilitação, prazos e riscos — sem ler centenas de páginas.',
    cor: '#7c3aed',
    rota: '/servicos-ia',
    chavePreco: null,
    precoPadrao: 49.9,
    recorrencia: 'a partir de',
    origens: ['pacote_ia'],
    ativoLabel: 'Compradores',
    andamentoLabel: 'Compra pendente',
    ativo: pacoteIa("LOWER(cp.status) = 'pago'"),
    andamento: `(${pacoteIa("LOWER(cp.status) <> 'pago'")} AND NOT ${pacoteIa("LOWER(cp.status) = 'pago'")})`,
    beneficios: [
      'Resumo do edital em minutos com inteligência artificial',
      'Exigências de habilitação e documentos destacados',
      'Prazos, riscos e pontos de atenção organizados',
      'Pacotes de leitura sem mensalidade',
    ],
    pitch: {
      gancho:
        'Ler um edital inteiro leva horas. O Leitor IA entrega o resumo com o que importa em minutos.',
      argumentos: [
        'Economiza horas por edital e evita perder exigências escondidas.',
        'Pacotes avulsos — paga só pelo que usar.',
        'Ideal para quem participa de várias licitações por mês.',
      ],
      objecoes: [
        {
          pergunta: 'Confio mais lendo eu mesmo.',
          resposta:
            'O Leitor não substitui a leitura final — ele mostra rápido onde estão os pontos críticos para decidir se vale disputar.',
        },
        {
          pergunta: 'Participo de poucas licitações.',
          resposta: 'O pacote Starter é pequeno e não tem mensalidade.',
        },
      ],
    },
    whatsapp:
      'Olá, {{nome}}! Aqui é da CADBRASIL. Você sabia que nosso Leitor de Editais com IA resume um edital em minutos, com exigências e prazos destacados? Quer testar com um edital da {{empresa}}?',
    segmentos: [
      {
        id: 'sicaf_sem_pacote',
        nome: 'Pagou o SICAF e nunca comprou pacote',
        descricao: 'Participam de licitações — precisam ler editais.',
        tipo: 'quente',
        where: `${SQL.sicafPago} AND NOT ${pacoteIa("LOWER(cp.status) = 'pago'")}`,
        email: {
          assunto: '{{nome}}, leia editais em minutos com a IA da CADBRASIL',
          corpo: `Olá, {{nome}}!

Agora que a {{empresa}} está pronta para disputar licitações, o próximo desafio é analisar os editais. O Leitor de Editais IA faz isso em minutos:
{{beneficios}}

Pacotes {{preco}}.`,
          cta: 'Conhecer o Leitor IA',
        },
      },
      {
        id: 'iniciou_sem_pagar',
        nome: 'Iniciou a compra e não pagou',
        descricao: 'Gerou cobrança de pacote e parou.',
        tipo: 'quente',
        where: `${pacoteIa("LOWER(cp.status) <> 'pago'")} AND NOT ${pacoteIa("LOWER(cp.status) = 'pago'")}`,
        email: {
          assunto: '{{nome}}, seu pacote do Leitor IA está esperando',
          corpo: `Olá, {{nome}}!

Você iniciou a compra de um pacote do Leitor de Editais IA, mas o pagamento ainda não foi confirmado. Conclua pelo portal e comece a analisar editais em minutos.`,
          cta: 'Concluir compra',
        },
      },
      {
        id: 'compradores',
        nome: 'Já compraram pacote',
        descricao: 'Recompra e upgrade de pacote.',
        tipo: 'relacionamento',
        where: pacoteIa("LOWER(cp.status) = 'pago'"),
      },
      {
        id: 'base_sem_pacote',
        nome: 'Toda a base sem pacote',
        descricao: 'Público amplo — use com moderação.',
        tipo: 'frio',
        where: `NOT ${pacoteIa("LOWER(cp.status) = 'pago'")}`,
      },
    ],
  },
};

const ORDEM_SERVICOS = ['sicaf', 'manutencao', 'caufesp', 'bll', 'licitacoes_e', 'pncp', 'leitor_ia'];

/* ------------------------------------------------------------------ */
/* Fornecedores (prospecção — ainda não são clientes)                  */
/* ------------------------------------------------------------------ */

const EMAIL_PROSPECCAO = {
  assunto: 'A {{empresa}} já vende para o governo — conheça o {{servico}}',
  corpo: `Olá!

Vimos que a {{empresa}} está cadastrada como fornecedora do governo. Por isso, queremos apresentar o {{servico}} da CADBRASIL.

{{resumo}}

O que sua empresa recebe:
{{beneficios}}

Investimento: {{preco}}. Crie sua conta gratuita no portal CADBRASIL para conhecer — leva menos de 2 minutos.`,
  cta: 'Conhecer a CADBRASIL',
};

function whatsappProspeccao(svc) {
  const frase = String(svc.pitch.gancho).split(/(?<=\.)\s/)[0];
  return `Olá! Aqui é da CADBRASIL. Vi que a {{empresa}} já é fornecedora do governo. Trabalhamos com ${svc.nome}: ${frase} Posso te explicar em 2 minutos?`;
}

function segmentosFornecedores(svc) {
  const lista = [
    {
      id: 'forn_licitantes',
      nome: 'Fornecedores que disputaram licitações',
      descricao: 'Participaram de pregões e ainda não são clientes CADBRASIL.',
      where: 'f.licitante = 1',
    },
  ];
  if (svc.id === 'caufesp') {
    lista.push({
      id: 'forn_sp',
      nome: 'Fornecedores do governo em SP',
      descricao: 'Já vendem ao governo e estão em São Paulo — perfil ideal para a BEC.',
      where: "f.uf = 'SP'",
    });
  }
  if (svc.id === 'bll' || svc.id === 'licitacoes_e') {
    lista.push({
      id: 'forn_pequenas',
      nome: 'Micro e pequenas fornecedoras',
      descricao: 'ME/EPP que já vendem ao governo — porta de entrada nos municípios.',
      where: "(f.porte LIKE '%MICRO%' OR f.porte LIKE '%PEQUENO%' OR f.porte IN ('ME','EPP'))",
    });
  }
  lista.push({
    id: 'forn_todos',
    nome: 'Todos os fornecedores com contato',
    descricao: 'Base pública de fornecedores (Compras.gov/PNCP) que ainda não são clientes.',
    where: '1=1',
  });
  return lista.map((s) => ({ ...s, tipo: 'prospeccao', base: 'fornecedores', email: EMAIL_PROSPECCAO }));
}

for (const id of ORDEM_SERVICOS) {
  SERVICOS[id].segmentos.push(...segmentosFornecedores(SERVICOS[id]));
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDocumento(doc) {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return String(doc || '').trim();
}

function primeiroNome(nome) {
  const n = String(nome || '').trim().split(/\s+/)[0] || '';
  if (!n) return 'Cliente';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function telefoneE164(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('55') && d.length >= 12) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return '';
}

function segredo() {
  return process.env.EMAIL_TRACKING_SECRET || process.env.JWT_SECRET || 'cadbrasil-captacao';
}

function assinar(valor) {
  return crypto.createHmac('sha256', segredo()).update(String(valor)).digest('hex').slice(0, 32);
}

function tokenValido(valor, token) {
  const esperado = assinar(valor);
  const t = String(token || '');
  return t.length === esperado.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esperado));
}

function baseUrlPadrao() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br').replace(/\/$/, '');
}

function normalizarOrigem(origem) {
  const s = String(origem || '').trim().replace(/\/$/, '');
  return /^https?:\/\/[^\s/]+$/i.test(s) ? s : baseUrlPadrao();
}

function getServico(id) {
  const svc = SERVICOS[String(id || '')];
  if (!svc) throw new Error('Serviço não encontrado');
  return svc;
}

function getSegmento(svc, segmentoId) {
  const seg = svc.segmentos.find((s) => s.id === segmentoId);
  if (!seg) throw new Error('Público não encontrado');
  return seg;
}

function emailModelo(svc, seg) {
  if (seg.email) return seg.email;
  return seg.tipo === 'relacionamento' ? EMAIL_RELACIONAMENTO : EMAIL_FRIO;
}

/* ------------------------------------------------------------------ */
/* Tabelas                                                             */
/* ------------------------------------------------------------------ */

let ensurePromise = null;

function ensureTables(db) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const utf = (t) => {
        t.charset('utf8mb4');
        t.collate('utf8mb4_unicode_ci');
      };
      if (!(await db.schema.hasTable(T_CAMPANHAS))) {
        await db.schema.createTable(T_CAMPANHAS, (t) => {
          utf(t);
          t.increments('id').primary();
          t.string('servico', 30).notNullable().index();
          t.string('segmento', 60).notNullable();
          t.string('segmento_nome', 160).notNullable();
          t.string('uf', 2).nullable();
          t.integer('cooldown_dias').unsigned().notNullable().defaultTo(0);
          t.string('assunto', 255).notNullable();
          t.text('corpo', 'mediumtext').notNullable();
          t.string('cta', 80).notNullable();
          t.string('base_url', 255).notNullable();
          t.string('status', 20).notNullable().defaultTo('enviando');
          t.integer('total').unsigned().notNullable().defaultTo(0);
          t.dateTime('agendada_para').nullable();
          t.dateTime('iniciada_em').nullable();
          t.dateTime('concluida_em').nullable();
          t.integer('criado_por').unsigned().nullable();
          t.string('ultimo_erro', 500).nullable();
          t.timestamps(true, true);
        });
      }
      if (!(await db.schema.hasTable(T_ENVIOS))) {
        await db.schema.createTable(T_ENVIOS, (t) => {
          utf(t);
          t.increments('id').primary();
          t.integer('campanha_id').unsigned().notNullable();
          t.integer('cliente_id').unsigned().nullable().index();
          t.string('email', 190).notNullable().index();
          t.string('nome', 190).nullable();
          t.string('empresa', 255).nullable();
          t.string('documento', 30).nullable();
          t.string('cidade', 120).nullable();
          t.string('uf', 4).nullable();
          t.string('status', 20).notNullable().defaultTo('pendente');
          t.string('lote_token', 32).nullable();
          t.dateTime('processando_em').nullable();
          t.string('erro', 500).nullable();
          t.dateTime('enviado_em').nullable();
          t.dateTime('aberto_em').nullable();
          t.dateTime('clicado_em').nullable();
          t.index(['campanha_id', 'status']);
        });
      }
      if (!(await db.schema.hasTable(T_CONTATOS))) {
        await db.schema.createTable(T_CONTATOS, (t) => {
          utf(t);
          t.increments('id').primary();
          t.string('servico', 30).notNullable();
          t.integer('cliente_id').unsigned().notNullable();
          t.string('canal', 20).notNullable();
          t.string('resultado', 30).notNullable().defaultTo('contatado');
          t.string('observacao', 500).nullable();
          t.integer('usuario_id').unsigned().nullable();
          t.dateTime('criado_em').notNullable().defaultTo(db.fn.now());
          t.index(['servico', 'cliente_id']);
        });
      }
      if (!(await db.schema.hasTable(T_OPTOUT))) {
        await db.schema.createTable(T_OPTOUT, (t) => {
          utf(t);
          t.increments('id').primary();
          t.string('email', 190).notNullable().unique();
          t.string('origem', 60).nullable();
          t.dateTime('criado_em').notNullable().defaultTo(db.fn.now());
        });
      }
      if (!(await db.schema.hasTable(T_ROTINAS))) {
        await db.schema.createTable(T_ROTINAS, (t) => {
          utf(t);
          t.increments('id').primary();
          t.string('nome', 160).notNullable();
          t.string('servico', 30).notNullable().index();
          t.string('segmento', 60).notNullable();
          t.string('segmento_nome', 160).notNullable();
          t.string('uf', 2).nullable();
          t.integer('cooldown_dias').unsigned().notNullable().defaultTo(0);
          t.integer('limite').unsigned().notNullable().defaultTo(0);
          t.string('assunto', 255).notNullable();
          t.text('corpo', 'mediumtext').notNullable();
          t.string('cta', 80).notNullable();
          t.string('base_url', 255).notNullable();
          t.string('frequencia', 20).notNullable().defaultTo('uma_vez');
          t.dateTime('proxima_execucao').nullable();
          t.dateTime('ultima_execucao').nullable();
          t.string('ultimo_resultado', 255).nullable();
          t.integer('execucoes').unsigned().notNullable().defaultTo(0);
          t.boolean('ativa').notNullable().defaultTo(true);
          t.integer('criado_por').unsigned().nullable();
          t.timestamps(true, true);
        });
      }
      if (!(await db.schema.hasColumn(T_CAMPANHAS, 'rotina_id'))) {
        await db.schema.alterTable(T_CAMPANHAS, (t) => {
          t.integer('rotina_id').unsigned().nullable().index();
        });
      }
      for (const tabela of [T_ENVIOS, T_CONTATOS]) {
        if (!(await db.schema.hasColumn(tabela, 'fornecedor_id'))) {
          await db.schema.alterTable(tabela, (t) => {
            t.integer('fornecedor_id').unsigned().nullable().index();
          });
        }
      }
      if (!(await db.schema.hasTable(T_FORN))) {
        await db.schema.createTable(T_FORN, (t) => {
          utf(t);
          t.integer('id').unsigned().primary();
          t.string('documento', 20).notNullable().unique();
          t.string('razao_social', 255).nullable();
          t.string('nome_fantasia', 255).nullable();
          t.string('porte', 60).nullable();
          t.string('uf', 2).nullable().index();
          t.string('municipio', 120).nullable();
          t.string('telefone', 40).nullable();
          t.string('email', 190).nullable().index();
          t.string('cep', 12).nullable();
          t.boolean('licitante').notNullable().defaultTo(false);
          t.integer('cliente_id').unsigned().nullable().index();
          t.dateTime('atualizado_em').notNullable();
        });
      }
    })().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error('Banco de dados não disponível');
  return db;
}

/* ------------------------------------------------------------------ */
/* Públicos                                                            */
/* ------------------------------------------------------------------ */

const UFS = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
);

function normalizarFiltros({ uf, cooldownDias } = {}) {
  const u = String(uf || '').toUpperCase().trim();
  const cd = parseInt(cooldownDias, 10);
  return {
    uf: UFS.has(u) ? u : null,
    cooldownDias: Number.isFinite(cd) && cd > 0 ? Math.min(cd, 365) : 0,
  };
}

const FONTES = {
  clientes: {
    from: 'clientes c',
    id: 'c.id',
    email: EMAIL_SQL,
    tel: TEL_SQL,
    uf: UF_SQL,
    ativo: 'c.deleted_at IS NULL',
    contato: 'ct.cliente_id = c.id',
    busca: ['c.razao_social', 'c.nome_fantasia', 'c.responsavel_nome'],
    documento: 'c.documento',
    ordem: 'c.created_at DESC, c.id DESC',
    select: `c.id AS cliente_id, NULL AS fornecedor_id, ${EMAIL_SQL} AS email,
      COALESCE(NULLIF(TRIM(c.responsavel_nome), ''), '') AS responsavel,
      COALESCE(NULLIF(TRIM(c.razao_social), ''), NULLIF(TRIM(c.nome_fantasia), ''), 'Empresa') AS empresa,
      COALESCE(c.documento, '') AS documento, ${TEL_SQL} AS telefone,
      COALESCE(c.cidade, '') AS cidade, ${UF_SQL} AS uf, COALESCE(c.cep, '') AS cep, c.created_at AS cadastrado_em`,
  },
  fornecedores: {
    from: `${T_FORN} f`,
    id: 'f.id',
    email: "LOWER(TRIM(COALESCE(f.email, '')))",
    tel: "TRIM(COALESCE(f.telefone, ''))",
    uf: "COALESCE(f.uf, '')",
    ativo: 'f.cliente_id IS NULL',
    contato: 'ct.fornecedor_id = f.id',
    busca: ['f.razao_social', 'f.nome_fantasia'],
    documento: 'f.documento',
    ordem: 'f.licitante DESC, f.id DESC',
    select: `NULL AS cliente_id, f.id AS fornecedor_id, LOWER(TRIM(COALESCE(f.email, ''))) AS email, '' AS responsavel,
      COALESCE(NULLIF(TRIM(f.razao_social), ''), NULLIF(TRIM(f.nome_fantasia), ''), 'Empresa') AS empresa,
      COALESCE(f.documento, '') AS documento, TRIM(COALESCE(f.telefone, '')) AS telefone,
      COALESCE(f.municipio, '') AS cidade, COALESCE(f.uf, '') AS uf, COALESCE(f.cep, '') AS cep, NULL AS cadastrado_em`,
  },
};

function fonteDe(seg) {
  return FONTES[seg.base === 'fornecedores' ? 'fornecedores' : 'clientes'];
}

/** WHERE comum: registro ativo, e-mail válido, sem descadastro, filtro de UF e de repetição. */
function whereBase(svc, filtros, { exigirEmail = true, fonte = FONTES.clientes } = {}) {
  const partes = [fonte.ativo];
  const binds = [];
  if (exigirEmail) {
    partes.push(`${fonte.email} LIKE '%_@_%._%'`);
    partes.push(`NOT EXISTS (SELECT 1 FROM ${T_OPTOUT} o WHERE o.email = ${fonte.email})`);
  }
  if (filtros.uf) {
    partes.push(`${fonte.uf} = ?`);
    binds.push(filtros.uf);
  }
  if (filtros.cooldownDias) {
    partes.push(`NOT EXISTS (SELECT 1 FROM ${T_ENVIOS} e INNER JOIN ${T_CAMPANHAS} k ON k.id = e.campanha_id
      WHERE e.email = ${fonte.email} AND k.servico = ? AND e.status = 'enviado'
      AND e.enviado_em >= DATE_SUB(NOW(), INTERVAL ? DAY))`);
    binds.push(svc.id, filtros.cooldownDias);
  }
  return { sql: partes.join(' AND '), binds };
}

/** Por segmento: e-mails aptos (total) e registros com telefone (totalTelefone, só fornecedores). */
async function contarSegmentos(db, svc, filtros) {
  const out = {};
  const clientes = svc.segmentos.filter((s) => s.base !== 'fornecedores');
  if (clientes.length) {
    const base = whereBase(svc, filtros);
    const cols = clientes
      .map((s, i) => `COUNT(DISTINCT CASE WHEN (${s.where}) THEN ${EMAIL_SQL} END) AS s${i}`)
      .join(',\n');
    const [rows] = await db.raw(`SELECT ${cols} FROM clientes c WHERE ${base.sql}`, base.binds);
    clientes.forEach((s, i) => {
      out[s.id] = { total: Number(rows[0]?.[`s${i}`] || 0), totalTelefone: null };
    });
  }

  const forn = svc.segmentos.filter((s) => s.base === 'fornecedores');
  if (forn.length) {
    const fonte = FONTES.fornecedores;
    const base = whereBase(svc, filtros, { exigirEmail: false, fonte });
    const apto = `${fonte.email} LIKE '%_@_%._%' AND NOT EXISTS (SELECT 1 FROM ${T_OPTOUT} o WHERE o.email = ${fonte.email})`;
    const cols = forn
      .map(
        (s, i) =>
          `COUNT(DISTINCT CASE WHEN (${s.where}) AND ${apto} THEN ${fonte.email} END) AS e${i},
           SUM(CASE WHEN (${s.where}) AND ${fonte.tel} <> '' THEN 1 ELSE 0 END) AS t${i}`,
      )
      .join(',\n');
    try {
      const [rows] = await db.raw(`SELECT ${cols} FROM ${fonte.from} WHERE ${base.sql}`, base.binds);
      forn.forEach((s, i) => {
        out[s.id] = {
          total: Number(rows[0]?.[`e${i}`] || 0),
          totalTelefone: Number(rows[0]?.[`t${i}`] || 0),
        };
      });
    } catch (e) {
      console.warn(`${LOG_PREFIX} Contagem de fornecedores:`, e.message);
      forn.forEach((s) => {
        out[s.id] = { total: 0, totalTelefone: 0 };
      });
    }
  }
  return out;
}

async function destinatarios(db, svc, seg, filtros, limite) {
  const fonte = fonteDe(seg);
  const base = whereBase(svc, filtros, { fonte });
  const [rows] = await db.raw(
    `SELECT ${fonte.select} FROM ${fonte.from} WHERE ${base.sql} AND (${seg.where}) ORDER BY ${fonte.ordem}`,
    base.binds,
  );
  const vistos = new Set();
  const lista = [];
  for (const r of rows) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email || vistos.has(email)) continue;
    vistos.add(email);
    lista.push({ ...r, email });
    if (limite && lista.length >= limite) break;
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* Preços e KPIs                                                       */
/* ------------------------------------------------------------------ */

async function precoServico(db, svc) {
  let valor = svc.precoPadrao;
  try {
    if (svc.id === 'leitor_ia') {
      const row = await db('pacotes_leitura_ia').where('ativo', 1).min('preco as v').first();
      if (row && Number(row.v) > 0) valor = Number(row.v);
    } else if (svc.chavePreco) {
      const row = await db('configuracoes_sistema').where('chave', svc.chavePreco).first();
      const v = row ? parseFloat(String(row.valor).replace(',', '.')) : NaN;
      if (Number.isFinite(v) && v > 0) valor = v;
    }
  } catch (_) {}
  const texto =
    svc.recorrencia === 'por mês'
      ? `${moeda(valor)}/mês`
      : svc.recorrencia === 'a partir de'
        ? `a partir de ${moeda(valor)}`
        : moeda(valor);
  return { valor, texto };
}

async function kpisServico(db, svc) {
  const quente = svc.segmentos.find((s) => s.tipo === 'quente');
  const base = whereBase(svc, { uf: null, cooldownDias: 0 });
  const [[contagem]] = await db.raw(
    `SELECT
      COUNT(DISTINCT CASE WHEN (${svc.ativo}) THEN c.id END) AS ativos,
      COUNT(DISTINCT CASE WHEN (${svc.andamento}) THEN c.id END) AS andamento,
      COUNT(DISTINCT CASE WHEN ${base.sql} AND (${quente.where}) THEN ${EMAIL_SQL} END) AS potencial
    FROM clientes c WHERE c.deleted_at IS NULL`,
    base.binds,
  );
  const origens = svc.origens.map(() => '?').join(',');
  const [[vendas]] = await db.raw(
    `SELECT COUNT(*) AS vendas, COALESCE(SUM(p.valor), 0) AS receita FROM pagamentos p
     WHERE p.origem IN (${origens}) AND ${PAG_PAGO_SQL} AND p.data_pagamento >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    svc.origens,
  );
  return {
    ativos: Number(contagem.ativos || 0),
    andamento: Number(contagem.andamento || 0),
    potencial: Number(contagem.potencial || 0),
    potencialLabel: quente.nome,
    vendas30d: Number(vendas.vendas || 0),
    receita30d: Number(vendas.receita || 0),
  };
}

/* ------------------------------------------------------------------ */
/* Campanhas: métricas                                                 */
/* ------------------------------------------------------------------ */

async function metricasCampanhas(db, campanhas) {
  if (!campanhas.length) return [];
  const ids = campanhas.map((c) => c.id);
  const marcadores = ids.map(() => '?').join(',');
  const [porStatus] = await db.raw(
    `SELECT campanha_id, status, COUNT(*) n, SUM(aberto_em IS NOT NULL) abertos, SUM(clicado_em IS NOT NULL) cliques
     FROM ${T_ENVIOS} WHERE campanha_id IN (${marcadores}) GROUP BY campanha_id, status`,
    ids,
  );
  const conversoes = new Map();
  for (const camp of campanhas) {
    const svc = SERVICOS[camp.servico];
    if (!svc) continue;
    const origens = svc.origens.map(() => '?').join(',');
    const prospeccao = String(camp.segmento || '').startsWith('forn_');
    const [[conv]] = await db.raw(
      prospeccao
        ? `SELECT COUNT(DISTINCT cl.id) AS clientes, COALESCE(SUM(p.valor), 0) AS receita
       FROM ${T_ENVIOS} e
       INNER JOIN clientes cl ON REPLACE(REPLACE(REPLACE(cl.documento, '.', ''), '/', ''), '-', '') = e.documento
       INNER JOIN pagamentos p ON p.cliente_id = cl.id AND p.origem IN (${origens}) AND ${PAG_PAGO_SQL}
         AND p.data_pagamento >= e.enviado_em AND p.data_pagamento < DATE_ADD(e.enviado_em, INTERVAL ${JANELA_CONVERSAO_DIAS} DAY)
       WHERE e.campanha_id = ? AND e.status = 'enviado'`
        : `SELECT COUNT(DISTINCT e.cliente_id) AS clientes, COALESCE(SUM(p.valor), 0) AS receita
       FROM ${T_ENVIOS} e
       INNER JOIN pagamentos p ON p.cliente_id = e.cliente_id AND p.origem IN (${origens}) AND ${PAG_PAGO_SQL}
         AND p.data_pagamento >= e.enviado_em AND p.data_pagamento < DATE_ADD(e.enviado_em, INTERVAL ${JANELA_CONVERSAO_DIAS} DAY)
       WHERE e.campanha_id = ? AND e.status = 'enviado'`,
      [...svc.origens, camp.id],
    );
    conversoes.set(camp.id, { clientes: Number(conv.clientes || 0), receita: Number(conv.receita || 0) });
  }

  return campanhas.map((c) => {
    const linhas = porStatus.filter((r) => r.campanha_id === c.id);
    const n = (st) => Number(linhas.find((r) => r.status === st)?.n || 0);
    const abertos = linhas.reduce((acc, r) => acc + Number(r.abertos || 0), 0);
    const cliques = linhas.reduce((acc, r) => acc + Number(r.cliques || 0), 0);
    const conv = conversoes.get(c.id) || { clientes: 0, receita: 0 };
    return {
      id: c.id,
      servico: c.servico,
      servicoNome: SERVICOS[c.servico]?.nome || c.servico,
      rotinaId: c.rotina_id || null,
      segmento: c.segmento,
      segmentoNome: c.segmento_nome,
      uf: c.uf,
      assunto: c.assunto,
      status: c.status,
      total: Number(c.total || 0),
      enviados: n('enviado'),
      falhas: n('falha'),
      pendentes: n('pendente') + n('processando'),
      cancelados: n('cancelado'),
      aberturas: abertos,
      cliques,
      conversoes: conv.clientes,
      receita: conv.receita,
      agendadaPara: c.agendada_para,
      iniciadaEm: c.iniciada_em,
      concluidaEm: c.concluida_em,
      criadaEm: c.created_at,
      ultimoErro: c.ultimo_erro,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

let cacheVisao = null;

async function visaoGeral({ forcar = false } = {}) {
  const db = requireDb();
  await ensureTables(db);
  if (!forcar && cacheVisao && Date.now() - cacheVisao.em < 120000) return cacheVisao.dados;

  const servicos = [];
  for (const id of ORDEM_SERVICOS) {
    const svc = SERVICOS[id];
    const [preco, kpis] = await Promise.all([precoServico(db, svc), kpisServico(db, svc)]);
    servicos.push({ ...resumoServico(svc), preco, kpis });
  }
  const [[campanhas]] = await db.raw(
    `SELECT SUM(status IN ('enviando','agendada')) AS ativas, COUNT(*) AS total FROM ${T_CAMPANHAS}`,
  );
  const dados = {
    ok: true,
    servicos,
    campanhasAtivas: Number(campanhas.ativas || 0),
    campanhasTotal: Number(campanhas.total || 0),
  };
  cacheVisao = { em: Date.now(), dados };
  return dados;
}

function resumoServico(svc) {
  return {
    id: svc.id,
    nome: svc.nome,
    sigla: svc.sigla,
    abrangencia: svc.abrangencia,
    resumo: svc.resumo,
    cor: svc.cor,
    rota: svc.rota,
    ativoLabel: svc.ativoLabel,
    andamentoLabel: svc.andamentoLabel,
  };
}

async function detalhe({ servico, uf, cooldownDias } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const filtros = normalizarFiltros({ uf, cooldownDias });

  const [preco, kpis, contagens, campanhasRows] = await Promise.all([
    precoServico(db, svc),
    kpisServico(db, svc),
    contarSegmentos(db, svc, filtros),
    db(T_CAMPANHAS).where('servico', svc.id).orderBy('id', 'desc').limit(30),
  ]);

  return {
    ok: true,
    servico: {
      ...resumoServico(svc),
      preco,
      beneficios: svc.beneficios,
      pitch: svc.pitch,
      whatsapp: svc.whatsapp,
    },
    filtros,
    kpis,
    segmentos: svc.segmentos.map((s) => ({
      id: s.id,
      nome: s.nome,
      descricao: s.descricao,
      tipo: s.tipo,
      base: s.base === 'fornecedores' ? 'fornecedores' : 'clientes',
      total: contagens[s.id]?.total || 0,
      totalTelefone: contagens[s.id]?.totalTelefone ?? null,
      email: emailModelo(svc, s),
      whatsapp: s.base === 'fornecedores' ? whatsappProspeccao(svc) : svc.whatsapp,
    })),
    fornecedores: await statusBaseFornecedores(db),
    campanhas: await metricasCampanhas(db, campanhasRows),
    rotinas: await listarRotinasDb(db, { servico: svc.id }),
  };
}

async function listarPublico({ servico, segmento, uf, busca, pagina = 1, ocultarContatados = false } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const seg = getSegmento(svc, segmento);
  const fonte = fonteDe(seg);
  const ehFornecedor = seg.base === 'fornecedores';
  const filtros = normalizarFiltros({ uf });
  const base = whereBase(svc, filtros, { exigirEmail: false, fonte });
  const partes = [base.sql, `(${seg.where})`, `${fonte.tel} <> ''`];
  const binds = [...base.binds];

  const termo = String(busca || '').trim();
  if (termo) {
    const digitos = termo.replace(/\D/g, '');
    const conds = fonte.busca.map((col) => `${col} LIKE ?`);
    fonte.busca.forEach(() => binds.push(`%${termo}%`));
    if (digitos.length >= 4) {
      conds.push(`${fonte.documento} LIKE ?`);
      binds.push(`%${digitos}%`);
    }
    partes.push(`(${conds.join(' OR ')})`);
  }
  if (ocultarContatados) {
    partes.push(`NOT EXISTS (SELECT 1 FROM ${T_CONTATOS} ct WHERE ${fonte.contato} AND ct.servico = ?
      AND ct.criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY))`);
    binds.push(svc.id);
  }

  const porPagina = 25;
  const pg = Math.max(1, parseInt(pagina, 10) || 1);
  const where = partes.join(' AND ');
  const [[{ total }]] = await db.raw(`SELECT COUNT(*) AS total FROM ${fonte.from} WHERE ${where}`, binds);
  const [rows] = await db.raw(
    `SELECT ${fonte.select} FROM ${fonte.from} WHERE ${where} ORDER BY ${fonte.ordem} LIMIT ? OFFSET ?`,
    [...binds, porPagina, (pg - 1) * porPagina],
  );

  const chave = (r) => (ehFornecedor ? r.fornecedor_id : r.cliente_id);
  const coluna = ehFornecedor ? 'ct.fornecedor_id' : 'ct.cliente_id';
  const ids = rows.map(chave);
  const ultimos = new Map();
  if (ids.length) {
    const contatos = await db(`${T_CONTATOS} as ct`)
      .leftJoin('usuarios as u', 'u.id', 'ct.usuario_id')
      .where('ct.servico', svc.id)
      .whereIn(coluna, ids)
      .orderBy('ct.id', 'desc')
      .select(
        `${coluna} as alvo_id`,
        'ct.canal',
        'ct.resultado',
        'ct.observacao',
        'ct.criado_em',
        'u.nome as usuario_nome',
      );
    for (const c of contatos) {
      if (!ultimos.has(c.alvo_id)) {
        ultimos.set(c.alvo_id, {
          canal: c.canal,
          resultado: c.resultado,
          observacao: c.observacao,
          em: c.criado_em,
          por: c.usuario_nome || null,
        });
      }
    }
  }

  return {
    ok: true,
    total: Number(total || 0),
    pagina: pg,
    porPagina,
    clientes: rows.map((r) => ({
      clienteId: r.cliente_id,
      fornecedorId: r.fornecedor_id,
      empresa: r.empresa,
      documento: formatDocumento(r.documento),
      responsavel: r.responsavel,
      email: r.email || '',
      telefone: r.telefone,
      whatsapp: telefoneE164(r.telefone).replace('+', ''),
      cidade: r.cidade,
      uf: r.uf,
      cadastradoEm: r.cadastrado_em,
      ultimoContato: ultimos.get(chave(r)) || null,
    })),
  };
}

const RESULTADOS_CONTATO = ['contatado', 'interessado', 'sem_interesse', 'sem_resposta', 'vendido'];
const CANAIS_CONTATO = ['whatsapp', 'telefone', 'email'];

async function registrarContato({
  servico,
  clienteId,
  fornecedorId,
  canal,
  resultado,
  observacao,
  usuarioId,
} = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const id = parseInt(clienteId, 10) || 0;
  const fid = parseInt(fornecedorId, 10) || null;
  if (!id && !fid) return { ok: false, error: 'Contato inválido' };
  const row = {
    servico: svc.id,
    cliente_id: id,
    fornecedor_id: fid,
    canal: CANAIS_CONTATO.includes(canal) ? canal : 'whatsapp',
    resultado: RESULTADOS_CONTATO.includes(resultado) ? resultado : 'contatado',
    observacao: observacao ? String(observacao).slice(0, 500) : null,
    usuario_id: usuarioId || null,
  };
  await db(T_CONTATOS).insert(row);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

function csvCampo(v) {
  const s = String(v ?? '');
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function dividirNome(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return ['', ''];
  return [partes[0], partes.slice(1).join(' ')];
}

/** Exportação aceita quem tem e-mail OU telefone (fornecedores quase nunca têm e-mail). */
async function registrosExportacao(db, svc, seg, filtros) {
  const fonte = fonteDe(seg);
  const base = whereBase(svc, filtros, { exigirEmail: false, fonte });
  const [rows] = await db.raw(
    `SELECT ${fonte.select} FROM ${fonte.from}
     WHERE ${base.sql} AND (${seg.where})
       AND (${fonte.email} LIKE '%_@_%._%' OR ${fonte.tel} <> '')
       AND NOT EXISTS (SELECT 1 FROM ${T_OPTOUT} o WHERE o.email = ${fonte.email})
     ORDER BY ${fonte.ordem}`,
    base.binds,
  );
  const vistos = new Set();
  const lista = [];
  for (const r of rows) {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email || '') ? r.email : '';
    const chave = email || String(r.telefone || '').replace(/\D/g, '') || `${r.cliente_id}-${r.fornecedor_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push({ ...r, email });
  }
  return lista;
}

async function exportarPublico({ servico, segmento, uf, cooldownDias, formato = 'padrao' } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const seg = getSegmento(svc, segmento);
  const filtros = normalizarFiltros({ uf, cooldownDias });
  const lista = await registrosExportacao(db, svc, seg, filtros);
  const data = new Date().toISOString().slice(0, 10);

  if (formato === 'google') {
    const linhas = ['Email,First Name,Last Name,Country,Zip,Phone'];
    for (const r of lista) {
      const [primeiro, ultimo] = dividirNome(r.responsavel);
      linhas.push(
        [r.email, primeiro, ultimo, 'BR', String(r.cep || '').replace(/\D/g, ''), telefoneE164(r.telefone)]
          .map(csvCampo)
          .join(','),
      );
    }
    return {
      ok: true,
      total: lista.length,
      arquivo: `customer-match-${svc.id}-${seg.id}-${data}.csv`,
      csv: `${linhas.join('\n')}\n`,
    };
  }

  const linhas = ['Empresa;CNPJ/CPF;Responsável;E-mail;Telefone;Cidade;UF;Cadastrado em'];
  for (const r of lista) {
    linhas.push(
      [
        r.empresa,
        formatDocumento(r.documento),
        r.responsavel,
        r.email,
        r.telefone,
        r.cidade,
        r.uf,
        r.cadastrado_em ? new Date(r.cadastrado_em).toLocaleDateString('pt-BR') : '',
      ]
        .map(csvCampo)
        .join(';'),
    );
  }
  return {
    ok: true,
    total: lista.length,
    arquivo: `publico-${svc.id}-${seg.id}-${data}.csv`,
    csv: `\uFEFF${linhas.join('\n')}\n`,
  };
}

/* ------------------------------------------------------------------ */
/* E-mail                                                              */
/* ------------------------------------------------------------------ */

function varsDestinatario(svc, preco, r) {
  return {
    nome: primeiroNome(r.responsavel || r.nome),
    responsavel: r.responsavel || r.nome || '',
    empresa: r.empresa || 'sua empresa',
    razaosocial: r.empresa || '',
    cnpj: formatDocumento(r.documento),
    cidade: r.cidade || '',
    estado: r.uf || '',
    servico: svc.nome,
    resumo: svc.resumo,
    preco: preco.texto,
    beneficios: svc.beneficios.map((b) => `- ${b}`).join('\n'),
  };
}

function aplicarVars(texto, vars) {
  return String(texto || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, k) => {
    const v = vars[k.toLowerCase()];
    return v == null ? m : String(v);
  });
}

/** Texto simples → HTML: parágrafos por linha em branco e linhas "- " viram lista. */
function corpoParaHtml(texto, cor) {
  const blocos = String(texto || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocos
    .map((bloco) => {
      const linhas = bloco.split('\n');
      const html = [];
      let lista = [];
      const fecharLista = () => {
        if (!lista.length) return;
        html.push(
          `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 14px">${lista
            .map(
              (t) =>
                `<tr><td valign="top" width="22" style="padding:4px 0;color:${cor};font-size:15px;font-weight:700">&#10003;</td><td style="padding:4px 0;font-size:15px;line-height:1.6;color:#334155">${esc(t)}</td></tr>`,
            )
            .join('')}</table>`,
        );
        lista = [];
      };
      const texto = [];
      const fecharTexto = () => {
        if (!texto.length) return;
        html.push(
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155">${texto.map(esc).join('<br/>')}</p>`,
        );
        texto.length = 0;
      };
      for (const l of linhas) {
        const m = l.match(/^\s*[-•]\s+(.*)$/);
        if (m) {
          fecharTexto();
          lista.push(m[1]);
        } else {
          fecharLista();
          texto.push(l);
        }
      }
      fecharTexto();
      fecharLista();
      return html.join('');
    })
    .join('');
}

function linksEnvio(baseUrl, envioId, email, destino) {
  const whatsapp = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent('Olá! Recebi o e-mail da CADBRASIL e quero saber mais.')}`;
  if (!envioId) {
    return {
      cta: destino,
      whatsapp,
      pixel: '',
      descadastro: `${baseUrl}/api/public/email/descadastrar?e=${encodeURIComponent(email)}&t=${assinar(email)}`,
    };
  }
  const clique = (url) =>
    `${baseUrl}/api/public/email/clique?i=${envioId}&u=${encodeURIComponent(url)}&t=${assinar(`${envioId}|${url}`)}`;
  return {
    cta: clique(destino),
    whatsapp: clique(whatsapp),
    pixel: `${baseUrl}/api/public/email/abertura?i=${envioId}&t=${assinar(envioId)}`,
    descadastro: `${baseUrl}/api/public/email/descadastrar?e=${encodeURIComponent(email)}&t=${assinar(email)}`,
  };
}

function montarEmail({ svc, preco, assunto, corpo, cta, destinatario, baseUrl, envioId }) {
  const vars = varsDestinatario(svc, preco, destinatario);
  const fornecedor = !!(destinatario.fornecedor_id || destinatario.prospeccao);
  const destino = fornecedor ? `${baseUrl}/auth` : `${baseUrl}${svc.rota}`;
  const links = linksEnvio(baseUrl, envioId, destinatario.email, destino);
  const subject = aplicarVars(assunto, vars).trim();
  const corpoFinal = aplicarVars(corpo, vars);
  const ctaTexto = aplicarVars(cta || 'Saiba mais', vars);
  const cor = svc.cor;
  const F = 'Arial,Helvetica,sans-serif';

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:${F}">
<span style="display:none!important;max-height:0;overflow:hidden;opacity:0">${esc(svc.resumo)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dbe3ec">
  <tr><td style="background:#0f2f52;padding:18px 28px">
    <table role="presentation" width="100%"><tr>
      <td style="font-size:17px;font-weight:800;letter-spacing:.02em;color:#ffffff;font-family:${F}">CADBRASIL</td>
      <td align="right"><span style="display:inline-block;background:${cor};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:4px;font-family:${F}">${esc(svc.sigla)}</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:${cor};font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:30px 28px 10px;font-family:${F}">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${cor}">${esc(svc.nome)} · ${esc(svc.abrangencia)}</p>
    <h1 style="margin:0 0 20px;font-size:22px;line-height:1.35;color:#0f172a">${esc(subject)}</h1>
    ${corpoParaHtml(corpoFinal, cor)}
  </td></tr>
  <tr><td style="padding:6px 28px 8px">
    <table role="presentation" width="100%"><tr><td align="center" style="padding:6px">
      <a href="${esc(links.cta)}" style="display:inline-block;background:${cor};color:#ffffff!important;padding:15px 30px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;font-family:${F}">${esc(ctaTexto)}</a>
    </td></tr>
    <tr><td align="center" style="padding:6px 6px 0">
      <a href="${esc(links.whatsapp)}" style="font-size:13px;color:#047857;font-weight:700;text-decoration:none;font-family:${F}">Prefere conversar? Fale com a gente no WhatsApp &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:22px 28px 26px;font-family:${F}">
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">Um abraço,<br/><strong>Equipe CADBRASIL</strong></p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;font-family:${F}">
    <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#64748b">${
      fornecedor
        ? `Você recebeu este e-mail porque ${esc(destinatario.empresa || 'sua empresa')} consta no cadastro público de fornecedores do governo (Compras.gov.br / PNCP).`
        : `Você recebeu este e-mail porque ${esc(destinatario.empresa || 'sua empresa')} tem cadastro no portal CADBRASIL.`
    }</p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b"><a href="${esc(links.descadastro)}" style="color:#64748b;text-decoration:underline">Não quero mais receber ofertas por e-mail</a></p>
  </td></tr>
</table>
</td></tr></table>
${links.pixel ? `<img src="${esc(links.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0"/>` : ''}
</body></html>`;

  const text = [
    subject,
    '',
    corpoFinal.replace(/^\s*[-•]\s+/gm, '• '),
    '',
    `${ctaTexto}: ${links.cta}`,
    '',
    'Equipe CADBRASIL',
    '',
    `Não quer mais receber ofertas? ${links.descadastro}`,
  ].join('\n');

  return { subject, html, text };
}

function validarConteudo({ assunto, corpo, cta }) {
  if (!String(assunto || '').trim()) return 'Informe o assunto do e-mail';
  if (String(assunto).length > 200) return 'Assunto muito longo (máx. 200 caracteres)';
  if (!String(corpo || '').trim()) return 'Escreva o texto do e-mail';
  if (String(cta || '').length > 60) return 'Texto do botão muito longo (máx. 60 caracteres)';
  return null;
}

async function amostraDestinatario(db, svc, seg, filtros) {
  const [primeiro] = await destinatarios(db, svc, seg, filtros, 1);
  return (
    primeiro || {
      cliente_id: null,
      prospeccao: seg.base === 'fornecedores',
      email: 'cliente@empresa.com.br',
      responsavel: seg.base === 'fornecedores' ? '' : 'Maria Silva',
      empresa: 'Empresa Exemplo Ltda',
      documento: '12345678000190',
      cidade: 'São Paulo',
      uf: 'SP',
    }
  );
}

async function preview({ servico, segmento, uf, assunto, corpo, cta, origem } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const seg = getSegmento(svc, segmento);
  const erro = validarConteudo({ assunto, corpo, cta });
  if (erro) return { ok: false, error: erro };
  const [preco, amostra] = await Promise.all([
    precoServico(db, svc),
    amostraDestinatario(db, svc, seg, normalizarFiltros({ uf })),
  ]);
  const email = montarEmail({
    svc,
    preco,
    assunto,
    corpo,
    cta,
    destinatario: amostra,
    baseUrl: normalizarOrigem(origem),
    envioId: null,
  });
  return {
    ok: true,
    assunto: email.subject,
    html: email.html,
    amostra: { empresa: amostra.empresa, email: amostra.email },
  };
}

async function enviarTeste({ servico, segmento, uf, assunto, corpo, cta, origem, para, usuarioId } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const seg = getSegmento(svc, segmento);
  const erro = validarConteudo({ assunto, corpo, cta });
  if (erro) return { ok: false, error: erro };

  let destino = String(para || '').trim().toLowerCase();
  if (!destino && usuarioId) {
    const u = await db('usuarios').where('id', usuarioId).first('email');
    destino = String(u?.email || '').trim().toLowerCase();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) return { ok: false, error: 'Informe um e-mail válido para o teste' };

  const [preco, amostra] = await Promise.all([
    precoServico(db, svc),
    amostraDestinatario(db, svc, seg, normalizarFiltros({ uf })),
  ]);
  const email = montarEmail({
    svc,
    preco,
    assunto,
    corpo,
    cta,
    destinatario: { ...amostra, email: destino },
    baseUrl: normalizarOrigem(origem),
    envioId: null,
  });
  const emailService = require('./email.service');
  const res = await emailService.send({
    to: destino,
    subject: `[TESTE] ${email.subject}`,
    html: email.html,
    text: email.text,
  });
  if (!res?.ok) return { ok: false, error: res?.error || 'Falha ao enviar o teste' };
  return { ok: true, para: destino };
}

/* ------------------------------------------------------------------ */
/* Campanhas: criação e controle                                       */
/* ------------------------------------------------------------------ */

async function criarCampanha({
  servico,
  segmento,
  uf,
  cooldownDias,
  limite,
  assunto,
  corpo,
  cta,
  agendarPara,
  origem,
  usuarioId,
  rotinaId,
} = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const seg = getSegmento(svc, segmento);
  const erro = validarConteudo({ assunto, corpo, cta });
  if (erro) return { ok: false, error: erro };

  let agendada = null;
  if (agendarPara) {
    const d = new Date(agendarPara);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Data de agendamento inválida' };
    if (d.getTime() > Date.now() + 60000) agendada = d;
  }

  const filtros = normalizarFiltros({ uf, cooldownDias });
  const max = Math.max(0, parseInt(limite, 10) || 0);
  const lista = await destinatarios(db, svc, seg, filtros, max);
  if (!lista.length) return { ok: false, error: 'Nenhum destinatário com e-mail válido neste público' };

  const [campanhaId] = await db(T_CAMPANHAS).insert({
    servico: svc.id,
    segmento: seg.id,
    segmento_nome: seg.nome,
    uf: filtros.uf,
    cooldown_dias: filtros.cooldownDias,
    assunto: String(assunto).trim(),
    corpo: String(corpo),
    cta: String(cta || 'Saiba mais').trim(),
    base_url: normalizarOrigem(origem),
    status: agendada ? 'agendada' : 'enviando',
    total: lista.length,
    agendada_para: agendada ? sqlUtc(agendada) : null,
    iniciada_em: agendada ? null : db.fn.now(),
    criado_por: usuarioId || null,
    rotina_id: rotinaId || null,
  });

  for (let i = 0; i < lista.length; i += 500) {
    await db(T_ENVIOS).insert(
      lista.slice(i, i + 500).map((r) => ({
        campanha_id: campanhaId,
        cliente_id: r.cliente_id || null,
        fornecedor_id: r.fornecedor_id || null,
        email: r.email.slice(0, 190),
        nome: String(r.responsavel || '').slice(0, 190),
        empresa: String(r.empresa || '').slice(0, 255),
        documento: String(r.documento || '').slice(0, 30),
        cidade: String(r.cidade || '').slice(0, 120),
        uf: String(r.uf || '').slice(0, 4),
      })),
    );
  }

  cacheVisao = null;
  console.log(`${LOG_PREFIX} Campanha #${campanhaId} (${svc.id}/${seg.id}) com ${lista.length} destinatário(s)`);
  if (!agendada) setImmediate(() => processarFila().catch(() => {}));
  return { ok: true, campanhaId, total: lista.length, agendada: !!agendada };
}

async function alterarCampanha({ id, acao } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const camp = await db(T_CAMPANHAS).where('id', parseInt(id, 10) || 0).first();
  if (!camp) return { ok: false, error: 'Campanha não encontrada' };

  if (acao === 'pausar') {
    if (!['enviando', 'agendada'].includes(camp.status)) return { ok: false, error: 'Campanha não está em envio' };
    await db(T_CAMPANHAS).where('id', camp.id).update({ status: 'pausada', updated_at: db.fn.now() });
  } else if (acao === 'retomar') {
    if (camp.status !== 'pausada') return { ok: false, error: 'Campanha não está pausada' };
    await db(T_CAMPANHAS)
      .where('id', camp.id)
      .update({ status: 'enviando', iniciada_em: camp.iniciada_em || db.fn.now(), updated_at: db.fn.now() });
    setImmediate(() => processarFila().catch(() => {}));
  } else if (acao === 'cancelar') {
    if (['concluida', 'cancelada'].includes(camp.status)) return { ok: false, error: 'Campanha já finalizada' };
    await db(T_CAMPANHAS)
      .where('id', camp.id)
      .update({ status: 'cancelada', concluida_em: db.fn.now(), updated_at: db.fn.now() });
    await db(T_ENVIOS).where({ campanha_id: camp.id, status: 'pendente' }).update({ status: 'cancelado' });
  } else if (acao === 'reenviar_falhas') {
    if (camp.status === 'cancelada') return { ok: false, error: 'Campanha cancelada' };
    const n = await db(T_ENVIOS)
      .where({ campanha_id: camp.id, status: 'falha' })
      .update({ status: 'pendente', erro: null, lote_token: null, processando_em: null });
    if (!n) return { ok: false, error: 'Nenhuma falha para reenviar' };
    if (camp.status === 'concluida') {
      await db(T_CAMPANHAS)
        .where('id', camp.id)
        .update({ status: 'enviando', concluida_em: null, ultimo_erro: null, updated_at: db.fn.now() });
    } else {
      await db(T_CAMPANHAS).where('id', camp.id).update({ ultimo_erro: null, updated_at: db.fn.now() });
    }
    setImmediate(() => processarFila().catch(() => {}));
    cacheVisao = null;
    return { ok: true, reenfileirados: n };
  } else {
    return { ok: false, error: 'Ação inválida' };
  }
  cacheVisao = null;
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Log ao vivo de uma campanha                                         */
/* ------------------------------------------------------------------ */

async function logCampanha({ id } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const camp = await db(T_CAMPANHAS).where('id', parseInt(id, 10) || 0).first();
  if (!camp) return { ok: false, error: 'Campanha não encontrada' };
  const [[metricas], itens, [[ritmo]]] = await Promise.all([
    metricasCampanhas(db, [camp]),
    db(T_ENVIOS)
      .where('campanha_id', camp.id)
      .whereNot('status', 'pendente')
      .orderBy('id', 'desc')
      .limit(60)
      .select('id', 'email', 'empresa', 'status', 'erro', 'enviado_em', 'processando_em'),
    db.raw(
      `SELECT COUNT(*) AS n,
         TIMESTAMPDIFF(SECOND, (SELECT MAX(COALESCE(enviado_em, processando_em)) FROM ${T_ENVIOS} WHERE campanha_id = ?), NOW()) AS parado_seg
       FROM ${T_ENVIOS}
       WHERE campanha_id = ? AND status = 'enviado' AND enviado_em >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [camp.id, camp.id],
    ),
  ]);

  const parado = ritmo?.parado_seg == null || Number(ritmo.parado_seg) > (INTERVALO_MS / 1000) * 3;
  if (camp.status === 'enviando' && parado && metricas.pendentes > 0 && filaHabilitada()) {
    setImmediate(() => processarFila().catch(() => {}));
  }

  return {
    ok: true,
    campanha: metricas,
    porMinuto: Math.round((Number(ritmo?.n || 0) / 5) * 10) / 10,
    filaNesteServidor: filaHabilitada(),
    itens: itens.map((i) => ({
      id: i.id,
      email: i.email,
      empresa: i.empresa,
      status: i.status,
      erro: i.erro,
      enviadoEm: i.enviado_em || i.processando_em,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Rotinas agendadas (aparecem também no Email Marketing)              */
/* ------------------------------------------------------------------ */

const FREQUENCIAS = ['uma_vez', 'diaria', 'semanal', 'mensal'];

/** O MySQL guarda NOW() em UTC; gravar Date direto usaria o fuso do processo Node. */
function sqlUtc(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Próxima ocorrência estritamente depois de NOW(), mantendo o mesmo horário do dia. */
function proximaExecucaoSql(db, frequencia) {
  if (frequencia === 'diaria') {
    return db.raw(
      'DATE_ADD(proxima_execucao, INTERVAL (FLOOR(GREATEST(TIMESTAMPDIFF(SECOND, proxima_execucao, NOW()), 0) / 86400) + 1) DAY)',
    );
  }
  if (frequencia === 'semanal') {
    return db.raw(
      'DATE_ADD(proxima_execucao, INTERVAL (FLOOR(GREATEST(TIMESTAMPDIFF(SECOND, proxima_execucao, NOW()), 0) / 604800) + 1) * 7 DAY)',
    );
  }
  return db.raw(
    'DATE_ADD(proxima_execucao, INTERVAL (GREATEST(TIMESTAMPDIFF(MONTH, proxima_execucao, NOW()), 0) + 1) MONTH)',
  );
}

function mapRotina(r, ultimasCampanhas = new Map()) {
  const svc = SERVICOS[r.servico];
  return {
    id: r.id,
    nome: r.nome,
    servico: r.servico,
    servicoNome: svc?.nome || r.servico,
    cor: svc?.cor || null,
    segmento: r.segmento,
    segmentoNome: r.segmento_nome,
    uf: r.uf,
    cooldownDias: r.cooldown_dias,
    limite: r.limite,
    assunto: r.assunto,
    frequencia: r.frequencia,
    proximaExecucao: r.ativa ? r.proxima_execucao : null,
    ultimaExecucao: r.ultima_execucao,
    ultimoResultado: r.ultimo_resultado,
    execucoes: r.execucoes,
    ativa: !!r.ativa,
    criadaEm: r.created_at,
    ultimaCampanhaId: ultimasCampanhas.get(r.id) || null,
  };
}

async function listarRotinasDb(db, { servico } = {}) {
  const q = db(T_ROTINAS).orderBy([
    { column: 'ativa', order: 'desc' },
    { column: 'proxima_execucao', order: 'asc' },
  ]);
  if (servico) q.where('servico', servico);
  const rows = await q.limit(200);
  const ultimas = new Map();
  if (rows.length) {
    const camp = await db(T_CAMPANHAS)
      .whereIn(
        'rotina_id',
        rows.map((r) => r.id),
      )
      .groupBy('rotina_id')
      .select('rotina_id')
      .max('id as id');
    for (const c of camp) ultimas.set(c.rotina_id, c.id);
  }
  return rows.map((r) => mapRotina(r, ultimas));
}

async function criarRotina({
  servico,
  segmento,
  uf,
  cooldownDias,
  limite,
  assunto,
  corpo,
  cta,
  nome,
  frequencia,
  primeiraExecucao,
  origem,
  usuarioId,
} = {}) {
  const db = requireDb();
  await ensureTables(db);
  const svc = getServico(servico);
  const seg = getSegmento(svc, segmento);
  const erro = validarConteudo({ assunto, corpo, cta });
  if (erro) return { ok: false, error: erro };
  const freq = FREQUENCIAS.includes(frequencia) ? frequencia : 'uma_vez';

  const quando = primeiraExecucao ? new Date(primeiraExecucao) : new Date();
  if (Number.isNaN(quando.getTime())) return { ok: false, error: 'Data da primeira execução inválida' };
  const imediata = quando.getTime() <= Date.now() + 60000;

  let cooldown = parseInt(cooldownDias, 10) || 0;
  if (freq !== 'uma_vez' && !cooldown) cooldown = 30;
  const filtros = normalizarFiltros({ uf, cooldownDias: cooldown });

  const amostra = await destinatarios(db, svc, seg, filtros, 1);
  if (!amostra.length) return { ok: false, error: 'Nenhum destinatário com e-mail válido neste público hoje' };

  const [rotinaId] = await db(T_ROTINAS).insert({
    nome: String(nome || '').trim().slice(0, 150) || `${svc.nome} — ${seg.nome}`.slice(0, 150),
    servico: svc.id,
    segmento: seg.id,
    segmento_nome: seg.nome,
    uf: filtros.uf,
    cooldown_dias: filtros.cooldownDias,
    limite: Math.max(0, parseInt(limite, 10) || 0),
    assunto: String(assunto).trim(),
    corpo: String(corpo),
    cta: String(cta || 'Saiba mais').trim(),
    base_url: normalizarOrigem(origem),
    frequencia: freq,
    proxima_execucao: imediata ? db.fn.now() : sqlUtc(quando),
    ativa: true,
    criado_por: usuarioId || null,
  });
  console.log(`${LOG_PREFIX} Rotina #${rotinaId} (${svc.id}/${seg.id}, ${freq}) criada`);
  setImmediate(() => processarFila().catch(() => {}));
  return { ok: true, rotinaId, proximaExecucao: imediata ? new Date() : quando };
}

async function executarRotina(db, r) {
  const res = await criarCampanha({
    servico: r.servico,
    segmento: r.segmento,
    uf: r.uf,
    cooldownDias: r.cooldown_dias,
    limite: r.limite,
    assunto: r.assunto,
    corpo: r.corpo,
    cta: r.cta,
    origem: r.base_url,
    usuarioId: r.criado_por,
    rotinaId: r.id,
  }).catch((e) => ({ ok: false, error: e.message }));
  const resultado = res.ok
    ? `Campanha #${res.campanhaId} criada com ${res.total} e-mail(s)`
    : `Não executou: ${res.error || 'erro desconhecido'}`;
  await db(T_ROTINAS)
    .where('id', r.id)
    .update({
      ultima_execucao: db.fn.now(),
      ultimo_resultado: resultado.slice(0, 255),
      execucoes: db.raw('execucoes + 1'),
      updated_at: db.fn.now(),
    });
  return res;
}

let rotinasRodando = false;

async function processarRotinas(db) {
  if (rotinasRodando) return 0;
  rotinasRodando = true;
  let executadas = 0;
  try {
    const vencidas = await db(T_ROTINAS).where('ativa', 1).where('proxima_execucao', '<=', db.fn.now()).limit(20);
    for (const r of vencidas) {
      const unica = r.frequencia === 'uma_vez';
      const reservou = await db(T_ROTINAS)
        .where({ id: r.id, ativa: 1 })
        .where('proxima_execucao', r.proxima_execucao)
        .update(
          unica
            ? { ativa: false, updated_at: db.fn.now() }
            : { proxima_execucao: proximaExecucaoSql(db, r.frequencia), updated_at: db.fn.now() },
        );
      if (!reservou) continue;
      await executarRotina(db, r);
      executadas += 1;
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} Erro nas rotinas:`, e.message);
  } finally {
    rotinasRodando = false;
  }
  return executadas;
}

async function alterarRotina({ id, acao } = {}) {
  const db = requireDb();
  await ensureTables(db);
  const r = await db(T_ROTINAS).where('id', parseInt(id, 10) || 0).first();
  if (!r) return { ok: false, error: 'Rotina não encontrada' };

  if (acao === 'pausar') {
    await db(T_ROTINAS).where('id', r.id).update({ ativa: false, updated_at: db.fn.now() });
  } else if (acao === 'ativar') {
    const [[{ vencida }]] = await db.raw(
      `SELECT proxima_execucao IS NULL OR proxima_execucao < NOW() AS vencida FROM ${T_ROTINAS} WHERE id = ?`,
      [r.id],
    );
    const mudancas = { ativa: true, updated_at: db.fn.now() };
    if (Number(vencida)) {
      mudancas.proxima_execucao =
        r.frequencia === 'uma_vez' || !r.proxima_execucao ? db.fn.now() : proximaExecucaoSql(db, r.frequencia);
    }
    await db(T_ROTINAS).where('id', r.id).update(mudancas);
    setImmediate(() => processarFila().catch(() => {}));
  } else if (acao === 'executar') {
    if (r.frequencia === 'uma_vez') {
      await db(T_ROTINAS).where('id', r.id).update({ ativa: false, updated_at: db.fn.now() });
    }
    const res = await executarRotina(db, r);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, campanhaId: res.campanhaId, total: res.total };
  } else if (acao === 'excluir') {
    await db(T_ROTINAS).where('id', r.id).del();
  } else {
    return { ok: false, error: 'Ação inválida' };
  }
  return { ok: true };
}

async function agenda() {
  const db = requireDb();
  await ensureTables(db);
  const [rotinas, campanhasRows] = await Promise.all([
    listarRotinasDb(db),
    db(T_CAMPANHAS).orderBy('id', 'desc').limit(50),
  ]);
  return { ok: true, rotinas, campanhas: await metricasCampanhas(db, campanhasRows) };
}

/* ------------------------------------------------------------------ */
/* Base de fornecedores (cópia enxuta de `fornecedores`)               */
/* ------------------------------------------------------------------ */

let fornAtualizando = null;

async function statusBaseFornecedores(db) {
  try {
    const [[r]] = await db.raw(
      `SELECT COUNT(*) AS total, SUM(telefone IS NOT NULL AND telefone <> '') AS com_telefone,
         SUM(email LIKE '%_@_%._%') AS com_email, SUM(cliente_id IS NOT NULL) AS ja_clientes,
         MAX(atualizado_em) AS atualizado_em
       FROM ${T_FORN}`,
    );
    return {
      total: Number(r.total || 0),
      comTelefone: Number(r.com_telefone || 0),
      comEmail: Number(r.com_email || 0),
      jaClientes: Number(r.ja_clientes || 0),
      atualizadoEm: r.atualizado_em || null,
      atualizando: !!fornAtualizando,
    };
  } catch (_) {
    return { total: 0, comTelefone: 0, comEmail: 0, jaClientes: 0, atualizadoEm: null, atualizando: !!fornAtualizando };
  }
}

async function executarAtualizacaoFornecedores(db) {
  const inicio = Date.now();
  await db.transaction(async (trx) => {
    await trx.raw(`DELETE FROM ${T_FORN}`);
    await trx.raw(
      `INSERT IGNORE INTO ${T_FORN}
         (id, documento, razao_social, nome_fantasia, porte, uf, municipio, telefone, email, cep, licitante, atualizado_em)
       SELECT f.id, f.cnpj_cpf, LEFT(f.razao_social, 255), LEFT(f.nome_fantasia, 255), LEFT(f.porte, 60),
         UPPER(LEFT(f.uf, 2)), LEFT(f.municipio, 120), LEFT(TRIM(f.telefone), 40),
         CASE WHEN f.email LIKE '%_@_%._%' THEN LOWER(LEFT(TRIM(f.email), 190)) ELSE NULL END,
         LEFT(f.cep, 12),
         EXISTS (SELECT 1 FROM fornecedores_licitacao fl WHERE fl.fornecedor_id = f.id),
         NOW()
       FROM fornecedores f
       WHERE COALESCE(f.ativo, 1) = 1
         AND f.cnpj_cpf IS NOT NULL AND f.cnpj_cpf <> ''
         AND (f.situacao_cadastral IS NULL OR f.situacao_cadastral = 'ATIVA')
         AND ((f.telefone IS NOT NULL AND TRIM(f.telefone) <> '') OR f.email LIKE '%_@_%._%')`,
    );
    await trx.raw(
      `UPDATE ${T_FORN} f
       INNER JOIN (
         SELECT MIN(id) AS id, REPLACE(REPLACE(REPLACE(documento, '.', ''), '/', ''), '-', '') AS doc
         FROM clientes WHERE deleted_at IS NULL AND documento IS NOT NULL AND documento <> ''
         GROUP BY doc
       ) c ON c.doc = f.documento
       SET f.cliente_id = c.id`,
    );
  });
  const status = await statusBaseFornecedores(db);
  console.log(
    `${LOG_PREFIX} Base de fornecedores atualizada: ${status.total} registros (${status.jaClientes} já clientes) em ${Math.round((Date.now() - inicio) / 1000)}s`,
  );
  return status;
}

/** Recria a cópia de fornecedores (com contato) e marca quem já é cliente. */
async function atualizarBaseFornecedores() {
  const db = requireDb();
  await ensureTables(db);
  if (!fornAtualizando) {
    fornAtualizando = executarAtualizacaoFornecedores(db).finally(() => {
      fornAtualizando = null;
      cacheVisao = null;
    });
  }
  const status = await fornAtualizando;
  return { ok: true, fornecedores: { ...status, atualizando: false } };
}

/** Usado pelo cron: atualiza quando a base está vazia ou com mais de 24h. */
async function atualizarBaseFornecedoresSeVencida() {
  const db = getDb();
  if (!db || fornAtualizando) return null;
  await ensureTables(db);
  const status = await statusBaseFornecedores(db);
  const idade = status.atualizadoEm ? Date.now() - new Date(status.atualizadoEm).getTime() : Infinity;
  if (status.total && idade < 24 * 3600 * 1000) return null;
  return atualizarBaseFornecedores();
}

/* ------------------------------------------------------------------ */
/* Fila de envio                                                       */
/* ------------------------------------------------------------------ */

/** Momento em que a rodada atual começou (0 = livre). Trava velha é ignorada. */
let filaRodandoDesde = 0;
let proximaRodada = null;
const precoCache = new Map();

/** Erros de configuração do provedor: não adianta seguir tentando, pausa a campanha. */
const ERRO_CONFIG_EMAIL = /\((401|403|404)\)|API Key|não configurad|não instalado|remetente inválido/i;

function comTimeout(promessa, ms, mensagem) {
  let timer;
  return Promise.race([
    promessa,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, error: mensagem }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function concluirSeTerminou(db, campanhaId) {
  const [[rest]] = await db.raw(
    `SELECT COUNT(*) n FROM ${T_ENVIOS} WHERE campanha_id = ? AND status IN ('pendente','processando')`,
    [campanhaId],
  );
  if (Number(rest.n)) return;
  const n = await db(T_CAMPANHAS)
    .where({ id: campanhaId, status: 'enviando' })
    .update({ status: 'concluida', concluida_em: db.fn.now(), updated_at: db.fn.now() });
  if (n) {
    cacheVisao = null;
    console.log(`${LOG_PREFIX} Campanha #${campanhaId} concluída`);
  }
}

/** Encadeia a próxima rodada no próprio processo — a fila não depende só do cron. */
function agendarProximaRodada(ms = INTERVALO_MS) {
  if (proximaRodada || !filaHabilitada()) return;
  proximaRodada = setTimeout(() => {
    proximaRodada = null;
    processarFila().catch(() => {});
  }, ms);
  if (typeof proximaRodada.unref === 'function') proximaRodada.unref();
}

async function precoCacheado(db, svc) {
  const c = precoCache.get(svc.id);
  if (c && Date.now() - c.em < 300000) return c.preco;
  const preco = await precoServico(db, svc);
  precoCache.set(svc.id, { em: Date.now(), preco });
  return preco;
}

async function processarFila({ lote = LOTE_PADRAO } = {}) {
  if (!filaHabilitada()) return { ok: true, desativada: true };
  if (filaRodandoDesde && Date.now() - filaRodandoDesde < 5 * 60000) return { ok: true, ocupado: true };
  if (filaRodandoDesde) console.warn(`${LOG_PREFIX} Rodada anterior travada há mais de 5 min — liberando a fila`);
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const minhaRodada = Date.now();
  filaRodandoDesde = minhaRodada;
  let enviados = 0;
  let restante = false;
  try {
    await ensureTables(db);
    await processarRotinas(db);

    await db(T_CAMPANHAS)
      .where('status', 'agendada')
      .where('agendada_para', '<=', db.fn.now())
      .update({ status: 'enviando', iniciada_em: db.fn.now(), updated_at: db.fn.now() });

    await db(T_ENVIOS)
      .where('status', 'processando')
      .where('processando_em', '<', db.raw('DATE_SUB(NOW(), INTERVAL 10 MINUTE)'))
      .update({ status: 'pendente', lote_token: null });

    const campanhas = await db(T_CAMPANHAS).where('status', 'enviando').orderBy('id');
    if (!campanhas.length) return { ok: true, enviados: 0 };
    const emailService = require('./email.service');

    for (const camp of campanhas) {
      if (enviados >= lote) break;
      const svc = SERVICOS[camp.servico];
      if (!svc) continue;

      const token = crypto.randomBytes(12).toString('hex');
      await db.raw(
        `UPDATE ${T_ENVIOS} SET status = 'processando', lote_token = ?, processando_em = NOW()
         WHERE campanha_id = ? AND status = 'pendente' ORDER BY id LIMIT ?`,
        [token, camp.id, lote - enviados],
      );
      const itens = await db(T_ENVIOS).where({ campanha_id: camp.id, lote_token: token, status: 'processando' }).orderBy('id');

      if (!itens.length) {
        await concluirSeTerminou(db, camp.id);
        continue;
      }

      const preco = await precoCacheado(db, svc);
      for (const item of itens) {
        const atual = await db(T_CAMPANHAS).where('id', camp.id).first('status');
        if (atual?.status !== 'enviando') {
          await db(T_ENVIOS)
            .where({ campanha_id: camp.id, lote_token: token, status: 'processando' })
            .update({ status: atual?.status === 'cancelada' ? 'cancelado' : 'pendente', lote_token: null });
          break;
        }

        const optout = await db(T_OPTOUT).where('email', item.email).first('id');
        if (optout) {
          await db(T_ENVIOS).where('id', item.id).update({ status: 'cancelado', erro: 'Descadastrado', lote_token: null });
          continue;
        }

        const email = montarEmail({
          svc,
          preco,
          assunto: camp.assunto,
          corpo: camp.corpo,
          cta: camp.cta,
          destinatario: {
            fornecedor_id: item.fornecedor_id,
            email: item.email,
            responsavel: item.nome,
            empresa: item.empresa,
            documento: item.documento,
            cidade: item.cidade,
            uf: item.uf,
          },
          baseUrl: camp.base_url,
          envioId: item.id,
        });

        let res;
        try {
          res = await comTimeout(
            emailService.send({ to: item.email, subject: email.subject, html: email.html, text: email.text }),
            TIMEOUT_ENVIO_MS,
            'O provedor de e-mail não respondeu em 30s',
          );
        } catch (e) {
          res = { ok: false, error: e.message };
        }
        if (res?.ok) {
          await db(T_ENVIOS)
            .where('id', item.id)
            .update({ status: 'enviado', enviado_em: db.fn.now(), erro: null, lote_token: null });
        } else {
          const msg = String(res?.error || 'Falha no envio').slice(0, 450);
          if (ERRO_CONFIG_EMAIL.test(msg)) {
            await db(T_CAMPANHAS)
              .where({ id: camp.id, status: 'enviando' })
              .update({ status: 'pausada', ultimo_erro: `Pausada automaticamente: ${msg}`, updated_at: db.fn.now() });
            await db(T_ENVIOS)
              .where({ campanha_id: camp.id, lote_token: token, status: 'processando' })
              .update({ status: 'pendente', lote_token: null, processando_em: null });
            cacheVisao = null;
            console.warn(`${LOG_PREFIX} Campanha #${camp.id} pausada por erro de configuração do e-mail: ${msg}`);
            break;
          }
          await db(T_ENVIOS).where('id', item.id).update({ status: 'falha', erro: msg, lote_token: null });
          await db(T_CAMPANHAS).where('id', camp.id).update({ ultimo_erro: msg });
        }
        enviados += 1;
      }
      await concluirSeTerminou(db, camp.id);
    }

    const [[pend]] = await db.raw(
      `SELECT COUNT(*) AS n FROM ${T_ENVIOS} e INNER JOIN ${T_CAMPANHAS} k ON k.id = e.campanha_id
       WHERE k.status = 'enviando' AND e.status IN ('pendente', 'processando')`,
    );
    restante = Number(pend?.n || 0) > 0;
    return { ok: true, enviados };
  } catch (e) {
    console.error(`${LOG_PREFIX} Erro na fila:`, e.message);
    restante = true;
    return { ok: false, error: e.message, enviados };
  } finally {
    if (filaRodandoDesde === minhaRodada) filaRodandoDesde = 0;
    if (restante) agendarProximaRodada();
  }
}

/* ------------------------------------------------------------------ */
/* Rastreamento e descadastro (rotas públicas)                         */
/* ------------------------------------------------------------------ */

async function registrarAbertura({ id, token } = {}) {
  const envioId = parseInt(id, 10);
  if (!envioId || !tokenValido(envioId, token)) return { ok: false };
  const db = requireDb();
  await ensureTables(db);
  await db(T_ENVIOS).where('id', envioId).whereNull('aberto_em').update({ aberto_em: db.fn.now() });
  return { ok: true };
}

async function registrarClique({ id, url, token } = {}) {
  const envioId = parseInt(id, 10);
  const destino = String(url || '');
  if (!envioId || !/^https?:\/\//i.test(destino) || !tokenValido(`${envioId}|${destino}`, token)) {
    return { ok: false, destino: baseUrlPadrao() };
  }
  const db = requireDb();
  await ensureTables(db);
  await db(T_ENVIOS).where('id', envioId).whereNull('clicado_em').update({ clicado_em: db.fn.now() });
  await db(T_ENVIOS).where('id', envioId).whereNull('aberto_em').update({ aberto_em: db.fn.now() });
  return { ok: true, destino };
}

async function descadastrar({ email, token } = {}) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !tokenValido(e, token)) return { ok: false, error: 'Link inválido ou expirado' };
  const db = requireDb();
  await ensureTables(db);
  await db(T_OPTOUT).insert({ email: e.slice(0, 190), origem: 'captacao' }).onConflict('email').ignore();
  return { ok: true, email: e };
}

async function emailsDescadastrados(db) {
  try {
    if (!(await db.schema.hasTable(T_OPTOUT))) return new Set();
    const rows = await db(T_OPTOUT).select('email');
    return new Set(rows.map((r) => String(r.email).toLowerCase()));
  } catch (_) {
    return new Set();
  }
}

module.exports = {
  SERVICOS,
  ORDEM_SERVICOS,
  visaoGeral,
  detalhe,
  listarPublico,
  registrarContato,
  exportarPublico,
  preview,
  enviarTeste,
  criarCampanha,
  alterarCampanha,
  logCampanha,
  criarRotina,
  alterarRotina,
  agenda,
  atualizarBaseFornecedores,
  atualizarBaseFornecedoresSeVencida,
  filaHabilitada,
  processarFila,
  registrarAbertura,
  registrarClique,
  descadastrar,
  emailsDescadastrados,
};
