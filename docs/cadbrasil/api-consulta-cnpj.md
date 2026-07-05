# API consulta-cnpj — Documentação completa para IA e atendimento

> **Versão:** 3.0 · **Atualizado:** julho/2026  
> **Endpoint:** `GET https://fornecedor.cadbrasil.com.br/api/clients/consulta-cnpj?cnpj={14_dígitos}`  
> **Autenticação:** header `x-api-key` (valor de `CNPJ_CONSULTA_API_KEY` no servidor da IA)

---

## Como a IA deve usar esta API

1. **Sempre peça o CNPJ com 14 dígitos** (somente números) antes de consultar.
2. **Chame a API** e leia o campo **`situacaoCadastro`** — ele define o cenário.
3. **Prioridade de mensagens:**
   - Se existir `orientacaoUsuario` → use como base da resposta ao cliente (pode adaptar para tom WhatsApp, frases curtas).
   - Se existir `orientacaoIA` → use como contexto interno / roteiro do atendimento.
   - Se existir `message` → resumo curto para abrir a conversa.
4. **Nunca invente** valores, prazos, links de boleto ou status — use apenas o retorno da API e este documento.
5. **Não trate como cliente ativo** quem tem `possuiCadastro: false`, mesmo que `encontradoNaReceitaFederal: true`.

---

## Códigos HTTP

| Status | Quando | `situacaoCadastro` |
|--------|--------|-------------------|
| 200 | Consulta processada | conforme cenário abaixo |
| 400 | CNPJ inválido (≠ 14 dígitos) | `cnpj_invalido` |
| 401 | API Key ausente ou inválida | — |
| 500 | Erro interno / banco indisponível | — |

---

## Fluxo de decisão (campo `situacaoCadastro`)

```
GET /api/clients/consulta-cnpj?cnpj=...
        │
        ├─ HTTP 400 ─────────────────────────► cnpj_invalido
        ├─ HTTP 401 / 500 ───────────────────► erro (ok: false)
        │
        └─ HTTP 200 + ok: true
              │
              ├─ possuiCadastro: false
              │     ├─ encontradoNaReceitaFederal: true  ► cadastro_pendente
              │     └─ encontradoNaReceitaFederal: false ► nao_encontrado
              │
              └─ possuiCadastro: true (cliente na base CADBRASIL)
                    │
                    ├─ sicafValido: true ─────────────────► ativo
                    ├─ pagamento SICAF em aberto ──────────► aguardando_pagamento
                    ├─ sicaf.status = Vencido ─────────────► sicaf_vencido
                    ├─ sicaf = null ───────────────────────► cadastro_sem_sicaf
                    └─ demais casos SICAF incompleto ──────► sicaf_incompleto
```

**Ordem de avaliação no backend (cliente cadastrado):**
1. Se `sicafValido` → **ativo**
2. Senão, se há taxa/boleto SICAF pendente ou status Pendente → **aguardando_pagamento**
3. Senão, se SICAF vencido → **sicaf_vencido**
4. Senão, se não há registro SICAF → **cadastro_sem_sicaf**
5. Senão → **sicaf_incompleto**

---

## Campos comuns (todas as respostas de sucesso)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ok` | boolean | `true` = sucesso |
| `cnpj` | string | 14 dígitos, sem máscara |
| `situacaoCadastro` | string | **Identificador do cenário** (ver tabela abaixo) |
| `message` | string | Resumo curto da situação |
| `orientacaoUsuario` | string | Texto completo para o cliente |
| `orientacaoIA` | string | Texto para a IA montar o atendimento |
| `possuiCadastro` | boolean | Existe na base `clientes` da CADBRASIL |
| `possuiPagamentoPendente` | boolean | Há taxa/boleto SICAF ou manutenção em aberto |

### Valores de `situacaoCadastro`

| Valor | Significado |
|-------|-------------|
| `cnpj_invalido` | CNPJ com formato inválido (erro 400) |
| `nao_encontrado` | Não está na CADBRASIL nem confirmado na Receita |
| `cadastro_pendente` | Achou na Receita Federal, mas não concluiu cadastro CADBRASIL |
| `aguardando_pagamento` | Cadastro na CADBRASIL, taxa SICAF não quitada |
| `sicaf_vencido` | Cadastro na CADBRASIL, credenciamento expirado |
| `cadastro_sem_sicaf` | Cliente na base, sem processo SICAF iniciado |
| `sicaf_incompleto` | SICAF iniciado, ainda não concluído |
| `ativo` | Credenciamento SICAF válido e em ordem |

---

# CENÁRIO A — `cnpj_invalido` (HTTP 400)

### Quando ocorre
Cliente informou CNPJ com menos ou mais de 14 dígitos, ou vazio.

### Resposta da API
```json
{
  "ok": false,
  "error": "CNPJ inválido. Informe 14 dígitos.",
  "situacaoCadastro": "cnpj_invalido"
}
```

### Mensagem para o cliente (IA)
> O CNPJ informado não é válido. Por favor, envie os **14 números** do CNPJ da empresa, **sem pontos, barra ou traço**.  
> Exemplo: `03751915000127`

### O que a IA deve fazer
- Pedir novamente o CNPJ no formato correto.
- Não consultar boletos nem falar de status SICAF até ter 14 dígitos válidos.
- Após **2 tentativas** sem sucesso → escalar humano.

---

# CENÁRIO B — `nao_encontrado`

### Quando ocorre
- CNPJ **não existe** na base CADBRASIL (`possuiCadastro: false`)
- E **não foi confirmado** na Receita Federal (`encontradoNaReceitaFederal: false`)

### Campos principais
`possuiCadastro: false` · `encontradoNaReceitaFederal: false` · `cliente: null` · `sicaf: null` · `urlCadastro` · `erroReceitaFederal`

### Exemplo completo de resposta
```json
{
  "ok": true,
  "cnpj": "00000000000000",
  "situacaoCadastro": "nao_encontrado",
  "possuiCadastro": false,
  "cadastroConcluido": false,
  "cadastroValido": false,
  "sicafValido": false,
  "possuiRenovacao": false,
  "possuiManutencao": false,
  "possuiPagamentoPendente": false,
  "razaoSocial": null,
  "cliente": null,
  "sicaf": null,
  "renovacao": null,
  "manutencao": null,
  "urlCadastro": "https://cadastro.cadbrasil.com.br",
  "podeConcluirCadastro": true,
  "encontradoNaReceitaFederal": false,
  "receitaFederal": null,
  "erroReceitaFederal": "CNPJ não encontrado na base da Receita Federal.",
  "message": "CNPJ não encontrado na base da CADBRASIL.",
  "orientacaoUsuario": "O CNPJ informado não foi localizado na base da CADBRASIL nem confirmado na Receita Federal. Verifique se o número está correto. Caso sua empresa ainda não tenha cadastro, acesse https://cadastro.cadbrasil.com.br para iniciar o cadastramento digital e dar sequência ao processo SICAF.",
  "orientacaoIA": "O CNPJ 00000000000000 não foi encontrado na base CADBRASIL. Consulta à Receita Federal: CNPJ não encontrado na base da Receita Federal. Oriente o cliente a verificar o número informado ou iniciar o cadastro em https://cadastro.cadbrasil.com.br."
}
```

### Mensagem completa para o cliente (IA — use/adapte `orientacaoUsuario`)
> Não localizamos esse CNPJ na CADBRASIL nem na Receita Federal.  
> Por favor, **confira se os 14 dígitos estão corretos**.  
> Se sua empresa ainda não se cadastrou, acesse:  
> 👉 **https://cadastro.cadbrasil.com.br**  
> Lá você inicia o cadastramento digital para obter acesso ao SICAF/CADBRASIL.

### O que a IA deve fazer
- Pedir confirmação do CNPJ (pode ter digitado errado).
- Oferecer link de cadastro se for empresa nova.
- **Não** dizer que o cliente já é cadastrado.
- Após **2 tentativas** → escalar humano.

### Possíveis valores em `erroReceitaFederal`
- `CNPJ não encontrado na base da Receita Federal.`
- `Resposta inválida da API OpenCNPJ.`
- `Limite de consultas atingido (100/min). Tente novamente em instantes.`

---

# CENÁRIO C — `cadastro_pendente`

### Quando ocorre
- CNPJ **não está** na base CADBRASIL (`possuiCadastro: false`)
- Mas **foi encontrado** na Receita Federal (`encontradoNaReceitaFederal: true`)
- Consulta automática via OpenCNPJ

### Campos principais
`receitaFederal` (objeto completo) · `situacaoReceitaFederal` · `valorTaxaAnual` · `urlCadastro` · `podeConcluirCadastro: true`

### Exemplo completo de resposta
```json
{
  "ok": true,
  "cnpj": "06990590000123",
  "situacaoCadastro": "cadastro_pendente",
  "possuiCadastro": false,
  "cadastroConcluido": false,
  "cadastroValido": false,
  "sicafValido": false,
  "possuiRenovacao": false,
  "possuiManutencao": false,
  "possuiPagamentoPendente": false,
  "razaoSocial": "GOOGLE BRASIL INTERNET LTDA.",
  "cliente": null,
  "sicaf": null,
  "renovacao": null,
  "manutencao": null,
  "urlCadastro": "https://cadastro.cadbrasil.com.br",
  "podeConcluirCadastro": true,
  "encontradoNaReceitaFederal": true,
  "situacaoReceitaFederal": "Ativa",
  "valorTaxaAnual": 985,
  "receitaFederal": {
    "cnpj": "06990590000123",
    "razaoSocial": "GOOGLE BRASIL INTERNET LTDA.",
    "nomeFantasia": null,
    "situacaoCadastral": "Ativa",
    "atividadePrincipal": "Portais, provedores de conteúdo...",
    "email": "GOOGLEBRASIL@GOOGLE.COM",
    "telefone": "(11) 23958400",
    "logradouro": "AVENIDA BRIG FARIA LIMA",
    "numero": "3477",
    "cidade": "SAO PAULO",
    "estado": "SP",
    "cep": "04538133",
    "porte": null,
    "naturezaJuridica": "Sociedade Empresária Limitada"
  },
  "message": "CNPJ localizado na Receita Federal. Cadastro na CADBRASIL ainda não foi concluído.",
  "orientacaoUsuario": "Olá, empresa GOOGLE BRASIL INTERNET LTDA.! Localizamos seus dados na Receita Federal, porém o cadastro junto à CADBRASIL ainda não foi concluído corretamente no cadastramento digital. O caminho para continuar o processo é https://cadastro.cadbrasil.com.br. Preencha todas as informações atualizadas e corretas para obter acesso ao SICAF/CADBRASIL. Lembre-se: durante o processo será necessário pagar a taxa anual de R$ 985,00.",
  "orientacaoIA": "O CNPJ corresponde a GOOGLE BRASIL INTERNET LTDA. (situação cadastral na Receita: Ativa) e foi encontrado na Receita Federal, mas NÃO possui cadastro concluído na CADBRASIL. Oriente o cliente a acessar https://cadastro.cadbrasil.com.br, concluir o cadastramento digital com dados atualizados e efetuar o pagamento da taxa anual de R$ 985,00 para obter acesso ao SICAF. Sem o cadastro completo e o pagamento, os níveis do SICAF não serão liberados."
}
```

### Mensagem completa para o cliente (IA)
> Olá, empresa **{razaoSocial}**!  
> Localizamos seus dados na **Receita Federal** (situação: **{situacaoReceitaFederal}**), porém o cadastro na **CADBRASIL ainda não foi concluído**.  
>  
> Para continuar:  
> 👉 Acesse **https://cadastro.cadbrasil.com.br**  
> Preencha todas as informações atualizadas e corretas.  
> Durante o processo será necessário pagar a **taxa anual de R$ 985,00** (credenciamento SICAF).  
> Sem concluir o cadastro e o pagamento, os **níveis do SICAF não serão liberados**.

### O que a IA deve fazer
- Cumprimentar pelo `razaoSocial` da Receita.
- Enviar `urlCadastro`.
- Informar valor da taxa (`valorTaxaAnual` — padrão R$ 985,00).
- **Não** tratar como cliente ativo, **não** enviar boleto SICAF de cliente cadastrado (ainda não está na base).
- Se `situacaoReceitaFederal` = Baixada/Inapta → escalar consultor.

### O que a IA NÃO deve fazer
- Dizer que o SICAF está ativo.
- Inventar status de pagamento.

---

# CENÁRIO D — `aguardando_pagamento`

### Quando ocorre
- Cliente **já está** na base CADBRASIL (`possuiCadastro: true`)
- Tem registro SICAF, mas **taxa de credenciamento não foi paga** (`sicafValido: false`)
- `sicaf.status` geralmente **Pendente** e/ou há boletos em `pagamentosResumo`

### Campos principais
`possuiPagamentoPendente: true` · `valorTotalPendente` · `pagamentosResumo` · `urlPortal` · objetos `cliente` e `sicaf`

### Exemplo completo de resposta
```json
{
  "ok": true,
  "cnpj": "35270386000136",
  "situacaoCadastro": "aguardando_pagamento",
  "possuiCadastro": true,
  "cadastroConcluido": true,
  "cadastroValido": false,
  "sicafValido": false,
  "possuiRenovacao": false,
  "possuiManutencao": false,
  "possuiPagamentoPendente": true,
  "razaoSocial": "35.270.386 BARBARA GLACIELE DA CONCEICAO",
  "urlCadastro": "https://cadastro.cadbrasil.com.br",
  "urlPortal": "https://fornecedor.cadbrasil.com.br",
  "valorTotalPendente": 985,
  "cliente": {
    "id": 192547,
    "razaoSocial": "35.270.386 BARBARA GLACIELE DA CONCEICAO",
    "documento": "35.270.386/0001-36",
    "email": "barbaraglaciely@gmail.com",
    "status": "Ativo"
  },
  "sicaf": {
    "id": 192546,
    "status": "Pendente",
    "valido": false,
    "dataValidade": null,
    "diasValidade": 0,
    "completude": 0
  },
  "renovacao": null,
  "manutencao": null,
  "pagamentosResumo": {
    "totalPendentes": 1,
    "valorTotalPendente": 985,
    "sicafPendentes": [
      {
        "valor": 985,
        "status": "Pendente",
        "dataVencimento": "2026-07-10",
        "linkBoleto": "https://...",
        "pdfBoleto": "https://...pdf"
      }
    ],
    "manutencaoPendentes": []
  },
  "message": "Cadastro SICAF identificado com pagamento pendente de R$ 985,00.",
  "orientacaoUsuario": "A empresa 35.270.386 BARBARA GLACIELE DA CONCEICAO já possui cadastro SICAF na CADBRASIL, porém o pagamento da taxa de credenciamento ainda está em aberto no valor de R$ 985,00. Para dar continuidade ao processo e liberar a conclusão dos níveis do SICAF, acesse o Portal do Fornecedor em https://fornecedor.cadbrasil.com.br, faça login com sua conta e regularize o pagamento. Enquanto o pagamento não for confirmado, os níveis do credenciamento SICAF não serão concluídos e sua empresa permanecerá com o credenciamento pendente.",
  "orientacaoIA": "O CNPJ pertence a 35.270.386 BARBARA GLACIELE DA CONCEICAO, que já possui cadastro SICAF na CADBRASIL, mas ainda não quitou a taxa de credenciamento (R$ 985,00). Oriente o cliente a acessar https://fornecedor.cadbrasil.com.br, entrar com login e senha e efetuar o pagamento pendente para concluir os níveis do SICAF. Sem a regularização do pagamento, o credenciamento permanece incompleto (status Pendente) e os níveis do SICAF não serão liberados."
}
```

### Mensagem completa para o cliente (IA)
> A empresa **{razaoSocial}** já possui cadastro na CADBRASIL, mas o **pagamento da taxa SICAF ainda está em aberto** — valor: **R$ {valorTotalPendente},00**.  
>  
> Para liberar os níveis do credenciamento:  
> 👉 Acesse **https://fornecedor.cadbrasil.com.br**, faça login e regularize o pagamento.  
>  
> ⚠️ Enquanto o pagamento não for confirmado, os **níveis do SICAF não serão concluídos**.  
>  
> Se quiser, posso enviar o boleto aqui — me confirme que deseja receber.

### O que a IA deve fazer
- Informar claramente: **cadastro feito, pagamento pendente**.
- Orientar portal `urlPortal`.
- Se `pagamentosResumo.sicafPendentes[].linkBoleto` ou `pdfBoleto` existir → enviar ao cliente.
- Ou consultar API `/api/clients/boleto-sicaf/{cnpj}` para obter boleto.
- Mencionar que `sicaf.completude` provavelmente está em 0% até pagar.

### O que a IA NÃO deve fazer
- Dizer que o SICAF está ativo ou apto a licitar.
- Dizer que não há pendências.

---

# CENÁRIO E — `sicaf_vencido`

### Quando ocorre
- Cliente na CADBRASIL (`possuiCadastro: true`)
- SICAF com validade **expirada** (`sicaf.status` = **Vencido**, `sicafValido: false`)
- Sem pendência financeira de credenciamento inicial detectada

### Exemplo completo de resposta
```json
{
  "ok": true,
  "cnpj": "23250168000150",
  "situacaoCadastro": "sicaf_vencido",
  "possuiCadastro": true,
  "cadastroConcluido": true,
  "cadastroValido": false,
  "sicafValido": false,
  "razaoSocial": "EMPRESA EXEMPLO LTDA",
  "urlPortal": "https://fornecedor.cadbrasil.com.br",
  "sicaf": {
    "id": 192280,
    "status": "Vencido",
    "valido": false,
    "dataValidade": "2026-06-10T03:00:00.000Z",
    "diasValidade": 0,
    "completude": 17
  },
  "message": "Credenciamento SICAF vencido em 10/06/2026.",
  "orientacaoUsuario": "A empresa EMPRESA EXEMPLO LTDA possui cadastro na CADBRASIL, porém o credenciamento SICAF está vencido (validade expirada em 10/06/2026). Para renovar e restabelecer o acesso, acesse o Portal do Fornecedor em https://fornecedor.cadbrasil.com.br, faça login e regularize a situação.",
  "orientacaoIA": "O cliente EMPRESA EXEMPLO LTDA tem cadastro na CADBRASIL com SICAF vencido desde 10/06/2026. Oriente a renovação pelo portal https://fornecedor.cadbrasil.com.br."
}
```

### Mensagem completa para o cliente (IA)
> A empresa **{razaoSocial}** está cadastrada na CADBRASIL, mas o **credenciamento SICAF está VENCIDO** (validade expirada em **{dataValidade}**).  
>  
> ⚠️ **Não participe de licitações** com SICAF vencido — há risco de desclassificação.  
>  
> Para renovar:  
> 👉 **https://fornecedor.cadbrasil.com.br** (login e senha)  
> Ou fale conosco no WhatsApp **(11) 2122-0202**.  
>  
> Vídeo como atualizar: https://www.youtube.com/watch?v=ZG3csRrz1rQ

### O que a IA deve fazer
- Tratar com **urgência**.
- Orientar renovação imediata.
- Se cliente tem licitação próxima → **escalar humano com prioridade alta**.

---

# CENÁRIO F — `cadastro_sem_sicaf`

### Quando ocorre
- Cliente existe na base (`possuiCadastro: true`)
- Mas **não há registro** em `sicaf_cadastros` (`sicaf: null`)

### Exemplo completo de resposta
```json
{
  "ok": true,
  "cnpj": "12345678000199",
  "situacaoCadastro": "cadastro_sem_sicaf",
  "possuiCadastro": true,
  "sicafValido": false,
  "sicaf": null,
  "razaoSocial": "EMPRESA EXEMPLO LTDA",
  "valorTaxaAnual": 985,
  "urlCadastro": "https://cadastro.cadbrasil.com.br",
  "urlPortal": "https://fornecedor.cadbrasil.com.br",
  "message": "Cliente cadastrado na CADBRASIL sem processo SICAF iniciado.",
  "orientacaoUsuario": "A empresa EMPRESA EXEMPLO LTDA está na base da CADBRASIL, mas o processo de credenciamento SICAF ainda não foi iniciado ou concluído. Acesse https://fornecedor.cadbrasil.com.br ou https://cadastro.cadbrasil.com.br para dar continuidade ao cadastro e efetuar o pagamento da taxa anual de R$ 985,00.",
  "orientacaoIA": "Cliente EMPRESA EXEMPLO LTDA existe na CADBRASIL sem registro SICAF ativo. Oriente a conclusão do credenciamento em https://cadastro.cadbrasil.com.br ou https://fornecedor.cadbrasil.com.br, incluindo pagamento de R$ 985,00."
}
```

### Mensagem completa para o cliente (IA)
> Sua empresa **{razaoSocial}** está na CADBRASIL, mas o **processo SICAF ainda não foi iniciado**.  
> Para dar continuidade:  
> 👉 Portal: **https://fornecedor.cadbrasil.com.br**  
> 👉 Ou cadastro: **https://cadastro.cadbrasil.com.br**  
> Taxa de credenciamento: **R$ 985,00** (pagamento único).

---

# CENÁRIO G — `sicaf_incompleto`

### Quando ocorre
- Cliente na CADBRASIL com SICAF iniciado
- `sicafValido: false`, mas **sem** pendência financeira clara de credenciamento
- Status como Pendente, documentação incompleta, etc.

### Exemplo completo de resposta
```json
{
  "ok": true,
  "cnpj": "98765432000111",
  "situacaoCadastro": "sicaf_incompleto",
  "possuiCadastro": true,
  "sicafValido": false,
  "razaoSocial": "EMPRESA EXEMPLO LTDA",
  "urlPortal": "https://fornecedor.cadbrasil.com.br",
  "sicaf": {
    "status": "Pendente",
    "valido": false,
    "completude": 25
  },
  "message": "Cadastro SICAF em andamento (status: Pendente).",
  "orientacaoUsuario": "A empresa EMPRESA EXEMPLO LTDA possui cadastro na CADBRASIL, mas o credenciamento SICAF ainda não foi concluído (situação atual: Pendente). Acesse o Portal do Fornecedor em https://fornecedor.cadbrasil.com.br para verificar pendências e concluir os níveis do SICAF.",
  "orientacaoIA": "Cliente EMPRESA EXEMPLO LTDA com SICAF incompleto (Pendente). Oriente acesso a https://fornecedor.cadbrasil.com.br para regularizar pendências documentais e financeiras."
}
```

### Mensagem completa para o cliente (IA)
> Sua empresa **{razaoSocial}** tem cadastro na CADBRASIL, mas o **SICAF ainda não foi concluído** (status: **{sicaf.status}**, completude: **{sicaf.completude}%**).  
> Acesse **https://fornecedor.cadbrasil.com.br** para ver pendências de documentos e próximos passos.

---

# CENÁRIO H — `ativo` ✅ (CNPJ em ordem)

### Quando ocorre
- Cliente na CADBRASIL (`possuiCadastro: true`)
- **`sicafValido: true`** — credenciamento vigente
- Pagamentos em dia (`pagamentosEmDia: true` na maioria dos casos)

### Campos exclusivos deste cenário

| Campo | Descrição |
|-------|-----------|
| `saudacao` | `Bom dia` / `Boa tarde` / `Boa noite` (horário Brasília) |
| `pagamentosEmDia` | `true` se não há boletos pendentes |
| `renovacaoProxima` | `true` se faltam ≤ 60 dias para vencer |
| `renovacaoUrgente` | `true` se faltam ≤ 30 dias |
| `diasParaRenovacao` | Dias até `sicaf.dataValidade` |
| `niveisSicaf` | Array com níveis I a VI |
| `urlPortal` | https://fornecedor.cadbrasil.com.br |
| `urlAjuda` | https://fornecedor.cadbrasil.com.br/ajuda |
| `urlVideoAtualizacaoSicaf` | https://www.youtube.com/watch?v=ZG3csRrz1rQ |
| `certidaoVencendoOuVencida` | `true` se algum nível está A Vencer ou Vencido |
| `urlWhatsApp` | Link wa.me |
| `whatsappDisplay` | (11) 2122-0202 |

### Estrutura de cada item em `niveisSicaf[]`

```json
{
  "nivel": "III",
  "nome": "Regularidade Fiscal Federal",
  "status": "Válido",
  "icone": "✅",
  "pendencia": false,
  "dataValidade": "15/06/2027",
  "certidoes": 3
}
```

**Ícones:** ✅ Válido/Habilitado · ⚠️ A Vencer · ❌ Vencido · ⏳ Pendente

### Exemplo completo — cliente ativo, tudo em ordem
```json
{
  "ok": true,
  "cnpj": "03751915000127",
  "situacaoCadastro": "ativo",
  "possuiCadastro": true,
  "cadastroConcluido": true,
  "cadastroValido": true,
  "sicafValido": true,
  "possuiRenovacao": true,
  "possuiManutencao": false,
  "possuiPagamentoPendente": false,
  "razaoSocial": "LABORATORIO DE ANALISES CLINICAS BARROS LTDA",
  "saudacao": "Bom dia",
  "pagamentosEmDia": true,
  "renovacaoProxima": false,
  "renovacaoUrgente": false,
  "diasParaRenovacao": 364,
  "urlPortal": "https://fornecedor.cadbrasil.com.br",
  "urlAjuda": "https://fornecedor.cadbrasil.com.br/ajuda",
  "urlVideoAtualizacaoSicaf": "https://www.youtube.com/watch?v=ZG3csRrz1rQ",
  "certidaoVencendoOuVencida": false,
  "urlWhatsApp": "https://wa.me/551121220202",
  "whatsappDisplay": "(11) 2122-0202",
  "cliente": { "id": 192543, "razaoSocial": "LABORATORIO DE ANALISES CLINICAS BARROS LTDA", "status": "Ativo" },
  "sicaf": {
    "id": 192542,
    "status": "Ativo",
    "valido": true,
    "dataValidade": "2027-07-02T03:00:00.000Z",
    "diasValidade": 364,
    "completude": 17
  },
  "renovacao": {
    "id": 6219,
    "status": "Concluída",
    "anoReferencia": 2026
  },
  "manutencao": null,
  "niveisSicaf": [
    { "nivel": "I", "nome": "Credenciamento", "status": "Habilitado", "icone": "✅", "pendencia": false, "dataValidade": "02/07/2027", "certidoes": 0 },
    { "nivel": "II", "nome": "Habilitação Jurídica", "status": "Habilitado", "icone": "✅", "pendencia": false, "dataValidade": null, "certidoes": 0 },
    { "nivel": "III", "nome": "Regularidade Fiscal Federal", "status": "Válido", "icone": "✅", "pendencia": false, "dataValidade": "15/06/2027", "certidoes": 3 },
    { "nivel": "IV", "nome": "Regularidade Fiscal Estadual/Municipal", "status": "Válido", "icone": "✅", "pendencia": false, "dataValidade": "20/08/2027", "certidoes": 2 },
    { "nivel": "V", "nome": "Qualificação Técnica", "status": "Habilitado", "icone": "✅", "pendencia": false, "dataValidade": null, "certidoes": 0 },
    { "nivel": "VI", "nome": "Qualificação Econômico-Financeira", "status": "Habilitado", "icone": "✅", "pendencia": false, "dataValidade": null, "certidoes": 0 }
  ],
  "message": "Credenciamento SICAF ativo até 02/07/2027.",
  "orientacaoUsuario": "Prezado Fornecedor LABORATORIO DE ANALISES CLINICAS BARROS LTDA, bom dia! Seu cadastro encontra-se Ativo na CADBRASIL com credenciamento SICAF válido até 02/07/2027. Os valores da taxa de credenciamento estão devidamente pagos e em ordem. Última renovação: Concluída (referência 2026). Seu credenciamento está válido por mais 364 dia(s), até 02/07/2027. Níveis SICAF: ✅ Nível I — Credenciamento: Habilitado (válido até 02/07/2027) | ✅ Nível II — Habilitação Jurídica: Habilitado | ✅ Nível III — Regularidade Fiscal Federal: Válido (válido até 15/06/2027) | ✅ Nível IV — Regularidade Fiscal Estadual/Municipal: Válido | ✅ Nível V — Qualificação Técnica: Habilitado | ✅ Nível VI — Qualificação Econômico-Financeira: Habilitado. Todos os níveis consultados estão em situação regular. Para emitir boletos ou acompanhar seu credenciamento, acesse https://fornecedor.cadbrasil.com.br. Você também pode solicitar o boleto pelo WhatsApp (11) 2122-0202. Dúvidas para atualizar seu SICAF? Acesse a Central de Ajuda em https://fornecedor.cadbrasil.com.br/ajuda — lá você encontra vídeos práticos passo a passo. Caso tenha alguma certidão a vencer ou vencida, você também pode assistir ao vídeo de como atualizar o SICAF: https://www.youtube.com/watch?v=ZG3csRrz1rQ",
  "orientacaoIA": "Cliente LABORATORIO DE ANALISES CLINICAS BARROS LTDA com SICAF Ativo na CADBRASIL (validade 02/07/2027, 364 dias restantes) Pagamentos em dia. Níveis em ordem. Vídeo como atualizar SICAF (se certidão vencer): https://www.youtube.com/watch?v=ZG3csRrz1rQ. Portal: https://fornecedor.cadbrasil.com.br | Ajuda: https://fornecedor.cadbrasil.com.br/ajuda | WhatsApp: (11) 2122-0202."
}
```

### Mensagem completa para o cliente — SICAF ativo, tudo OK (IA — adapte em blocos WhatsApp)

**Bloco 1 — Saudação e status**
> Prezado Fornecedor **{razaoSocial}**, {saudacao}!  
> Seu cadastro está **{sicaf.status}** na CADBRASIL, com SICAF válido até **{sicaf.dataValidade formatada}**.  
> Os pagamentos estão **em dia** ✅

**Bloco 2 — Renovação**
> Se `renovacaoUrgente` (≤30 dias):  
> ⚠️ Atenção: seu SICAF vence em **{diasParaRenovacao} dias**. Recomendamos iniciar a renovação pelo portal ou WhatsApp.  
>  
> Se `renovacaoProxima` (≤60 dias):  
> Seu credenciamento vence em **{diasParaRenovacao} dias** — fique atento.  
>  
> Se tudo tranquilo:  
> Validade: mais **{diasParaRenovacao} dias** (até {data}).

**Bloco 3 — Níveis SICAF** (listar de `niveisSicaf`)
> **Seus níveis SICAF:**  
> {icone} Nível I — Credenciamento: {status}  
> {icone} Nível II — Habilitação Jurídica: {status}  
> … (repetir até VI)

**Bloco 4 — Links úteis**
> 📋 Portal: **{urlPortal}**  
> 📞 Boleto pelo WhatsApp: **{whatsappDisplay}**  
> ❓ Central de Ajuda (vídeos): **{urlAjuda}**  
> 🎥 Como atualizar o SICAF: **{urlVideoAtualizacaoSicaf}**

### Sub-cenário H2 — Ativo COM certidão a vencer/vencida

Quando `certidaoVencendoOuVencida: true` e algum nível tem `icone` ⚠️ ou ❌:

> Prezado Fornecedor **{razaoSocial}**, {saudacao}!  
> Seu SICAF está **ativo** até {data}, porém identificamos **certidão(ões) a vencer ou vencida(s)**:  
> ⚠️ Nível III — Regularidade Fiscal Federal (vence em 20/07/2026)  
>  
> Para atualizar, assista ao vídeo passo a passo:  
> 🎥 **https://www.youtube.com/watch?v=ZG3csRrz1rQ**  
>  
> Ou acesse a Central de Ajuda: **https://fornecedor.cadbrasil.com.br/ajuda**

### O que a IA deve fazer (cenário ativo)
- Parabenizar — cliente em dia.
- Resumir níveis SICAF com ícones.
- Se `renovacaoUrgente` → alertar renovação.
- Se `certidaoVencendoOuVencida` → destacar níveis com ⚠️/❌ e enviar vídeo.
- Oferecer portal, ajuda e WhatsApp para boletos.
- Se `possuiManutencao: true` → mencionar plano de manutenção ativo (R$ 155/mês).

---

## Interpretação de `manutencao` (quando presente)

Objeto `manutencao` aparece quando há registro de plano de manutenção:

| Campo | Uso para IA |
|-------|-------------|
| `status` | Ativo, A vencer, Vencendo = manutenção contratada |
| `valor` | Geralmente R$ 155,00/mês |
| `diasRestantes` | Dias até fim do período atual |
| `dataFim` | Data de término do ciclo |

**`possuiManutencao: true`** → cliente tem (ou teve) manutenção CADBRASIL ativa.  
Boletos de manutenção → API separada: `GET /api/clients/consulta-boletos?cnpj=CNPJ`

---

## Interpretação de `renovacao`

| Campo | Uso para IA |
|-------|-------------|
| `status` | Concluída, Pendente, etc. |
| `anoReferencia` | Ano da renovação |
| `possuiRenovacao: true` | Última renovação com status concluído/aprovado/pago |

Renovação **Concluída** + `sicafValido: true` = cliente regularizado para o ano.

---

## Respostas de erro (`ok: false`)

### 401 — API Key inválida
```json
{ "ok": false, "error": "Não autorizado. API Key inválida." }
```
**IA:** Não exponha detalhes. Informe indisponibilidade temporária e escale.

### 500 — Erro interno
```json
{ "ok": false, "error": "Erro interno no servidor" }
{ "ok": false, "error": "Banco de dados não disponível" }
```
**IA:** Peça para tentar novamente em alguns minutos. Escale se persistir.

---

## Tabela rápida — O que a IA responde por cenário

| `situacaoCadastro` | Tom | Ação principal | Link principal |
|--------------------|-----|----------------|----------------|
| `cnpj_invalido` | Neutro | Pedir 14 dígitos | — |
| `nao_encontrado` | Neutro | Confirmar CNPJ / cadastro novo | cadastro.cadbrasil.com.br |
| `cadastro_pendente` | Acolhedor | Concluir cadastro + taxa R$ 985 | cadastro.cadbrasil.com.br |
| `aguardando_pagamento` | Objetivo | Pagar taxa SICAF | fornecedor.cadbrasil.com.br + boleto |
| `sicaf_vencido` | Urgente | Renovar SICAF | fornecedor.cadbrasil.com.br + vídeo |
| `cadastro_sem_sicaf` | Orientativo | Iniciar SICAF | fornecedor / cadastro |
| `sicaf_incompleto` | Orientativo | Ver pendências no portal | fornecedor.cadbrasil.com.br |
| `ativo` | Positivo | Confirmar status + níveis + links | portal + ajuda + vídeo |

---

## Links oficiais (referência fixa)

| Recurso | URL |
|---------|-----|
| Cadastro digital | https://cadastro.cadbrasil.com.br |
| Portal do fornecedor | https://fornecedor.cadbrasil.com.br |
| Central de ajuda | https://fornecedor.cadbrasil.com.br/ajuda |
| Esqueci senha | https://fornecedor.cadbrasil.com.br/esqueci-senha |
| Vídeo — atualizar SICAF | https://www.youtube.com/watch?v=ZG3csRrz1rQ |
| WhatsApp | (11) 2122-0202 |
| Documentação | https://docs.cadbrasil.com.br |

---

## Atualização da seção "Instruções para a IA" (substituir regras antigas de API)

**Substituir** as regras que citam apenas "Cenário 1, 2, 3" por:

```
Após consultar GET /api/clients/consulta-cnpj?cnpj=... use situacaoCadastro:

• cnpj_invalido → pedir 14 dígitos
• nao_encontrado → verificar CNPJ; oferecer cadastro.cadbrasil.com.br
• cadastro_pendente → empresa na Receita, sem CADBRASIL; urlCadastro + taxa R$ 985
• aguardando_pagamento → cadastro OK, pagamento pendente; urlPortal + boleto
• sicaf_vencido → renovação urgente; urlPortal + vídeo YouTube
• cadastro_sem_sicaf → iniciar processo SICAF
• sicaf_incompleto → pendências no portal
• ativo → cumprimentar; informar níveis (niveisSicaf); pagamentosEmDia;
  renovacaoProxima/Urgente; urlAjuda + urlVideoAtualizacaoSicaf

Sempre priorizar orientacaoUsuario quando existir.
Nunca inventar status, valores ou links de boleto.
```

---

© 2026 CADBRASIL · API consulta-cnpj v3.0
