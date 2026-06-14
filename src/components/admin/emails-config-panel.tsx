import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Send,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  EMAIL_SECRET_MASK,
  fetchEmailSettings,
  fetchEmailTemplatesAdmin,
  saveEmailSettings,
  testEmailSettings,
  updateEmailTemplateAdmin,
  type EmailSettings,
  type EmailSettingsStatus,
  type EmailTemplateAdmin,
} from "@/lib/admin-settings-api";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BigCard({
  selected,
  onClick,
  icon: I,
  title,
  desc,
  chip,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof Zap;
  title: string;
  desc: string;
  chip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col rounded-xl border-2 p-5 text-left transition ${
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg transition ${
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          <I className="h-6 w-6" />
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </div>
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      {chip && (
        <Badge variant="secondary" className="mt-3 w-fit text-[10px]">
          {chip}
        </Badge>
      )}
    </button>
  );
}

interface Props {
  onSaved?: () => void;
}

export function EmailsConfigPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailSettingsStatus | null>(null);
  const [testTo, setTestTo] = useState("");
  const [templateCount, setTemplateCount] = useState(0);
  const [templates, setTemplates] = useState<EmailTemplateAdmin[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAssunto, setEditAssunto] = useState("");
  const [editCorpo, setEditCorpo] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { settings: s, templateCount: tc, status } = await fetchEmailSettings();
      setSettings(s);
      setEmailStatus(status);
      setTemplateCount(tc);
      const tpl = await fetchEmailTemplatesAdmin();
      setTemplates(tpl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar e-mail");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const patch = (key: keyof EmailSettings, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const salvar = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const msg = await saveEmailSettings(settings);
      toast.success(msg);
      await carregar();
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const testar = async () => {
    if (!testTo.trim()) {
      toast.error("Informe o e-mail de destino para o teste");
      return;
    }
    setTesting(true);
    try {
      const msg = await testEmailSettings(testTo.trim(), settings);
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  };

  const iniciarEdicaoTemplate = (t: EmailTemplateAdmin) => {
    setEditingId(t.id);
    setEditAssunto(t.assunto);
    setEditCorpo(t.corpoHtml);
  };

  const salvarTemplate = async (id: number) => {
    try {
      const msg = await updateEmailTemplateAdmin(id, {
        assunto: editAssunto,
        corpoHtml: editCorpo,
      });
      toast.success(msg);
      setEditingId(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar template");
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando configurações de e-mail...
      </div>
    );
  }

  const metodo = settings.smtp_metodo === "smtp" ? "smtp" : "api";

  return (
    <>
      <Section
        title="Método de envio"
        desc="Configurações salvas em configuracoes_sistema (categoria email)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <BigCard
            selected={metodo === "api"}
            onClick={() => patch("smtp_metodo", "api")}
            icon={Zap}
            title="API (recomendado)"
            desc="Mailgun, SendGrid ou Resend via API key."
            chip="Atual no banco"
          />
          <BigCard
            selected={metodo === "smtp"}
            onClick={() => patch("smtp_metodo", "smtp")}
            icon={Server}
            title="SMTP"
            desc="Servidor SMTP próprio ou relay do provedor."
            chip="Padrão universal"
          />
        </div>
      </Section>

      {emailStatus?.apiKeySource === "database" && metodo === "api" && (
        <p className="mt-2 text-xs text-muted-foreground">
          API Key carregada de <code className="rounded bg-muted px-1">configuracoes_sistema</code> (banco de dados).
        </p>
      )}

      {metodo === "api" ? (
        <Section title="Configuração da API">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provedor">
              <Select value={settings.smtp_provider || "mailgun"} onValueChange={(v) => patch("smtp_provider", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mailgun">Mailgun</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="postmark">Postmark</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="API Key"
              hint={
                settings.smtp_api_key === EMAIL_SECRET_MASK
                  ? "Chave já cadastrada — deixe em branco para manter."
                  : "Armazenada em configuracoes_sistema."
              }
            >
              <Input
                type="password"
                placeholder={settings.smtp_api_key === EMAIL_SECRET_MASK ? "••••••••••••" : "Chave da API"}
                value={settings.smtp_api_key === EMAIL_SECRET_MASK ? "" : settings.smtp_api_key}
                onChange={(e) => patch("smtp_api_key", e.target.value)}
              />
            </Field>
            <Field label="E-mail remetente">
              <Input
                value={settings.smtp_email_remetente}
                onChange={(e) => patch("smtp_email_remetente", e.target.value)}
                placeholder="noreply@cadbrasil.com.br"
              />
            </Field>
            <Field label="Nome do remetente">
              <Input
                value={settings.smtp_nome_remetente}
                onChange={(e) => patch("smtp_nome_remetente", e.target.value)}
                placeholder="CadBrasil Licitações"
              />
            </Field>
          </div>
        </Section>
      ) : (
        <Section title="Configuração SMTP">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Servidor SMTP">
              <Input value={settings.smtp_host} onChange={(e) => patch("smtp_host", e.target.value)} />
            </Field>
            <Field label="Porta">
              <Input value={settings.smtp_porta} onChange={(e) => patch("smtp_porta", e.target.value)} />
            </Field>
            <Field label="Usuário">
              <Input value={settings.smtp_usuario} onChange={(e) => patch("smtp_usuario", e.target.value)} />
            </Field>
            <Field
              label="Senha"
              hint={
                settings.smtp_senha === EMAIL_SECRET_MASK
                  ? "Senha já cadastrada — deixe em branco para manter."
                  : undefined
              }
            >
              <Input
                type="password"
                placeholder={settings.smtp_senha === EMAIL_SECRET_MASK ? "••••••••" : ""}
                value={settings.smtp_senha === EMAIL_SECRET_MASK ? "" : settings.smtp_senha}
                onChange={(e) => patch("smtp_senha", e.target.value)}
              />
            </Field>
            <Field label="E-mail remetente">
              <Input
                value={settings.smtp_email_remetente}
                onChange={(e) => patch("smtp_email_remetente", e.target.value)}
              />
            </Field>
            <Field label="Nome do remetente">
              <Input
                value={settings.smtp_nome_remetente}
                onChange={(e) => patch("smtp_nome_remetente", e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">TLS</p>
                <p className="text-xs text-muted-foreground">Criptografia na conexão SMTP</p>
              </div>
              <Switch
                checked={settings.smtp_tls !== "false"}
                onCheckedChange={(v) => patch("smtp_tls", v ? "true" : "false")}
              />
            </div>
          </div>
        </Section>
      )}

      <Section title="Testar envio" desc="Usa as configurações do formulário (não precisa salvar antes).">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <Field label="Enviar teste para">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="seu@email.com"
              />
            </Field>
          </div>
          <Button variant="outline" className="gap-1.5" disabled={testing || saving} onClick={() => void testar()}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar teste
          </Button>
        </div>
      </Section>

      <Section
        title={`Templates de e-mail (${templateCount})`}
        desc="Conteúdo em templates_email — usados nos avisos ao cliente."
      >
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/40"
          onClick={() => setTemplatesOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {templates.length} template(s) cadastrado(s)
          </span>
          {templatesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {templatesOpen && (
          <div className="mt-2 space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">{t.assunto || "Sem assunto"}</p>
                  </div>
                  <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px]">
                    {t.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {editingId === t.id ? (
                  <div className="mt-3 space-y-2">
                    <Field label="Assunto">
                      <Input value={editAssunto} onChange={(e) => setEditAssunto(e.target.value)} />
                    </Field>
                    <Field label="Corpo HTML">
                      <Textarea rows={6} value={editCorpo} onChange={(e) => setEditCorpo(e.target.value)} />
                    </Field>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void salvarTemplate(t.id)}>
                        Salvar template
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => iniciarEdicaoTemplate(t)}
                  >
                    Editar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="mt-6 flex justify-end border-t pt-4">
        <Button className="gap-1.5" disabled={saving} onClick={() => void salvar()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações de e-mail
        </Button>
      </div>
    </>
  );
}
