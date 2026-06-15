"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { readAuthToken } from "@/lib/auth-cookie";

/** Token: query (?token=) da extensão ou storage do CadBrasil */
function getToken(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("token") ||
    readAuthToken() ||
    localStorage.getItem("cadbrasil_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function getHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  const t = getToken();
  if (t) h["Authorization"] = "Bearer " + t;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function extractDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function formatCnpj(cnpjDigits: string): string {
  if (cnpjDigits.length !== 14) return cnpjDigits;
  return cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function isValidCnpj(cnpjDigits: string): boolean {
  if (cnpjDigits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpjDigits)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, d, idx) => acc + Number(d) * weights[idx], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calcDigit(cnpjDigits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(cnpjDigits.slice(0, 12) + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpjDigits.endsWith(String(d1) + String(d2));
}

// ── Regex para comandos invisíveis ──
const CMD_REGEX = /\[CMD:([a-z_]+):([^\]]*)\]/g;
const ACTION_REGEX = /\[AÇÃO:\s*(.+?)\]/g;

/**
 * Extrai comandos [CMD:tipo:param] e [AÇÃO: nome] do texto,
 * retorna o texto limpo (sem comandos) + lista de comandos.
 */
function extractCommands(text: string): { clean: string; commands: Array<{ type: string; param: string }> } {
  const commands: Array<{ type: string; param: string }> = [];

  // Extrair [CMD:tipo:param]
  let match;
  while ((match = CMD_REGEX.exec(text)) !== null) {
    commands.push({ type: match[1], param: match[2].trim() });
  }
  CMD_REGEX.lastIndex = 0;

  // Extrair [AÇÃO: nome] — compatibilidade com o sistema existente
  while ((match = ACTION_REGEX.exec(text)) !== null) {
    commands.push({ type: "action", param: match[1].trim() });
  }
  ACTION_REGEX.lastIndex = 0;

  // Limpar texto removendo todos os comandos
  const clean = text
    .replace(CMD_REGEX, "")
    .replace(ACTION_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { clean, commands };
}

/**
 * Envia comandos para a extensão via window.parent.postMessage.
 * O sidepanel.js escuta e repassa para o background.js.
 */
function sendCommandsToExtension(commands: Array<{ type: string; param: string }>) {
  if (!commands.length) return;

  try {
    window.parent.postMessage(
      { source: "cadbrasil-chat", type: "extension-commands", commands },
      "*",
    );
  } catch (_) {
    /* extensão indisponível */
  }
}

interface ChatMsg {
  id: number;
  role: "user" | "bot" | "system";
  text: string;
}

let msgId = 0;

export default function SicafAssistantChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: msgId++,
      role: "bot",
      text: "👋 Olá! Sou o **Assistente Digital SICAF** da CadBrasil.\n\nPosso te ajudar com:\n• Credenciamento SICAF (Níveis I a VI)\n• Certidões e documentos\n• Renovação e atualização\n• Análise de PDFs do SICAF\n\nDigite sua dúvida ou envie o PDF da **Situação do Fornecedor**!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatBlocked, setChatBlocked] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Pedir contexto fresco da página SICAF à extensão (on-demand, a cada mensagem) ──
  const requestPageContext = useCallback((): Promise<{ url: string; pageText: string; title: string; formData: string[] }> => {
    const empty = { url: "", pageText: "", title: "", formData: [] as string[] };
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(empty);
      }, 2000);

      function handler(event: MessageEvent) {
        const msg = event.data;
        if (msg?.source === "cadbrasil-extension" && msg?.type === "page-context-response") {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(msg.context || empty);
        }
      }

      window.addEventListener("message", handler);
      try {
        window.parent.postMessage({ source: "cadbrasil-chat", type: "request-page-context" }, "*");
      } catch (_) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve(empty);
      }
    });
  }, []);

  const addMsg = useCallback((role: ChatMsg["role"], text: string) => {
    setMessages((prev) => [...prev, { id: msgId++, role, text }]);
  }, []);

  // ── Escutar respostas da extensão (resultados de comandos + progresso de fluxos) ──
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "cadbrasil-extension") return;

      if (msg.type === "flow-progress" && !msg.isError) {
        addMsg("system", `🔄 ${msg.message}`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [addMsg]);

  // ── Verificar CNPJ no backend e atualizar status do chat ──
  const lastReceivedCnpjKey = useRef("");
  const lastValidCnpj = useRef("");
  const [recheckLoading, setRecheckLoading] = useState(false);

  const checkCnpjStatus = useCallback(async (cnpj: string) => {
    try {
      const cnpjDigits = extractDigits(cnpj);
      const cnpjFmt = formatCnpj(cnpjDigits);

      addMsg(
        "system",
        `🔎 Consultando CNPJ: **${cnpjFmt || cnpj || "não informado"}**` +
        (cnpjDigits ? `\n\nDígitos identificados: \`${cnpjDigits}\`` : "")
      );

      if (!isValidCnpj(cnpjDigits)) {
        addMsg(
          "system",
          `🔴 **CNPJ inválido ou não identificado no SICAF.**\n\n` +
          `Valor recebido: \`${cnpj || "vazio"}\`\n` +
          `Dígitos identificados: \`${cnpjDigits || "nenhum"}\`\n\n` +
          "Para liberar a análise, o CNPJ precisa estar corretamente preenchido no formato válido (14 dígitos)."
        );
        setChatBlocked(true);
        return;
      }

      const res = await fetch(`/api/clients/by-documento/${encodeURIComponent(cnpjDigits)}`, {
        headers: getHeaders(),
      });
      const data = await res.json();

      const REGULARIZE_BTN = `\n\n<a href="https://fornecedor.cadbrasil.com.br/sicaf" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:8px 16px;background:#238636;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:12px;">Regularizar no CadBrasil →</a>`;

      const BLOCKED_MSG = "\n\n🚫 **O chat foi desativado.** Para utilizar o Assistente SICAF, regularize sua licença CadBrasil.";

      if (!data.ok || !data.client) {
        addMsg("system",
          `🔴 **CNPJ ${cnpjFmt}** — Cliente **não encontrado** no sistema CadBrasil. Cadastro pendente.` + BLOCKED_MSG + REGULARIZE_BTN
        );
        setChatBlocked(true);
        return;
      }

      const c = data.client;
      const clientName = c.name || c.razao_social || cnpjFmt;
      const isActive = c.status === "Ativo" || c.status === "ativo";
      const hasSicaf = !!c.sicafId || !!c.sicaf_id || c.sicafValid === true;
      const sicafStatus = c.sicafStatus || c.sicaf_status || null;
      const sicafOk = hasSicaf && (sicafStatus === "Ativo" || sicafStatus === "Vencendo");
      const sicafValidadeRaw = c.sicafValidade || c.sicaf_validade || null;
      const sicafValidade = sicafValidadeRaw
        ? new Date(sicafValidadeRaw).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : null;
      const renovacao = c.ultimaRenovacao;
      const hasValidRenovacao = renovacao && renovacao.status === "Concluída";

      // Licença válida = SICAF ativo/vencendo OU renovação concluída
      const licencaValida = sicafOk || hasValidRenovacao;

      if (licencaValida) {
        setChatBlocked(false);
        const detalhes = sicafOk
          ? `SICAF: **${sicafStatus}** | Validade: **${sicafValidade || "—"}**`
          : `Renovação: **Concluída** (${renovacao?.ano || "—"})`;
        const avisoStatus = !isActive
          ? `\n\n⚠ Status cadastral interno: **${c.status || "Pendente"}** (não bloqueia o chat enquanto a licença estiver válida).`
          : "";
        addMsg("system",
          `🟢 **${clientName}** — Licença válida | ${detalhes}\n\n✅ Chat liberado!${avisoStatus}`
        );
      } else {
        const problems: string[] = [];
        if (!isActive) problems.push(`Status do cliente: **${c.status || "Inativo"}**`);
        if (!hasSicaf) problems.push("Licença CADBRASIL **não encontrada.**");
        else if (!sicafOk && !hasValidRenovacao) problems.push(`SICAF: **${sicafStatus || "Pendente"}** — sem renovação válida`);

        addMsg("system",
          `🔴 **${clientName}** (${cnpjFmt}) — **PENDÊNCIAS ENCONTRADAS:**\n${problems.map(p => `• ${p}`).join("\n")}` + BLOCKED_MSG + REGULARIZE_BTN
        );
        setChatBlocked(true);
      }
    } catch (_) {
      /* falha silenciosa na verificação de CNPJ */
    }
  }, [addMsg]);

  const recheckCnpj = useCallback(async () => {
    const cnpj = lastValidCnpj.current;
    if (!cnpj) return;
    setRecheckLoading(true);
    addMsg("system", `🔄 Verificando CNPJ ${cnpj} novamente...`);
    await checkCnpjStatus(cnpj);
    setRecheckLoading(false);
  }, [checkCnpjStatus, addMsg]);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "cadbrasil-extension" || msg.type !== "client-data") return;

      const cnpjRaw = String(
        msg.data?.doc
        || msg.data?.cnpj
        || msg.data?.documento
        || msg.data?.clienteDocumento
        || ""
      ).trim();
      const cnpjDigits = extractDigits(cnpjRaw);
      const cnpjIsValid = isValidCnpj(cnpjDigits);

      // Evitar repetir alertas para o mesmo valor recebido.
      const cacheKey = cnpjIsValid ? cnpjDigits : `invalid:${cnpjRaw}`;
      if (!cacheKey || cacheKey === lastReceivedCnpjKey.current) return;
      lastReceivedCnpjKey.current = cacheKey;

      if (!cnpjIsValid) {
        addMsg(
          "system",
          "🔴 **Não foi possível validar o CNPJ do cliente nesta tela.**\n\n" +
          `Valor recebido da tela: \`${cnpjRaw || "vazio"}\`\n` +
          `Dígitos identificados: \`${cnpjDigits || "nenhum"}\`\n\n` +
          "O campo está vazio ou inválido. Abra o cliente correto no SICAF com CNPJ válido para continuar."
        );
        setChatBlocked(true);
        return;
      }

      lastValidCnpj.current = cnpjDigits;
      await checkCnpjStatus(cnpjDigits);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkCnpjStatus]);

  const updateLastBot = useCallback((text: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      // Encontrar a última mensagem "bot" (ignorando debug/system no meio)
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "bot") {
          copy[i] = { ...copy[i], text };
          break;
        }
      }
      return copy;
    });
  }, []);

  // ── Enviar mensagem (SSE streaming) ──
  const sendMessage = useCallback(async (text?: string) => {
    if (chatBlocked) return;
    const msg = text || input.trim();
    if (!msg) return;
    if (!text) setInput("");

    addMsg("user", msg);
    addMsg("bot", "⏳");
    setLoading(true);

    try {
      // Pedir contexto fresco da página SICAF à extensão neste momento
      const pageContext = await requestPageContext();

      // Montar histórico de conversa para enviar (stateless — servidor não guarda nada)
      const chatHistory = messagesRef.current
        .filter((m) => m.role === "user" || m.role === "bot")
        .filter((m) => m.text !== "⏳" && !m.text.startsWith("⏳"))
        .map((m) => ({
          role: m.role === "user" ? "user" as const : "assistant" as const,
          content: m.text,
        }));

      const res = await fetch("/api/sicaf-assistant/chat", {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify({
          message: msg,
          pageContext,
          chatHistory,
        }),
      });

      if (!res.ok) {
        const errText = `HTTP ${res.status} ${res.statusText}`;
        updateLastBot("⚠ Erro ao comunicar com o servidor.");
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                fullText += parsed.chunk;
                // Mostrar texto durante streaming (sem comandos visíveis)
                const { clean } = extractCommands(fullText);
                updateLastBot(clean || "⏳");
              }
              if (parsed.done && parsed.fullText) {
                fullText = parsed.fullText;
                // Extrair e enviar comandos para a extensão
                const { clean, commands } = extractCommands(fullText);
                updateLastBot(clean || fullText);
                sendCommandsToExtension(commands);
                // Ações do servidor (já extraídas lá também)
                if (parsed.actions?.length) {
                  sendCommandsToExtension(
                    parsed.actions.map((a: string) => ({ type: "action", param: a })),
                  );
                }
              }
            } catch (_) { /* ignorar parsing errors de SSE */ }
          }
        }
      }

      if (!fullText) updateLastBot("Sem resposta do assistente.");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
      updateLastBot("⚠ Sem conexão: " + errMsg);
    }

    setLoading(false);
  }, [input, chatBlocked, addMsg, updateLastBot, requestPageContext]);

  // ── Upload PDF ──
  const uploadFile = useCallback(async (file: File) => {
    if (chatBlocked) return;
    addMsg("user", `📎 Enviando: **${file.name}**`);
    addMsg("bot", "⏳ Analisando documento...");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/sicaf-assistant/upload", {
        method: "POST",
        headers: (() => { const h: Record<string, string> = {}; const t = getToken(); if (t) h["Authorization"] = "Bearer " + t; return h; })(),
        body: formData,
      });

      if (!res.ok) {
        let errorDetail = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errorDetail = errData.error || errorDetail;
        } catch (_) { /* response não é JSON */ }
        updateLastBot("⚠ Erro no upload: " + errorDetail);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.ok && data.prompt) {
        // Mostrar feedback do banco de dados se disponível
          if (data.dbResult && data.dbResult.saved) {
          const db = data.dbResult;

          let emailBloco = "";
          if (db.emailNotificacao?.enviado) {
            emailBloco = `\n\n📧 **E-mail enviado** para ${db.emailNotificacao.para} com o resumo de todos os níveis SICAF.`;
          } else if (db.emailNotificacao?.motivo === "sem_email_destino") {
            emailBloco = "\n\n📧 Cadastre o e-mail da empresa para receber o resumo automático dos níveis.";
          } else if (db.emailNotificacao?.erro) {
            emailBloco = `\n\n📧 Não foi possível enviar o e-mail: ${db.emailNotificacao.erro}`;
          }

          // Bloco do plano de manutenção (apenas quando contabilizado)
          let planoBloco = "";
          if (db.planoStatus) {
            const ps = db.planoStatus;
            const fmtBRL = (v: number) =>
              new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

            if (ps.estado === "manutencao_ativa") {
              planoBloco =
                `\n\n🟢 **Plano de Manutenção: ATIVO**\n` +
                `Atualização contabilizada. Uso ilimitado conforme contrato.`;
            } else if (ps.estado === "gratuito") {
              planoBloco =
                `\n\n🟢 **Plano ATIVO — Atualização contabilizada**\n` +
                `Atualizações gratuitas utilizadas: **${ps.usadas} de ${ps.limite}** ` +
                `(restam **${ps.restantesGratuitas}**).`;
            } else if (ps.estado === "bloqueado") {
              planoBloco =
                `\n\n🔴 **Manutenção BLOQUEADA por uso excessivo**\n` +
                `O limite gratuito (${ps.limite}) foi ultrapassado. ` +
                `Esta atualização foi registrada para cobrança de **${fmtBRL(ps.valorCobranca || 0)}**.\n` +
                `Contrate a manutenção mensal para uso ilimitado.`;
            } else if (ps.estado === "pendente") {
              planoBloco =
                `\n\n🟡 **Credenciamento anual pendente**\n` +
                `A Situação do Fornecedor foi salva, porém o credenciamento anual SICAF ` +
                `não consta como quitado nem com validade vigente no sistema. ` +
                `Regularize a taxa de credenciamento para usar as atualizações gratuitas do plano.`;
            }
          }

          updateLastBot(
            `📄 Documento recebido! Dados salvos no sistema CadBrasil.\n\n` +
            `✅ **${db.clienteNome}** (${db.cnpj})\n` +
            `📊 ${db.certidoesCount} certidão(ões) processada(s) ` +
            `(${db.certidoesInserted} nova(s), ${db.certidoesUpdated} atualizada(s))\n` +
            (db.niveisAfetados?.length ? `📋 Níveis afetados: ${db.niveisAfetados.join(", ")}\n` : "") +
            (db.sicafStatus ? `🔄 Status SICAF: **${db.sicafStatus.status || "?"}** (${db.sicafStatus.completude || 0}% completo)\n` : "") +
            emailBloco +
            planoBloco +
            `\n\n⏳ Analisando detalhes com IA...`
          );
        } else if (data.dbResult && !data.dbResult.saved) {
          updateLastBot("📄 Documento recebido! ⚠ " + (data.dbResult.reason || "Não foi possível salvar no banco.") + "\n\n⏳ Analisando com IA...");
        } else {
          updateLastBot("📄 Documento recebido! Analisando com IA...");
        }
        await sendMessage(data.prompt);
      } else {
        updateLastBot("⚠ " + (data.error || "Erro ao processar."));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro";
      updateLastBot("⚠ Erro: " + errMsg);
    }

    setLoading(false);
  }, [chatBlocked, addMsg, updateLastBot, sendMessage]);

  // ── Escutar PDF capturado pela extensão (interceptado em memória) ──
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "cadbrasil-extension" || msg.type !== "pdf-captured") return;

      try {
        // Converter base64 data URL para Blob/File
        const base64Str: string = msg.base64; // data:application/pdf;base64,...
        const parts = base64Str.split(",");
        if (parts.length < 2) throw new Error("Base64 inválido");
        const byteString = atob(parts[1]);

        // Verificar magic bytes do PDF (%PDF-)
        const isPdf = byteString.length > 5 && byteString.substring(0, 5) === "%PDF-";
        if (!isPdf) {
          addMsg("bot", "⚠ O arquivo capturado não é um PDF válido. O PDF foi baixado na sua pasta **Downloads**. Por favor, envie pelo botão 📎 abaixo.");
          return;
        }

        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: "application/pdf" });
        const file = new File([blob], msg.fileName || "SituacaoFornecedor.pdf", { type: "application/pdf" });

        // Disparar upload automático
        uploadFile(file);
      } catch (_) {
        addMsg("bot", "⚠ Erro ao processar o PDF. Ele foi baixado na pasta **Downloads**. Envie pelo botão 📎.");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [uploadFile, addMsg]);

  // ── Escutar PDF baixado pelo browser (download na pasta Downloads) ──
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "cadbrasil-extension" || msg.type !== "pdf-downloaded") return;

      addMsg("bot",
        `✅ O PDF **${msg.fileName || "Situação do Fornecedor"}** foi baixado com sucesso na sua pasta **Downloads**!\n\n` +
        `Para que eu possa analisar automaticamente, envie o arquivo pelo botão **📎 Enviar Situacao do Fornecedor - PDF** abaixo.`
      );
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [addMsg]);

  // ── Renderizar markdown básico ──
  const renderText = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>")
      .replace(/• /g, "&#8226; ");
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f1117", fontFamily: "system-ui, sans-serif", color: "#e1e4e8" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a7f37, #238636)", padding: "14px 16px", textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>🟢 Assistente SICAF — CadBrasil</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Assistente Virtual IA Gratuito para SICAF</div>
      </div>

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              maxWidth: "90%",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              wordWrap: "break-word",
              ...(m.role === "bot"
                ? { background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9", alignSelf: "flex-start", borderBottomLeftRadius: 4 }
                : m.role === "user"
                ? { background: "#238636", color: "#fff", alignSelf: "flex-end", borderBottomRightRadius: 4 }
                : m.text.startsWith("🔴")
                ? { background: "rgba(248,81,73,0.12)", border: "1px solid rgba(248,81,73,0.35)", color: "#f85149", alignSelf: "stretch", textAlign: "left" as const, fontSize: 12, maxWidth: "100%" }
                : { background: "rgba(31,111,235,0.13)", border: "1px solid rgba(31,111,235,0.26)", color: "#58a6ff", alignSelf: "center", textAlign: "center" as const, fontSize: 12, maxWidth: "100%" }),
            }}
            dangerouslySetInnerHTML={{ __html: renderText(m.text) }}
          />
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", background: "#161b22", borderTop: "1px solid #30363d", flexShrink: 0 }}>
        {chatBlocked && (
          <div style={{ textAlign: "center", padding: "8px 0 10px" }}>
            <div style={{ fontSize: 12, color: "#f85149", fontWeight: 600, marginBottom: 8 }}>
              🚫 Chat desativado — Licença CadBrasil não encontrada
            </div>
            <button
              onClick={recheckCnpj}
              disabled={recheckLoading}
              style={{ background: "#1f6feb", border: "none", borderRadius: 8, padding: "8px 18px", color: "#fff", cursor: recheckLoading ? "wait" : "pointer", fontSize: 12, fontWeight: 600, opacity: recheckLoading ? 0.6 : 1, transition: "opacity 0.2s" }}
            >
              {recheckLoading ? "🔄 Verificando..." : "✅ Já regularizei — Verificar novamente"}
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !loading && !chatBlocked) { e.preventDefault(); sendMessage(); } }}
            placeholder={chatBlocked ? "Chat desativado" : "Digite sua mensagem..."}
            autoComplete="off"
            disabled={chatBlocked}
            style={{ flex: 1, background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, padding: "10px 14px", color: "#e1e4e8", fontSize: 13, outline: "none" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || chatBlocked || !input.trim()}
            style={{ background: "#238636", border: "none", borderRadius: 10, padding: "10px 14px", color: "#fff", cursor: loading || chatBlocked ? "not-allowed" : "pointer", fontSize: 14, opacity: loading || chatBlocked || !input.trim() ? 0.4 : 1 }}
          >
            ➤
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={chatBlocked}
            style={{ background: "#30363d", border: "none", borderRadius: 8, padding: "8px 12px", color: "#8b949e", cursor: chatBlocked ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
          >
            📎 Enviar Situacao do Fornecedor - PDF
          </button>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) { uploadFile(e.target.files[0]); e.target.value = ""; } }} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: "#484f58", alignSelf: "center" }}>CadBrasil v2026</span>
        </div>
      </div>
    </div>
  );
}
