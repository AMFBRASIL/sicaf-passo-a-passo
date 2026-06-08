# Plano de Implementação — 8 Melhorias CADBRASIL

Vou implementar as 8 sugestões. O item 2 (Upload em Massa) será **opcional**, coexistindo com o fluxo de upload individual atual.

## 1. Central de Tarefas / To-Do Inteligente
- Novo painel na home (`/`) listando ações urgentes agregadas de todas as empresas:
  - Taxas pendentes (com botão "Pagar agora")
  - Certificados vencendo em até 30 dias
  - SICAF incompleto / níveis pendentes
- Cada item com badge de prioridade (Urgente / Atenção / Info) e link direto para a tela correspondente (`/empresas`, `/sicaf?cnpj=...`).
- Componente: `src/components/central-tarefas.tsx`.

## 2. Upload em Massa de Certidões (OPCIONAL)
- Na tela `/sicaf`, no passo de upload de Situação do Fornecedor, adicionar toggle: **"Modo individual" / "Modo em massa"**.
- Modo em massa: drag-and-drop de múltiplos PDFs, identifica automaticamente por CNPJ extraído do nome do arquivo, associa a empresa correta e lista resultado ("✓ identificado" / "⚠ revisar manualmente").
- Modo individual: comportamento atual preservado.
- Componente: `src/components/upload-massa.tsx`.

## 3. Comparador SICAF (Antes vs Depois)
- Botão "Ver comparativo" na `/assistente` que abre modal lado a lado:
  - Coluna esquerda: estado atual do SICAF (níveis, validades, pendências)
  - Coluna direita: estado proposto após atualização
  - Diff visual com cores (verde = melhora, vermelho = pendência, amarelo = inalterado)
- Componente: `src/components/comparador-sicaf.tsx`.

## 4. Notificações por WhatsApp / E-mail
- Centro de notificações no header (ícone sino) com lista dos últimos alertas.
- Tela de preferências (`/notificacoes`) com toggles por tipo de evento (vencimento, taxa, atualização) e canal (WhatsApp/E-mail).
- Apenas UI/mock por enquanto (sem backend real de envio).
- Arquivos: `src/components/notificacoes-popover.tsx`, `src/routes/notificacoes.tsx`.

## 5. Cálculo de Prazo Estimado
- Em cada etapa do `/sicaf`, mostrar badge "⏱ ~3 minutos" no topo do card.
- Barra de progresso geral com "Tempo restante estimado: ~12 min".
- Edição inline no array de etapas em `src/routes/sicaf.tsx`.

## 6. Copiar Dados com 1 Clique
- Hook `useCopyToClipboard` em `src/hooks/use-copy.ts`.
- Componente `<CopyButton value="..."/>` reutilizável (ícone copy + check + toast).
- Aplicado em: CNPJ, Inscrição Estadual/Municipal, endereço, dados da empresa nas telas `/empresas` (cards e modais) e `/sicaf`.

## 7. Modo Escuro
- Toggle no header (sol/lua) usando `next-themes` (já parte do shadcn pattern) ou implementação manual com classe `dark` no `<html>`.
- Persistir em `localStorage`.
- Garantir que todos os tokens em `src/styles.css` já tenham variantes `.dark` (revisar e completar se faltar).
- Componente: `src/components/theme-toggle.tsx`.

## 8. Agendamento Automático de Revisão
- Em `/empresas`, ao final de uma atualização SICAF, opção "Lembrar de revisar em: [3 meses / 6 meses / 12 meses]".
- Card "Próximas revisões agendadas" na home.
- Persistência em `localStorage` (mock; pode migrar para Cloud depois).
- Componente: `src/components/agendamento-revisao.tsx`.

## Ordem de Implementação
1. Modo escuro + theme toggle (afeta visual de tudo) — base primeiro
2. Hook copiar + CopyButton (reutilizável em várias telas)
3. Central de Tarefas na home
4. Notificações (popover + página)
5. Prazo estimado no `/sicaf`
6. Upload em massa (toggle no `/sicaf`)
7. Comparador SICAF na `/assistente`
8. Agendamento de revisão

## Observações Técnicas
- Tudo frontend/UI. Sem mudanças de schema ou backend.
- Persistência leve em `localStorage` para notificações lidas, agendamentos, preferência de tema.
- Mantém todos os mocks existentes; apenas adiciona camadas.

Confirma que posso seguir nessa ordem? Se preferir começar por algum item específico, me avise.
