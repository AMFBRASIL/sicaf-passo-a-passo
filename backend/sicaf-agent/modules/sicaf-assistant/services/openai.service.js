/**
 * Serviço de integração com OpenAI.
 * Chat streaming com contexto SICAF + extração de certidões de PDF.
 */
const config = require('../../../config');
const iaConfig = require('../../../services/ia-config.service');
const { CERTIDAO_TIPO_MAP } = require('../constants');

let openai = null;
let _clientKey = '';

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Instruções completas para o assistente IA
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Você é o **Assistente Digital SICAF**, um especialista em:
- Portal SICAF (Sistema de Cadastramento Unificado de Fornecedores)
- Licitações públicas brasileiras (Lei 14.133/2021)
- Cadastro e manutenção de empresas no SICAF
- Certidões, documentos e habilitação

## IDENTIFICAÇÃO DO CLIENTE NO CHAT

No contexto invisível anexado a cada mensagem, você receberá um bloco chamado "CLIENTE QUE ESTÁ NO CHAT AGORA:" com os seguintes dados:
- **Nome:** O nome completo da pessoa que está conversando com você. Use este nome para se referir ao cliente de forma personalizada.
- **CPF/CNPJ:** O documento da pessoa/empresa. É o CPF se for pessoa física ou CNPJ se for empresa.
- **Tipo:** O perfil no SICAF (ex: "Fornecedor Brasileiro").

**REGRAS IMPORTANTES:**
1. **Chame o cliente pelo PRIMEIRO NOME.** Se o nome for "RENATA MACHADO DE CAMPOS", chame de "Renata".
2. **Você SABE o nome e CPF/CNPJ do cliente.** Se ele perguntar "qual meu nome?" ou "qual meu CPF?", responda com os dados que recebeu no contexto.
3. **Use os dados para personalizar as respostas.** Exemplo: "Renata, seu cadastro no Nível III está..." em vez de "O cadastro no Nível III está...".
4. **Nunca diga que não tem acesso ao nome ou CPF do cliente.** Esses dados sempre vêm no contexto da extensão SICAF.

## NÍVEIS SICAF

**Nível I — Credenciamento:**
Dados básicos: CNPJ, razão social, endereço, telefone, e-mail, natureza jurídica, porte da empresa. É o cadastro inicial obrigatório.

**Nível II — Habilitação Jurídica:**
Documentos: Contrato social/estatuto, última alteração consolidada, atas de assembleia (S.A.), decreto de autorização (empresa estrangeira), cédula de identidade dos sócios.

**Nível III — Regularidade Fiscal e Trabalhista Federal:**
Certidões: CND Conjunta Federal (RFB + PGFN), CRF do FGTS, CNDT (Certidão Negativa de Débitos Trabalhistas). O SICAF busca automaticamente online.

**Nível IV — Regularidade Fiscal Estadual/Distrital e Municipal:**
Certidões: Negativa de débitos estaduais (ICMS), negativa de débitos municipais (ISS/IPTU). Precisam ser enviadas manualmente em alguns casos.

**Nível V — Qualificação Técnica:**
Documentos: Registro/inscrição no conselho profissional (CREA, CRM, OAB, etc.), atestados de capacidade técnica emitidos por pessoa jurídica de direito público ou privado.

**Nível VI — Qualificação Econômico-Financeira:**
Documentos: Balanço patrimonial e DRE do último exercício social, certidão negativa de falência/concordata/recuperação judicial. Índices: LG ≥ 1, SG ≥ 1, LC ≥ 1.

## PROCEDIMENTOS COMUNS

- **Renovar certidões:** Muitas são buscadas automaticamente. Se vencida, verificar no órgão emissor e reenviar.
- **Alterar dados:** Menu "Cadastro" → selecionar nível → editar dados → salvar.
- **Enviar documentos:** Upload via portal no nível correspondente (PDF, máx 5MB).
- **Verificar pendências:** Níveis em vermelho = pendente, amarelo = próximo do vencimento, verde = ok.
- **CRC (Certificado de Registro Cadastral):** Emitido quando todos os níveis obrigatórios estão regulares.

## CERTIFICADO DIGITAL PARA O SICAF

O acesso ao SICAF exige **certificado digital** emitido por Autoridade Certificadora credenciada pela ICP-Brasil. Existem dois tipos aceitos:

**Tipo A1 (arquivo):**
- Armazenado em arquivo no computador
- Formatos aceitos: **.pfx** e **.p12**
- Validade: **1 ano**
- Pode ser instalado em vários computadores
- Mais prático para uso diário e automação
- Para usar no SICAF: importar o arquivo .pfx/.p12 no navegador (Chrome/Firefox) ou no sistema operacional

**Tipo A3 (hardware):**
- Armazenado em dispositivo físico: **token USB** ou **cartão inteligente (smart card)**
- Requer instalação de driver/software do fabricante (SafeNet, Gemalto, etc.)
- Validade: **1 a 3 anos**
- Mais seguro pois a chave privada nunca sai do dispositivo
- Para usar no SICAF: conectar o token USB ou inserir o cartão no leitor, instalar os drivers e o certificado será reconhecido automaticamente pelo navegador

**Dicas importantes:**
- O certificado deve ser **e-CNPJ** (pessoa jurídica) para cadastro de empresas
- Certificado **e-CPF** é aceito apenas para representantes legais
- Se o certificado expirar, o acesso ao SICAF será bloqueado até a renovação
- Alguns navegadores exigem reinicialização após instalar/importar o certificado
- O Chrome funciona melhor com certificados A1 (.pfx/.p12) instalados no Windows
- Para A3 com token, verificar se o middleware do fabricante está instalado e atualizado

## ANÁLISE AUTOMÁTICA DE DOCUMENTOS

Quando o cliente enviar um arquivo PDF (Situação do Fornecedor, CRC, ou certidão individual), o sistema automaticamente:

1. **Extrai o texto** do PDF
2. **Identifica o CNPJ** e busca o cliente no sistema CadBrasil
3. **Extrai todas as certidões** com seus dados (emissão, validade, status)
4. **Salva/atualiza as certidões** no banco de dados vinculadas ao cliente
5. **Recalcula os níveis SICAF** (I a VI) e atualiza:
   - Status de cada nível (Válido, Vencendo, Vencido, Pendente)
   - Completude geral do SICAF (percentual)
   - Status geral do cadastro SICAF (Ativo, Vencendo, Vencido, Pendente)

Quando um evento "db-saved" for recebido (aparece como mensagem do sistema), informe ao cliente:
- Quantas certidões foram atualizadas/inseridas
- Quais níveis foram afetados
- Qual o status geral do SICAF após a atualização
- Se houver certidões vencidas ou próximas do vencimento, alerte o cliente
- Use um resumo curto no formato:
  1) **Status geral**
  2) **Pendências encontradas**
  3) **Próxima ação recomendada**

Quando um evento "db-error" for recebido, informe ao cliente sobre o erro e sugira soluções.

**IMPORTANTE:** Ao analisar o documento, o assistente deve:
- Identificar se é um documento de "Situação do Fornecedor" e informar que vai analisar TODOS os níveis
- Alertar sobre certidões vencidas ou próximas do vencimento com ⚠️
- Informar que os dados estão sendo salvos automaticamente no sistema
- Recomendar ações para regularizar pendências

## PROBLEMAS COMUNS E SOLUÇÕES

- **"Certidão vencida":** Renovar no órgão emissor e reenviar ou aguardar consulta automática.
- **"Dados divergentes":** Verificar se CNPJ e razão social estão atualizados na Receita Federal.
- **"Portal instável":** Tentar em horários alternativos (6h-8h ou após 18h).
- **"Erro ao enviar documento":** Verificar formato (PDF) e tamanho (máx 5MB).
- **"Nível não habilitado":** Completar todos os campos obrigatórios do nível.

## SOBRE O SICAF E A CADBRASIL

- O cadastro no SICAF é **GRATUITO**. Não há custo algum para o fornecedor se cadastrar ou manter o cadastro.
- A **Cadbrasil** é uma plataforma completa para fornecedores que participam de licitações governamentais. Vai muito além do SICAF:

### O que a Cadbrasil oferece:

1. **Licitações Governamentais na plataforma** — Acesso fácil e centralizado a editais e oportunidades de licitação diretamente dentro da plataforma, sem precisar navegar em diversos portais.
2. **Análise de Editais por IA** — Inteligência artificial que analisa editais automaticamente, identificando pontos críticos, evitando erros e destacando informações que poderiam passar despercebidas pelo fornecedor.
3. **Gestão de Contratos** — Acompanhamento completo de contratos firmados com órgãos públicos, prazos, aditivos e obrigações contratuais.
4. **Gestão de Certidões** — Monitoramento automático das certidões com alertas de vencimento, garantindo que o fornecedor nunca perca um prazo e fique sempre regular.
5. **Gestão de todo o Processo Licitatório** — Do cadastro SICAF à participação em pregões, tudo gerenciado em um único lugar.
6. **Assistente Virtual IA Gratuito para o SICAF** — Este assistente que está conversando com você agora! Ajuda gratuita com IA para cadastro, manutenção e orientação no SICAF.

- Se o usuário perguntar "o que a Cadbrasil faz?" ou "quais serviços da Cadbrasil?", apresente todos esses itens de forma clara.
- Se o usuário precisar de suporte humano, informe os canais da Cadbrasil:
  - **WhatsApp:** (011) 2122-0202
  - **E-mail:** documentos@fornecedordigital.com.br
- Sempre que o usuário perguntar se o SICAF cobra algo, reforce: "O SICAF é 100% gratuito. A Cadbrasil apenas auxilia no processo."

### Valores e Planos da Cadbrasil

Se o cliente perguntar sobre valores, preços, custos, mensalidade, plano ou serviços pagos da Cadbrasil, apresente os dois itens:

**1. Licença Anual da Plataforma Cadbrasil — R$ 985,00/ano**
A licença anual dá acesso a todas as funcionalidades da plataforma:
- Acesso a licitações governamentais centralizadas
- Análise de editais por IA
- Gestão de contratos
- Gestão de certidões com alertas de vencimento
- Gestão completa do processo licitatório
- Assistente Virtual IA gratuito para o SICAF

**2. Plano de Manutenção SICAF — R$ 155,00/mês (ou R$ 1.860,00/ano)**
Serviço opcional para MANTER o cadastro SICAF sempre atualizado:
- Renovação e manutenção contínua de certidões atualizadas
- Gestão completa de documentos do fornecedor
- Análises jurídicas personalizadas
- Alertas por e-mail e WhatsApp sobre vencimentos
- Suporte prioritário 24/7
- Backup automático de todos os documentos
- Relatórios avançados de situação cadastral
- Contrato de 12 meses

**IMPORTANTE:** O cadastro no SICAF continua sendo 100% GRATUITO. A licença da plataforma Cadbrasil e o plano de manutenção são serviços opcionais que facilitam e automatizam todo o processo para a empresa.

Para contratar ou gerenciar planos, o cliente deve acessar o **Portal do Cliente Cadbrasil:** https://fornecedor.cadbrasil.com.br
Também pode entrar em contato pelo WhatsApp (011) 2122-0202 ou e-mail documentos@fornecedordigital.com.br.
Sempre que falar sobre valores, manutenção, suporte ou serviços da Cadbrasil, lembre o cliente de acessar o Portal do Cliente.

## LEMBRETE IMPORTANTE SOBRE VALIDAÇÃO (SEMPRE incluir)

Sempre que responder perguntas sobre **Nível III, IV, V ou VI**, certidões, renovações, atualizações de documentos, ou procedimentos de habilitação:

Ao final da resposta, inclua **sempre** este lembrete (adapte o texto ao contexto, mas mantenha a essência):

"📋 **Lembrete:** Após realizar qualquer atualização de certidões ou documentos no SICAF, é muito importante que você acesse o portal SICAF, emita o PDF da **Situação do Fornecedor** e envie aqui no assistente. Assim conseguimos validar automaticamente se todas as certidões estão em ordem, verificar as validades e atualizar seu cadastro no sistema CadBrasil."

Variações aceitáveis:
- Se o contexto for sobre certidões vencidas: "Após renovar as certidões, lembre-se de baixar a Situação do Fornecedor no SICAF e anexar aqui para validarmos se tudo ficou regularizado."
- Se for sobre cadastro de nível: "Depois de completar o preenchimento deste nível, puxe a Situação do Fornecedor no SICAF e nos envie o PDF aqui para conferirmos se está tudo certo."
- Se for sobre atualização geral: "Para finalizarmos, baixe o PDF da Situação do Fornecedor no portal SICAF e envie aqui. Nosso sistema vai analisar automaticamente todos os níveis e certidões."

**NÃO** incluir este lembrete em perguntas sobre: Nível I (credenciamento básico), Nível II (habilitação jurídica), informações gerais sobre a Cadbrasil, valores/preços, certificado digital, ou dúvidas que não envolvam certidões/documentos de habilitação.

## REGRA OBRIGATÓRIA — SITUAÇÃO DO FORNECEDOR

Sempre que o cliente pedir qualquer informação sobre **Situação do Fornecedor** (ex.: como acessar, como fazer, como emitir, como baixar, onde fica, como consultar, etc.):

1. Responda com ESTE texto base (pode ajustar apenas pontuação/acentuação, mantendo o conteúdo):

"Para obter a Situação do Fornecedor no portal SICAF, siga estes passos:
1. Acesse o portal SICAF com seu certificado digital.
2. No menu principal, clique em 'Consulta'.
3. Selecione 'Situação do Fornecedor'.
4. Clique em 'Pesquisar' para gerar o documento.
5. Baixe o PDF da Situação do Fornecedor.
6. Após baixar o PDF da situação, faça o upload aqui no chat no botão (Enviar PDF) para que o sistema possa analisar com detalhes e informar possíveis problemas.

Se precisar de ajuda para acessar a página, posso abrir a Situação do Fornecedor para você. É só me avisar!"

2. **NÃO** inclua [AÇÃO: abrir_situacao_fornecedor] nesse caso informativo (como pegar/emitir/baixar).
3. Só inclua [AÇÃO: abrir_situacao_fornecedor] quando o cliente pedir explicitamente para **abrir** a tela.

## REGRAS DE RESPOSTA

1. Seja CONCISO e direto. O painel tem 28% da tela.
2. Use linguagem simples e clara.
3. Quando possível, organize em 3 blocos curtos:
   - **Passos**
   - **Atenção**
   - **Próximo passo**
4. Evite repetir perguntas de CPF/CNPJ se já houver contexto do cliente na conversa.

### REGRA CRÍTICA: SEPARAR PERGUNTAS de AÇÕES

**PERGUNTAS INFORMATIVAS = APENAS TEXTO, SEM AÇÕES:**
Quando o usuário fizer uma PERGUNTA (onde, como, o que, qual, quais, por que, explique, me diga, preciso de, documentos necessários, etc.), responda APENAS com texto explicativo. NÃO inclua nenhuma tag [AÇÃO:]. O usuário quer INFORMAÇÃO, não navegação.

Exemplos de PERGUNTAS (responder SÓ com texto, ZERO ações):
- "Onde colocar os documentos?" → Explique quais documentos vão em cada nível. NÃO clique em nada.
- "O que preciso para Habilitação Jurídica?" → Liste os documentos necessários. NÃO abra o nível.
- "Quais certidões são do Nível III?" → Explique as certidões. NÃO navegue.
- "Como preencher o Nível I?" → Dê instruções passo a passo. NÃO abra o nível.
- "Que documentos preciso?" → Explique por nível. NÃO clique em nenhum.
- "O que é o CRC?" ou "Como obter o meu CRC" → Explique o que é e como obter. NÃO abra.
- "Me explique os níveis" → Descreva cada nível. NÃO abra nenhum.
- "Qual a diferença entre Nível III e IV?" → Explique a diferença. NÃO clique.

**COMANDOS DE AÇÃO = INCLUIR A TAG [AÇÃO:]:**
Inclua ações quando o usuário usar:
- Verbos de comando: "abra", "abrir", "abre", "clique", "clicar", "navegue", "vá para", "entre no", "mostre-me" (no sentido de navegar), "quero acessar", "quero ir para", "quero preencher" (ação de editar).
- Pedidos de ajuda para executar: "preciso de ajuda para abrir", "me ajude a abrir", "me ajude a preencher", "quero ajuda com o nível", "pode abrir pra mim", "ajuda a abrir".
Nestes casos, o cliente quer que a ação seja executada. Abra o nível, explique E inclua a ação.

3. Mapeamento de AÇÕES (usar quando for COMANDO ou PEDIDO DE AJUDA para executar):
   - "Abra o Nível I" / "Preciso de ajuda para abrir o Nível I" / "Me ajude a preencher o cadastro" → [AÇÃO: clicar_nivel_1]
   - "Abra o Nível II" / "Preciso de ajuda com a Habilitação Jurídica" → [AÇÃO: clicar_nivel_2]
   - "Abra o Nível III" / "Me ajude a abrir o Nível III" → [AÇÃO: clicar_nivel_3]
   - "Abra o Nível IV" / "Preciso de ajuda com o Nível IV" → [AÇÃO: clicar_nivel_4]
   - "Abra o Nível V" / "Me ajude com Qualificação Técnica" → [AÇÃO: clicar_nivel_5]
   - "Abra o Nível VI" / "Preciso de ajuda para abrir o Nível VI" → [AÇÃO: clicar_nivel_6]
   - "Abra o CRC" / "Quero ver o CRC" → [AÇÃO: abrir_crc]
   - "Abra a Situação do Fornecedor" / "Pode abrir a Situação do Fornecedor" / "Quero que você abra a Situação do Fornecedor" → [AÇÃO: abrir_situacao_fornecedor]
   **IMPORTANTE sobre Situação do Fornecedor:** pedidos informativos ("como pegar", "como baixar", "como emitir", "onde fica", "como consultar") devem receber apenas instruções em texto e orientação para clicar em (Enviar PDF). Só execute [AÇÃO: abrir_situacao_fornecedor] quando houver pedido explícito para abrir a tela.
   - [AÇÃO: clicar_nivel_1] — Abre o menu Cadastro
   - [AÇÃO: navegar_consulta] — Abre o menu Consulta
   - [AÇÃO: navegar_seguranca] — Abre o menu Segurança
   - [AÇÃO: navegar_sicaf] — Volta para a página inicial do SICAF
   - [AÇÃO: atualizar_sicaf] — Atualiza os níveis SICAF automaticamente

4. **REGRA DE OURO:** Na DÚVIDA se é pergunta ou ação, trate como PERGUNTA (só texto). É MUITO melhor não clicar do que clicar sem o usuário pedir. O usuário pode sempre pedir "agora abra o nível X" se quiser navegar.

5. **NUNCA** inclua mais de UMA ação por resposta, a menos que o usuário peça explicitamente para abrir múltiplos níveis. Se o usuário pedir para abrir "todos os níveis" ou "o cadastro completo", abra APENAS o Nível I com [AÇÃO: clicar_nivel_1].

6. Considere o contexto da tela que o usuário está vendo.
7. Se não souber, diga honestamente.
8. Se detectar frustração (ex.: "não funcionou", "de novo erro", "não entendi", "está em loop"), mantenha calma, simplifique em 1-2 passos e ofereça suporte humano:
   - WhatsApp: (011) 2122-0202
   - E-mail: documentos@fornecedordigital.com.br
   Sempre inclua um resumo curto do problema entendido antes de oferecer escalonamento.
`;

async function ensureOpenAI(forceRefresh = false) {
  const rt = await iaConfig.getIaRuntime(forceRefresh);
  if (rt.provider !== 'openai') {
    openai = null;
    _clientKey = '';
    return false;
  }
  if (!rt.apiKey) {
    openai = null;
    _clientKey = '';
    return false;
  }
  if (openai && _clientKey === rt.apiKey) return true;
  try {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: rt.apiKey });
    _clientKey = rt.apiKey;
    return true;
  } catch (e) {
    console.log(`  ⚠ Erro ao inicializar OpenAI: ${e.message}`);
    openai = null;
    _clientKey = '';
    return false;
  }
}

function initOpenAI() {
  ensureOpenAI()
    .then((ok) => {
      if (ok) {
        return iaConfig.getIaRuntime().then((rt) => {
          console.log(`  ✔ OpenAI configurada (modelo: ${rt.model}, fonte: ${rt.source || 'env'})`);
        });
      }
      console.log('  ⚠ IA não configurada (defina ia_api_key no banco ou OPENAI_API_KEY no .env)');
    })
    .catch(() => {});
  return true;
}

function reinitFromDb() {
  _clientKey = '';
  openai = null;
  iaConfig.invalidateIaConfigCache();
  return ensureOpenAI(true);
}

async function getRuntimeParams() {
  const rt = await iaConfig.getIaRuntime();
  return {
    model: rt.model,
    max_tokens: rt.maxTokens,
    temperature: rt.temperature,
  };
}

async function getSystemPrompt() {
  const rt = await iaConfig.getIaRuntime();
  return rt.systemPrompt || SYSTEM_PROMPT;
}

function getOpenAI() {
  return openai;
}

/** @deprecated Stateless — histórico vem do frontend */
function getChatHistory() { return []; }
/** @deprecated Stateless — nada a limpar */
function resetChatHistory() { }

/**
 * Pós-processa a resposta da IA para garantir que Níveis I e II
 * apareçam como "Habilitado" em análises de Situação do Fornecedor.
 */
function fixNiveisIeII(text, validadeCadastro) {
  const lines = text.split('\n');
  const result = [];
  let skipUntilNextLevel = false;

  for (const line of lines) {
    if (/N[ií]vel\s+I\s*[—–-]\s*Credenciamento/i.test(line)) {
      result.push(line.replace(/[❌⚪⚠️🔴🟡].+$/, '✅ Habilitado').replace(/Regular/, 'Habilitado').replace(/Pend[êe]ncia/, 'Habilitado'));
      result.push('• Credenciamento ativo (pré-requisito obrigatório do SICAF)');
      if (validadeCadastro) result.push(`• Validade do cadastro: ${validadeCadastro}`);
      result.push('');
      skipUntilNextLevel = true;
      continue;
    }

    if (/N[ií]vel\s+II\s*[—–-]\s*Habilita/i.test(line)) {
      result.push(line.replace(/[❌⚪⚠️🔴🟡].+$/, '✅ Habilitado').replace(/Regular/, 'Habilitado').replace(/Pend[êe]ncia/, 'Habilitado'));
      result.push('• Habilitação jurídica ativa (pré-requisito obrigatório do SICAF)');
      result.push('');
      skipUntilNextLevel = true;
      continue;
    }

    if (/N[ií]vel\s+(III|IV|V|VI)\s*[—–-]/i.test(line)) {
      skipUntilNextLevel = false;
    }

    if (!skipUntilNextLevel) {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Gera resposta do chat IA com streaming (STATELESS — sem estado no servidor).
 * @param {string} message - Mensagem do usuário
 * @param {Object} pageState - Estado atual da página SICAF (url, text, step)
 * @param {http.ServerResponse} res - Response para streaming SSE
 * @param {Function} onActions - Callback chamado com ações extraídas
 * @param {Array} clientHistory - Histórico de conversa vindo do frontend (stateless)
 */
async function streamChatResponse(message, pageState, res, onActions, clientHistory) {
  const ready = await ensureOpenAI();
  if (!ready || !openai) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: ' + JSON.stringify({ done: true, fullText: '⚠ IA não configurada. Configure em Admin → Configurações → Inteligência Artificial.' }) + '\n\n');
    res.end();
    return;
  }

  // Montar contexto da tela SICAF (invisível para o cliente, apenas para a IA)
  let contextStr = '';
  if (pageState.text) {
    contextStr = `\n\n---\n[CONTEXTO INVISÍVEL — Dados da tela SICAF que o cliente está vendo agora. Use estas informações para responder de acordo com os dados abaixo. O cliente NÃO vê este bloco.]\n[Tela: ${pageState.step}]\n[URL: ${pageState.url}]\n${pageState.text.substring(0, 1500)}\n---`;
  } else if (pageState.url) {
    contextStr = `\n\n[Tela: ${pageState.step}] [URL: ${pageState.url}]`;
  }

  // Montar mensagens: system + histórico do frontend + mensagem atual com contexto
  const history = Array.isArray(clientHistory) ? clientHistory.slice(-18) : [];
  const userMessageWithContext = message + contextStr;
  const systemPrompt = await getSystemPrompt();
  const params = await getRuntimeParams();
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessageWithContext },
  ];

  // ── Debug: logar o que está sendo enviado para a OpenAI ──
  console.log('  [OpenAI] ──────────────────────────────────────');
  console.log(`  [OpenAI] Mensagem: "${message}"`);
  console.log(`  [OpenAI] pageState.text: "${(pageState.text || '').substring(0, 120)}"`);
  console.log(`  [OpenAI] pageState.url: "${pageState.url}"`);
  console.log(`  [OpenAI] Histórico: ${history.length} mensagens`);
  console.log(`  [OpenAI] Contexto anexado: ${contextStr ? 'SIM (' + contextStr.length + ' chars)' : 'NÃO (vazio)'}`);
  console.log(`  [OpenAI] Última msg completa: "${userMessageWithContext.substring(0, 200)}..."`);
  console.log('  [OpenAI] ──────────────────────────────────────');

  const stream = await openai.chat.completions.create({
    model: params.model,
    messages,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    stream: true,
  });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let fullReply = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullReply += content;
      res.write('data: ' + JSON.stringify({ chunk: content }) + '\n\n');
    }
  }

  // Extrair ações
  const actionMatches = fullReply.match(/\[AÇÃO:\s*(.+?)\]/g);
  const actions = actionMatches ? actionMatches.map((a) => a.match(/\[AÇÃO:\s*(.+?)\]/)[1].trim()) : [];
  let cleanReply = fullReply.replace(/\[AÇÃO:\s*.+?\]/g, '').trim();

  const isSituacaoReply = /Situa[çc][ãa]o do Fornecedor/i.test(message);
  if (isSituacaoReply && /N[ií]vel\s+I\b/i.test(cleanReply)) {
    const validMatch = message.match(/Validade do cadastro:\s*(\d{2}\/\d{2}\/\d{4})/);
    const valCad = validMatch ? validMatch[1] : null;
    cleanReply = fixNiveisIeII(cleanReply, valCad);
  }

  res.write('data: ' + JSON.stringify({ done: true, fullText: cleanReply, actions }) + '\n\n');
  res.write('data: [DONE]\n\n');
  res.end();

  // Executar ações no SICAF
  if (actions.length && onActions) {
    onActions(actions);
  }
}

/**
 * Versão async-generator para Next.js App Router (SSE via ReadableStream).
 */
async function* streamChatEvents(message, pageState, clientHistory) {
  const ready = await ensureOpenAI();
  if (!ready || !openai) {
    yield {
      done: true,
      fullText: '⚠ IA não configurada. Configure em Admin → Configurações → Inteligência Artificial.',
    };
    return;
  }

  let contextStr = '';
  if (pageState.text) {
    contextStr = `\n\n---\n[CONTEXTO INVISÍVEL — Dados da tela SICAF que o cliente está vendo agora. Use estas informações para responder de acordo com os dados abaixo. O cliente NÃO vê este bloco.]\n[Tela: ${pageState.step}]\n[URL: ${pageState.url}]\n${pageState.text.substring(0, 1500)}\n---`;
  } else if (pageState.url) {
    contextStr = `\n\n[Tela: ${pageState.step}] [URL: ${pageState.url}]`;
  }

  const history = Array.isArray(clientHistory) ? clientHistory.slice(-18) : [];
  const userMessageWithContext = message + contextStr;
  const systemPrompt = await getSystemPrompt();
  const params = await getRuntimeParams();
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessageWithContext },
  ];

  const stream = await openai.chat.completions.create({
    model: params.model,
    messages,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    stream: true,
  });

  let fullReply = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullReply += content;
      yield { chunk: content };
    }
  }

  const actionMatches = fullReply.match(/\[AÇÃO:\s*(.+?)\]/g);
  const actions = actionMatches
    ? actionMatches.map((a) => a.match(/\[AÇÃO:\s*(.+?)\]/)[1].trim())
    : [];
  let cleanReply = fullReply.replace(/\[AÇÃO:\s*.+?\]/g, '').trim();

  const isSituacaoReply = /Situa[çc][ãa]o do Fornecedor/i.test(message);
  if (isSituacaoReply && /N[ií]vel\s+I\b/i.test(cleanReply)) {
    const validMatch = message.match(/Validade do cadastro:\s*(\d{2}\/\d{2}\/\d{4})/);
    const valCad = validMatch ? validMatch[1] : null;
    cleanReply = fixNiveisIeII(cleanReply, valCad);
  }

  yield { done: true, fullText: cleanReply, actions };
}

/**
 * Extrai dados estruturados (JSON) do texto do PDF via OpenAI.
 * Reconhece "Situação do Fornecedor", CRC e certidões individuais.
 * @param {string} pdfText - Texto extraído do PDF
 * @returns {Object|null} { cnpj, razao_social, tipo_documento, niveis_sicaf, certidoes: [...] }
 */
async function extractCertidoesJSON(pdfText) {
  const ready = await ensureOpenAI();
  if (!ready || !openai) return null;

  const jsonPrompt = `Analise o texto abaixo extraído de um documento SICAF e retorne SOMENTE um JSON válido (sem markdown, sem \`\`\`, sem texto extra) com esta estrutura:

{
  "cnpj": "00.000.000/0000-00 ou null se for pessoa física (CPF)",
  "cpf": "000.000.000-00 ou null se for pessoa jurídica (CNPJ)",
  "documento": "CPF ou CNPJ principal do fornecedor no documento (obrigatório)",
  "razao_social": "NOME DA EMPRESA OU NOME DO FORNECEDOR PF",
  "tipo_documento": "Situação do Fornecedor|CRC|Certidão Individual",
  "niveis_sicaf": {
    "I": { "situacao": "Regular|Vencido|Pendente|Não habilitado", "descricao": "Credenciamento", "validade": "DD/MM/YYYY ou null" },
    "II": { "situacao": "Regular|Vencido|Pendente|Não habilitado", "descricao": "Habilitação Jurídica", "validade": "DD/MM/YYYY ou null" },
    "III": { "situacao": "Regular|Vencido|Pendente|Não habilitado", "descricao": "Regularidade Fiscal Federal", "validade": "DD/MM/YYYY ou null" },
    "IV": { "situacao": "Regular|Vencido|Pendente|Não habilitado", "descricao": "Regularidade Fiscal Estadual/Municipal", "validade": "DD/MM/YYYY ou null" },
    "V": { "situacao": "Regular|Vencido|Pendente|Não habilitado", "descricao": "Qualificação Técnica", "validade": "DD/MM/YYYY ou null" },
    "VI": { "situacao": "Regular|Vencido|Pendente|Não habilitado", "descricao": "Qualificação Econômico-Financeira", "validade": "DD/MM/YYYY ou null" }
  },
  "certidoes": [
    {
      "nome": "Nome da certidão",
      "situacao": "Regular|Vencida|Possui Pendência|Negativa|Positiva com efeito negativa",
      "data_emissao": "DD/MM/YYYY ou null",
      "data_validade": "DD/MM/YYYY ou null",
      "orgao_emissor": "Nome do órgão",
      "nivel_sicaf": "I|II|III|IV|V|VI ou null",
      "tipo_consulta": "Automática|Manual|null"
    }
  ]
}

REGRAS IMPORTANTES:
1. Extraia o documento principal do fornecedor: use "cpf" para pessoa física (11 dígitos) ou "cnpj" para pessoa jurídica (14 dígitos). Preencha também "documento" com o mesmo valor formatado.
2. O CNPJ deve ser extraído EXATAMENTE como aparece no documento, com formatação (00.000.000/0000-00), quando for PJ.
3. O CPF deve ser extraído EXATAMENTE como aparece (000.000.000-00), quando for PF.
4. Para o campo "niveis_sicaf": analise o documento e determine o status de CADA nível SICAF:
   - "Regular" = nível completo, válido, SEM pendências
   - "Vencido" = nível com documentos vencidos
   - "Pendente" = nível com pendências. ATENÇÃO: se o texto do nível contém "(Possui Pendência)" ou "Pendência", a situação DEVE ser "Pendente", NUNCA "Regular" ou outro valor
   - "Não habilitado" = nível não mencionado E não listado como cabeçalho no documento
   - O campo "descricao" deve incluir a informação de pendência quando houver. Ex: "Habilitação Jurídica (Possui Pendência)"
   - O campo "validade" deve ser a data de validade do nível (se informada no documento)
3. REGRA CRÍTICA: Leia o texto de cada nível com atenção. No documento SICAF, cada nível pode ter "(Possui Pendência)" ao lado do nome. Exemplo:
   "II - Habilitação Jurídica (Possui Pendência)" → situacao DEVE ser "Pendente"
   "IV - Regularidade Fiscal Estadual/Distrital e Municipal (Possui Pendência)" → situacao DEVE ser "Pendente"
   Mesmo que as certidões individuais dentro do nível estejam válidas, se o nível como um todo diz "(Possui Pendência)", a situação é "Pendente".
4. Para cada certidão, identifique a qual nível SICAF ela pertence (I a VI)
5. Se o documento é uma "Situação do Fornecedor", ele geralmente lista TODOS os níveis e certidões. Extraia TUDO.
6. REGRA CRÍTICA PARA NÍVEIS I E II NA SITUAÇÃO DO FORNECEDOR: Se o documento é do tipo "Situação do Fornecedor", os Níveis I (Credenciamento) e II (Habilitação Jurídica) SEMPRE existem — o simples fato de o fornecedor possuir a Situação do Fornecedor significa que ele está credenciado. Portanto:
   - Se o documento lista "I - Credenciamento" como cabeçalho (mesmo sem certidões individuais detalhadas abaixo), marque como "Regular" com descricao "Credenciamento"
   - Se o documento lista "II - Habilitação Jurídica" ou "II - Habilitação Juridica" como cabeçalho (mesmo sem certidões individuais detalhadas abaixo), marque como "Regular" com descricao "Habilitação Jurídica"
   - NUNCA marque I ou II como "Não habilitado" em documentos do tipo Situação do Fornecedor. Eles são pré-requisitos obrigatórios.
   - Se o campo "Situação do Fornecedor" diz "Credenciado", isso confirma que I e II estão ativos.
   - A validade de I deve ser a "Data de Vencimento do Cadastro" informada no cabeçalho do documento (ex: 24/09/2026).
   EXEMPLO REAL: o texto "I - Credenciamento" seguido de "II - Habilitação Juridica" sem certidões listadas abaixo = ambos "Regular".
7. Para níveis V e VI: se aparecem como cabeçalho no documento mas SEM certidões detalhadas nem validade, marque como "Regular" com descricao correspondente. Se NÃO aparecem sequer como cabeçalho, marque como "Não habilitado".
8. Extraia as datas exatamente como aparecem no documento
9. O campo "tipo_consulta" indica se a certidão é obtida automaticamente pelo SICAF ("Automática") ou enviada manualmente pelo fornecedor ("Manual"). Se não souber, use null.
10. Para o Nível I (Credenciamento), mesmo sem certidões individuais, extraia a validade geral do credenciamento se informada no documento.
11. LEGENDA DO PDF SICAF: quando uma data aparece com asterisco "(*)" ao lado (ex: "Validade: 02/07/2025 (*)"), significa PRAZO VENCIDO. Marque a certidão como "Vencida" e o nível correspondente como "Pendente" ou "Vencido".
12. Se o cabeçalho do nível contém "(Possui Pendência)" — ex: "IV - Regularidade Fiscal Estadual/Distrital e Municipal (Possui Pendência)" — o nível INTEIRO está pendente, mesmo que alguma certidão pareça válida.
13. Analise TODOS os 6 níveis (I a VI). Para cada nível listado no documento, informe situacao. Níveis sem pendência = "Regular".
14. Extraia cada certidão/documento listado abaixo dos níveis III, IV, V e VI com nome, validade, tipo (Automática/Manual) e se está vencida.
15. "Ocorrências e Impedimentos" com "Nada Consta" não elimina pendências nos níveis — verifique os níveis cadastrados.

TEXTO DO DOCUMENTO:
${pdfText.substring(0, 6000)}`;

  try {
    const params = await getRuntimeParams();
    const resp = await openai.chat.completions.create({
      model: params.model,
      messages: [
        { role: 'system', content: 'Você extrai dados estruturados de documentos SICAF brasileiros. Retorne SOMENTE JSON válido, sem nenhum texto adicional. Seja preciso com CPFs, CNPJs, datas e status.' },
        { role: 'user', content: jsonPrompt },
      ],
      max_tokens: Math.min(2000, params.max_tokens),
      temperature: 0.1,
    });
    const text = (resp.choices[0]?.message?.content || '').trim();
    const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    const isSituacaoFornecedor = parsed && (
      /Situa[çc][ãa]o do Fornecedor/i.test(parsed.tipo_documento || '') ||
      /Situa[çc][ãa]o do Fornecedor/i.test(pdfText)
    );

    if (isSituacaoFornecedor) {
      parsed.tipo_documento = 'Situação do Fornecedor';
      if (parsed.niveis_sicaf) {
        const dateMatch = pdfText.match(/Data de Vencimento do Cadastro[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
        const validadeCadastro = dateMatch ? dateMatch[1] : null;

        if (!parsed.niveis_sicaf['I'] || parsed.niveis_sicaf['I'].situacao === 'Não habilitado') {
          parsed.niveis_sicaf['I'] = { situacao: 'Regular', descricao: 'Credenciamento', validade: validadeCadastro };
        }
        if (parsed.niveis_sicaf['I'].situacao !== 'Pendente') {
          parsed.niveis_sicaf['I'].situacao = 'Regular';
        }
        if (validadeCadastro && !parsed.niveis_sicaf['I'].validade) {
          parsed.niveis_sicaf['I'].validade = validadeCadastro;
        }

        if (!parsed.niveis_sicaf['II'] || parsed.niveis_sicaf['II'].situacao === 'Não habilitado') {
          parsed.niveis_sicaf['II'] = { situacao: 'Regular', descricao: 'Habilitação Jurídica', validade: null };
        }
        if (parsed.niveis_sicaf['II'].situacao !== 'Pendente') {
          parsed.niveis_sicaf['II'].situacao = 'Regular';
        }

        const hasV = /(?:^|\n|\r|\s)V\s*[-–]\s*Qualifica[çc][aã]o\s+T[eé]cnica/i.test(pdfText);
        const hasVI = /(?:^|\n|\r|\s)VI\s*[-–]\s*Qualifica[çc][aã]o\s+Econ[oô]mico[-\s]?Financeira/i.test(pdfText);
        if (hasV) {
          parsed.niveis_sicaf['V'] = {
            situacao: parsed.niveis_sicaf['V']?.situacao === 'Pendente' ? 'Pendente' : 'Regular',
            descricao: parsed.niveis_sicaf['V']?.descricao || 'Qualificação Técnica',
            validade: parsed.niveis_sicaf['V']?.validade || null,
          };
        }
        if (hasVI) {
          const viValidade = extractNivelVIValidade(pdfText);
          parsed.niveis_sicaf['VI'] = {
            situacao: parsed.niveis_sicaf['VI']?.situacao === 'Pendente' ? 'Pendente' : 'Regular',
            descricao: parsed.niveis_sicaf['VI']?.descricao || 'Qualificação Econômico-Financeira',
            validade: parsed.niveis_sicaf['VI']?.validade || viValidade || null,
          };
        }
        console.log('  [DB] Pós-processamento Situação do Fornecedor: níveis por cabeçalho regularizados');
      }
    }

    const enriched = enrichSicafJsonFromText(parsed, pdfText);
    try {
      const { applyDocumentoToPdfJson } = require('../../../services/client-access.service');
      applyDocumentoToPdfJson(enriched, pdfText);
    } catch (_) {}
    return enriched;
  } catch (e) {
    console.log(`  [DB] Erro ao extrair JSON: ${e.message.substring(0, 60)}`);
    return null;
  }
}

const NIVEL_NOMES = {
  I: 'Credenciamento',
  II: 'Habilitação Jurídica',
  III: 'Regularidade Fiscal e Trabalhista Federal',
  IV: 'Regularidade Fiscal Estadual/Distrital e Municipal',
  V: 'Qualificação Técnica',
  VI: 'Qualificação Econômico-Financeira',
};

function parseBrDate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateExpired(dateStr, refDate = new Date()) {
  const d = parseBrDate(dateStr);
  if (!d) return false;
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Extrai validade do Nível VI no PDF Situação do Fornecedor.
 * O SICAF pode exibir a data em formatos diferentes:
 *   - "Validade: 30/06/2027" (clássico)
 *   - "30/06/2027\tValidade:" (coluna invertida — comum no PDF oficial)
 *   - data sozinha na linha após o cabeçalho VI
 */
function extractNivelVIValidade(pdfText) {
  if (!pdfText) return null;
  const text = normalizeSituacaoPdfText(pdfText);

  const patterns = [
    // Coluna invertida: data antes de "Validade:" na linha seguinte ao cabeçalho VI
    /VI\s*[-–][^\n]*Qualifica[çc][ãa]o\s+Econ[oô]mico[^\n]*\n\s*(\d{2}\/\d{2}\/\d{4})\s*(?:\t|\s)*(?:Validade:)?/i,
    // Clássico: Validade: DD/MM/YYYY na linha após cabeçalho VI
    /VI\s*[-–][^\n]*Qualifica[çc][ãa]o\s+Econ[oô]mico[^\n]*\n[^\n]*Validade:\s*(\d{2}\/\d{2}\/\d{4})/i,
    // Data isolada na linha seguinte ao cabeçalho VI
    /VI\s*[-–][^\n]*Qualifica[çc][ãa]o\s+Econ[oô]mico[^\n]*\n\s*(\d{2}\/\d{2}\/\d{4})/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function isNivelVIDateExpired(pdfText, dataValidade) {
  if (!dataValidade) return false;
  if (pdfText.includes(`${dataValidade} (*)`)) return true;
  if (pdfText.includes(`Validade: ${dataValidade} (*)`)) return true;
  return isDateExpired(dataValidade);
}

function guessNivelFromCertName(nome) {
  const n = String(nome || '').toLowerCase();
  if (/receita federal|pgfn|fgts|trabalhista|cndt|cnd conjunta/.test(n)) return 'III';
  if (/receita estadual|receita distrital|receita municipal|icms|iss|iptu/.test(n)) return 'IV';
  if (/balan[çc]o|dre|fal[êe]ncia|concordata|recupera[çc][ãa]o|econ[oô]mico|financeir/.test(n)) return 'VI';
  if (/crea|crm|oab|atestado|t[eé]cnica|conselho/.test(n)) return 'V';
  if (/contrato social|estatuto|habilita[çc][ãa]o jur[ií]dica/.test(n)) return 'II';
  return null;
}

function mapCertidaoCodigoFromNome(nome) {
  const lower = String(nome || '').toLowerCase();
  for (const [key, val] of Object.entries(CERTIDAO_TIPO_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'outro';
}

/** Normaliza texto extraído do PDF SICAF (remove colagem nome+data). */
function normalizeSituacaoPdfText(text) {
  return String(text || '')
    .replace(/([A-Za-zÀ-ÿ])(\d{2}\/\d{2}\/\d{4})/g, '$1 $2')
    .replace(/Validade:\s*(\d{2}\/\d{2}\/\d{4})/gi, 'Validade: $1')
    .replace(/(\d{4})(Autom[aá]tica|Manual)/gi, '$1 $2');
}

/**
 * Extrai TODAS as certidões com validade do PDF Situação do Fornecedor (oficial SICAF).
 * Inclui certidões válidas e vencidas — fonte de verdade para alimentar a tabela certidoes.
 */
function extractCertidoesSituacaoFornecedor(pdfText) {
  if (!pdfText) return [];
  const normalized = normalizeSituacaoPdfText(pdfText);
  const results = [];
  const seen = new Set();

  const push = (nome, dataValidade, hasAsterisk, tipoConsulta) => {
    if (!nome || !dataValidade) return;
    const codigo = mapCertidaoCodigoFromNome(nome);
    const key = `${codigo}::${dataValidade}`;
    if (seen.has(key)) return;
    seen.add(key);

    const vencida = hasAsterisk || isDateExpired(dataValidade);
    const nivel = guessNivelFromCertName(nome);
    results.push({
      nome: String(nome).trim().replace(/\s+/g, ' '),
      situacao: vencida
        ? hasAsterisk
          ? 'Vencida (marcada com *)'
          : 'Vencida'
        : 'Válida',
      data_validade: dataValidade,
      nivel_sicaf: nivel,
      orgao_emissor: null,
      tipo_consulta: tipoConsulta || null,
      fonte: 'Situação do Fornecedor SICAF',
    });
  };

  // Formato: "Nome Validade: DD/MM/YYYY (Automática|Manual)"
  const validadeRe =
    /(Receita\s+Federal(?:\s+e\s+PGFN)?|FGTS|Trabalhista|Receita\s+Estadual(?:\/Distrital)?|Receita\s+Municipal|PGFN|Balan[çc]o(?:\s+Patrimonial)?|DRE|Certid[ãa]o[^\n:]{0,40})[^\n]*?Validade:\s*(\d{2}\/\d{2}\/\d{4})(?:\s*\((\*)\))?[^\n]*(?:\((Autom[aá]tica|Manual)\))?/gi;
  let m;
  while ((m = validadeRe.exec(normalized)) !== null) {
    push(m[1], m[2], !!m[3], m[4]);
  }

  // Formato SICAF sem "Validade:" — data logo após o nome (ex: "FGTS 08/07/2026 Automática")
  const inlineRe =
    /^(Receita\s+Federal(?:\s+e\s+PGFN)?|FGTS|Trabalhista|Receita\s+Estadual(?:\/Distrital)?|Receita\s+Municipal)\s+(\d{2}\/\d{2}\/\d{4})(?:\s*\((\*)\))?(?:\s+(Autom[aá]tica|Manual))?/gim;
  while ((m = inlineRe.exec(normalized)) !== null) {
    push(m[1], m[2], !!m[3], m[4]);
  }

  // Balanço / Nível VI (layout colunar)
  const viValidade = extractNivelVIValidade(normalized);
  if (viValidade) {
    const vencida = isNivelVIDateExpired(normalized, viValidade);
    push('Balanço Patrimonial', viValidade, vencida && pdfText.includes(`${viValidade} (*)`), 'Manual');
  }

  return results;
}

function upsertCertidaoInJson(jsonData, cert) {
  if (!jsonData.certidoes) jsonData.certidoes = [];
  const codigo = mapCertidaoCodigoFromNome(cert.nome);
  const idx = jsonData.certidoes.findIndex((c) => {
    const cCodigo = mapCertidaoCodigoFromNome(c.nome);
    if (codigo !== 'outro' && cCodigo === codigo) return true;
    return String(c.nome || '').toLowerCase().trim() === String(cert.nome || '').toLowerCase().trim();
  });
  if (idx >= 0) {
    jsonData.certidoes[idx] = { ...jsonData.certidoes[idx], ...cert };
  } else {
    jsonData.certidoes.push(cert);
  }
}

/**
 * Reforça níveis e certidões a partir do texto bruto do PDF (asterisco *, Possui Pendência, datas).
 */
function enrichSicafJsonFromText(jsonData, pdfText) {
  if (!jsonData || !pdfText) return jsonData;
  if (!jsonData.niveis_sicaf) jsonData.niveis_sicaf = {};
  if (!jsonData.certidoes) jsonData.certidoes = [];

  const text = normalizeSituacaoPdfText(pdfText);

  // Cabeçalhos de nível com "(Possui Pendência)"
  const pendenciaHeaderRe =
    /^(I|II|III|IV|V|VI)\s*[-–][^\n]*(?:\(Possui\s+Pend[êe]ncia\)|Possui\s+Pend[êe]ncia)/gim;
  let m;
  while ((m = pendenciaHeaderRe.exec(text)) !== null) {
    const nivel = m[1];
    const descricao = `${NIVEL_NOMES[nivel] || `Nível ${nivel}`} (Possui Pendência)`;
    jsonData.niveis_sicaf[nivel] = {
      ...(jsonData.niveis_sicaf[nivel] || {}),
      situacao: 'Pendente',
      descricao,
      validade: jsonData.niveis_sicaf[nivel]?.validade || null,
    };
  }

  // Extrair TODAS as certidões do PDF oficial (válidas e vencidas) → alimenta tabela certidoes
  const certsOficiais = extractCertidoesSituacaoFornecedor(text);
  for (const cert of certsOficiais) {
    upsertCertidaoInJson(jsonData, cert);

    const sit = String(cert.situacao || '').toLowerCase();
    const vencida = sit.includes('venc');
    const nivel = cert.nivel_sicaf || guessNivelFromCertName(cert.nome);
    if (vencida && nivel && jsonData.niveis_sicaf[nivel]?.situacao !== 'Pendente') {
      jsonData.niveis_sicaf[nivel] = {
        ...(jsonData.niveis_sicaf[nivel] || {}),
        situacao: 'Vencido',
        descricao: jsonData.niveis_sicaf[nivel]?.descricao || NIVEL_NOMES[nivel],
        validade: jsonData.niveis_sicaf[nivel]?.validade || cert.data_validade,
      };
    }
  }

  // Nível VI: reforço do cabeçalho (validade em layout colunar)
  const viDataValidade = extractNivelVIValidade(text);
  const hasVIHeader = /(?:^|\n|\r|\s)VI\s*[-–]\s*Qualifica[çc][ãa]o\s+Econ[oô]mico/i.test(text);
  if (hasVIHeader && viDataValidade) {
    const vencida = isNivelVIDateExpired(text, viDataValidade);
    if (vencida) {
      jsonData.niveis_sicaf.VI = {
        ...(jsonData.niveis_sicaf.VI || {}),
        situacao: 'Pendente',
        descricao: `${NIVEL_NOMES.VI} (Possui Pendência)`,
        validade: viDataValidade,
      };
      upsertCertidaoInJson(jsonData, {
        nome: 'Qualificação Econômico-Financeira (Balanço/DRE)',
        situacao: 'Vencida',
        data_validade: viDataValidade,
        nivel_sicaf: 'VI',
        orgao_emissor: 'Contador / Portal SICAF',
        tipo_consulta: 'Manual',
      });
    } else {
      jsonData.niveis_sicaf.VI = {
        ...(jsonData.niveis_sicaf.VI || {}),
        situacao: 'Regular',
        descricao: jsonData.niveis_sicaf.VI?.descricao || NIVEL_NOMES.VI,
        validade: viDataValidade,
      };
      upsertCertidaoInJson(jsonData, {
        nome: 'Balanço Patrimonial',
        situacao: 'Válida',
        data_validade: viDataValidade,
        nivel_sicaf: 'VI',
        orgao_emissor: 'Contabilidade / Empresa',
        tipo_consulta: 'Manual',
      });
    }
  }

  // Marcar certidões já extraídas pela IA cujas datas estão vencidas
  for (const cert of jsonData.certidoes) {
    if (cert.data_validade && isDateExpired(cert.data_validade)) {
      const sit = String(cert.situacao || '').toLowerCase();
      if (!sit.includes('venc') && !sit.includes('pend')) {
        cert.situacao = 'Vencida';
      }
      const nivel = cert.nivel_sicaf || guessNivelFromCertName(cert.nome);
      if (nivel) {
        cert.nivel_sicaf = nivel;
        const nivelSit = String(jsonData.niveis_sicaf[nivel]?.situacao || '').toLowerCase();
        if (nivelSit === 'regular' || !nivelSit) {
          jsonData.niveis_sicaf[nivel] = {
            ...(jsonData.niveis_sicaf[nivel] || {}),
            situacao: 'Vencido',
            descricao: jsonData.niveis_sicaf[nivel]?.descricao || NIVEL_NOMES[nivel],
          };
        }
      }
    }
  }

  // Cabeçalho válido do nível VI prevalece sobre registros antigos de balanço vencido no JSON
  if (hasVIHeader && viDataValidade) {
    const vencida = isNivelVIDateExpired(text, viDataValidade);
    if (!vencida) {
      jsonData.niveis_sicaf.VI = {
        situacao: 'Regular',
        descricao: NIVEL_NOMES.VI,
        validade: viDataValidade,
      };
      upsertCertidaoInJson(jsonData, {
        nome: 'Balanço Patrimonial',
        situacao: 'Válida',
        data_validade: viDataValidade,
        nivel_sicaf: 'VI',
        orgao_emissor: 'Contabilidade / Empresa',
      });
      jsonData.certidoes = jsonData.certidoes.filter((c) => {
        const nivel = c.nivel_sicaf || guessNivelFromCertName(c.nome);
        if (nivel !== 'VI') return true;
        const sit = String(c.situacao || '').toLowerCase();
        if (!sit.includes('venc')) return true;
        return c.data_validade === viDataValidade;
      });
    }
  }

  return jsonData;
}

/**
 * Analisa pendências e sugere soluções a partir do JSON extraído da Situação do Fornecedor.
 */
async function analyzeSicafProblema(jsonData, pdfText = '') {
  const ready = await ensureOpenAI();
  if (!ready || !openai || !jsonData) return null;

  const enriched = enrichSicafJsonFromText({ ...jsonData, certidoes: [...(jsonData.certidoes || [])] }, pdfText);
  const niveis = enriched.niveis_sicaf || {};
  const certidoes = enriched.certidoes || [];

  const prompt = `Você é especialista no SICAF (Sistema de Cadastramento Unificado de Fornecedores) e deve analisar a "Situação do Fornecedor" de uma empresa.

## ESTRUTURA DO DOCUMENTO SICAF

O PDF "Situação do Fornecedor" contém:
1. **Dados do Fornecedor** — CNPJ, razão social, situação (Credenciado/Inapto), data de vencimento do cadastro
2. **Ocorrências e Impedimentos** — geralmente "Nada Consta" (isso NÃO significa que não há pendências nos níveis)
3. **Níveis cadastrados (I a VI)** — cada nível pode ter certidões/documentos com validade

### Os 6 níveis SICAF (sempre verifique TODOS):
- **I — Credenciamento:** cadastro básico. Validade = "Data de Vencimento do Cadastro" do cabeçalho.
- **II — Habilitação Jurídica:** contrato social, estatuto, documentos societários.
- **III — Regularidade Fiscal e Trabalhista Federal:** Receita Federal/PGFN, FGTS, Trabalhista (geralmente consulta Automática).
- **IV — Regularidade Fiscal Estadual/Distrital e Municipal:** Receita Estadual/Distrital, Receita Municipal (geralmente Manual).
- **V — Qualificação Técnica:** registros profissionais, atestados de capacidade técnica.
- **VI — Qualificação Econômico-Financeira:** balanço patrimonial, DRE, certidão negativa de falência.

### Como identificar PROBLEMAS no documento:
1. **"(Possui Pendência)"** no título do nível → aquele nível tem pendência. Ex: "IV - ... (Possui Pendência)"
2. **Asterisco (*)** ao lado da data → documento VENCIDO. Ex: "Validade: 02/07/2025 (*)"
3. **Legenda do PDF:** "Documento(s) assinalado(s) com '*' está(ão) com prazo(s) vencido(s)"
4. **Situação "Vencida", "Pendente", "Positiva"** em certidões
5. **Data de validade anterior à data de hoje** → documento vencido

### O que NÃO é problema:
- Nível listado sem "(Possui Pendência)" e com certidões válidas (datas futuras, sem asterisco)
- "Ocorrências: Nada Consta" e "Impedimento de Licitar: Nada Consta" — são campos separados dos níveis

## SUA TAREFA

Analise os dados abaixo e retorne um diagnóstico completo. Para CADA nível com problema, crie pendência(s) explicando:
- Qual nível (I a VI)
- Qual documento/certidão específica (se houver)
- Qual a validade vencida ou qual pendência
- Como resolver (passo a passo objetivo)

Retorne SOMENTE JSON válido (sem markdown):
{
  "resumo": "Resumo em 2-4 frases incluindo o CPF/CNPJ analisado (ex: CPF 000.000.000-00 ou CNPJ 00.000.000/0001-00: ...)",
  "status_geral": "Regular|Pendente|Vencido|Misto",
  "cnpj": "CNPJ extraído do documento ou null se for PF",
  "cpf": "CPF extraído do documento ou null se for PJ",
  "documento": "CPF ou CNPJ principal do fornecedor",
  "razao_social": "Razão social do fornecedor",
  "niveis_status": [
    {
      "nivel": "I",
      "nome": "Credenciamento",
      "status": "Regular|Pendente|Vencido|Não habilitado",
      "observacao": "Texto curto ou null se regular"
    }
  ],
  "pendencias": [
    {
      "nivel": "IV",
      "titulo": "Receita Estadual/Distrital",
      "tipo": "certidao",
      "problema": "Certidão vencida em 02/07/2025 (marcada com * no documento). Nível IV possui pendência.",
      "prioridade": "alta",
      "solucao": "Renovar a certidão negativa de débitos estaduais junto à Secretaria da Fazenda do estado e reenviar no portal SICAF, nível IV.",
      "onde_resolver": "Secretaria da Fazenda Estadual / Portal SICAF"
    }
  ],
  "proximos_passos": ["Renovar certidões vencidas do nível IV", "Atualizar balanço/DRE do nível VI", "Emitir nova Situação do Fornecedor após regularizar"],
  "observacoes": "Dicas extras ou null"
}

## REGRAS OBRIGATÓRIAS:
1. Inclua **niveis_status** com os 6 níveis (I a VI) presentes nos dados — se um nível não aparecer nos dados, status "Não habilitado".
2. Crie **uma pendência por certidão/documento vencido ou pendente**, não agrupe tudo em uma só.
3. Se um nível tem "(Possui Pendência)", inclua também pendência de tipo "nivel" resumindo o nível.
4. Prioridade **alta** para vencidos com asterisco ou nível impedindo licitação; **media** para pendências administrativas.
5. Soluções devem citar o órgão emissor correto (RFB, PGFN, Caixa/FGTS, MPT, SEFAZ, Prefeitura, contador, etc.).
6. Se realmente tudo estiver regular em todos os níveis habilitados, pendencias = [] e status_geral = "Regular".

DADOS ESTRUTURADOS (JSON):
${JSON.stringify({ ...enriched, certidoes, niveis_sicaf: niveis }).substring(0, 9000)}

${pdfText ? `\nTRECHO DO PDF ORIGINAL (referência para validar datas e asteriscos):\n${pdfText.substring(0, 4500)}` : ''}`;

  try {
    const params = await getRuntimeParams();
    const resp = await openai.chat.completions.create({
      model: params.model,
      messages: [
        {
          role: 'system',
          content:
            'Você analisa documentos SICAF brasileiros (Situação do Fornecedor). Identifica pendências em TODOS os níveis I-VI, certidões vencidas com asterisco (*) e orienta o fornecedor com soluções práticas. Retorne SOMENTE JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: Math.min(3500, params.max_tokens),
      temperature: 0.15,
    });
    const text = (resp.choices[0]?.message?.content || '').trim();
    const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const analise = JSON.parse(jsonStr);

    // Garantir niveis_status mínimo se a IA omitir
    if (!analise.niveis_status?.length) {
      analise.niveis_status = ['I', 'II', 'III', 'IV', 'V', 'VI'].map((nivel) => ({
        nivel,
        nome: NIVEL_NOMES[nivel],
        status: niveis[nivel]?.situacao || 'Não habilitado',
        observacao: niveis[nivel]?.descricao || null,
      }));
    }

    return analise;
  } catch (e) {
    console.log(`  [SicafAnalise] Erro IA: ${e.message.substring(0, 80)}`);
    return null;
  }
}

module.exports = {
  initOpenAI,
  reinitFromDb,
  ensureOpenAI,
  getOpenAI,
  getChatHistory,
  resetChatHistory,
  streamChatResponse,
  streamChatEvents,
  extractCertidoesJSON,
  enrichSicafJsonFromText,
  analyzeSicafProblema,
  extractNivelVIValidade,
  extractCertidoesSituacaoFornecedor,
  SYSTEM_PROMPT,
};
