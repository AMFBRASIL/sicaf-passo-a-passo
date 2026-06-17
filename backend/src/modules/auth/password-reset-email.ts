import { getEnv } from "@/lib/config/env";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

type LegacyEmailService = {
  send: (opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => Promise<{ ok: boolean; error?: string; sent?: boolean }>;
};

export async function sendPasswordResetEmail(params: {
  to: string;
  nome: string;
  resetUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, nome, resetUrl } = params;
  const env = getEnv();
  const portalName = env.SMTP_FROM_NAME || "CADBRASIL";

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;padding:24px;max-width:560px">
    <h2 style="margin:0 0 8px">Redefinição de senha — ${portalName}</h2>
    <p>Olá${nome ? `, <strong>${nome}</strong>` : ""}!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta no portal ${portalName}.</p>
    <p style="margin:20px 0">
      <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
        Redefinir minha senha
      </a>
    </p>
    <p style="font-size:13px;color:#475569">Ou copie e cole este link no navegador:<br><span style="word-break:break-all">${resetUrl}</span></p>
    <p style="font-size:12px;color:#64748b;margin-top:24px">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.</p>
  </body></html>`;

  const text = `Redefinição de senha — ${portalName}\n\nAcesse o link para definir uma nova senha (válido por 1 hora):\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail.`;

  try {
    const emailService = await getSicafAgentModule<LegacyEmailService>("services/email.service");
    const result = await emailService.send({
      to,
      subject: `Redefinir senha — ${portalName}`,
      html,
      text,
    });
    if (!result.ok) {
      return { ok: false, error: result.error || "Falha ao enviar e-mail" };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar e-mail";
    return { ok: false, error: message };
  }
}

export function buildPasswordResetUrl(token: string): string {
  const env = getEnv();
  const base =
    process.env.PORTAL_URL ||
    process.env.FRONTEND_URL ||
    env.FRONTEND_URL ||
    "http://localhost:5173";
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/auth/recuperar-senha?token=${encodeURIComponent(token)}`;
}
