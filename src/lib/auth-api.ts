import { apiFetch } from "@/lib/api-fetch";

export async function solicitarRecuperacaoSenha(
  email: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      auth: false,
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Não foi possível enviar o e-mail" };
    }
    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Erro de conexão. Tente novamente." };
  }
}

export async function redefinirSenhaComToken(params: {
  token: string;
  novaSenha: string;
  confirmarSenha: string;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      auth: false,
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Não foi possível redefinir a senha" };
    }
    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Erro de conexão. Tente novamente." };
  }
}
