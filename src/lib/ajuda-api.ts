import { readAuthToken } from "@/lib/auth-cookie";

export async function perguntarAjuda(
  message: string,
  onChunk: (text: string) => void,
): Promise<{ ok: boolean; error?: string; fullText?: string }> {
  const token = readAuthToken() || localStorage.getItem("cadbrasil_token") || "";
  const res = await fetch("/api/sicaf-assistant/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      pageContext: { page: "ajuda", url: window.location.href },
      chatHistory: [],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: string }).error || "Erro ao consultar assistente" };
  }

  const reader = res.body?.getReader();
  if (!reader) return { ok: false, error: "Resposta vazia" };

  const decoder = new TextDecoder();
  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as { text?: string; content?: string };
        const piece = parsed.text || parsed.content || "";
        if (piece) {
          fullText += piece;
          onChunk(fullText);
        }
      } catch {
        fullText += payload;
        onChunk(fullText);
      }
    }
  }
  return { ok: true, fullText };
}
