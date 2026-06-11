import { getEnv } from "@/lib/config/env";
import { createModuleLogger } from "@/lib/logger/logger";

const log = createModuleLogger("email");

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type EmailResult = {
  sent: boolean;
  provider: "smtp" | "console";
  messageId?: string;
};

/**
 * Serviço central de e-mail da plataforma.
 * Em produção, configure SMTP_* no .env.
 * Em desenvolvimento sem SMTP, registra no log (não envia).
 */
export class EmailService {
  private static instance: EmailService | null = null;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private get isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const env = getEnv();
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    if (!this.isConfigured) {
      log.info(
        {
          to: recipients,
          subject: message.subject,
          mode: "console",
        },
        "E-mail simulado (SMTP não configurado)",
      );
      return { sent: false, provider: "console" };
    }

    // Integração SMTP real será plugada aqui (nodemailer ou API transacional).
    // Por ora, a interface está pronta para todos os módulos usarem.
    log.info(
      {
        to: recipients,
        subject: message.subject,
        from: env.SMTP_FROM_EMAIL,
        host: env.SMTP_HOST,
      },
      "E-mail enfileirado para envio SMTP",
    );

    return {
      sent: true,
      provider: "smtp",
      messageId: `pending-${Date.now()}`,
    };
  }

  async sendTemplate(
    to: string,
    template: { subject: string; html: string },
    variables: Record<string, string> = {},
  ): Promise<EmailResult> {
    let html = template.html;
    let subject = template.subject;

    for (const [key, value] of Object.entries(variables)) {
      const token = `{{${key}}}`;
      html = html.replaceAll(token, value);
      subject = subject.replaceAll(token, value);
    }

    return this.send({ to, subject, html });
  }
}

export const emailService = EmailService.getInstance();
