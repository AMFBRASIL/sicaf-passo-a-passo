import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import {
  Mail,
  MessageCircle,
  Bot,
  DollarSign,
  FileCheck2,
  Shield,
  Users,
  TrendingUp,
  Cloud,
  Plug,
  CheckCircle2,
  Key,
  Server,
  Webhook,
  Zap,
  Save,
  X,
  Sparkles,
  Lock,
  AlertTriangle,
  Download,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { EmailsConfigPanel } from "@/components/admin/emails-config-panel";
import { IaConfigPanel } from "@/components/admin/ia-config-panel";
import { StorageConfigPanel } from "@/components/admin/storage-config-panel";

export type ConfigModuleKey =
  | "emails"
  | "whatsapp"
  | "ia"
  | "financeiro"
  | "sicaf"
  | "seguranca"
  | "usuarios"
  | "googleads"
  | "armazenamento"
  | "integracoes";

interface Props {
  moduleKey: ConfigModuleKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODULE_META: Record<ConfigModuleKey, { icon: any; titulo: string; subtitulo: string; tom: string }> = {
  emails: { icon: Mail, titulo: "E-mails", subtitulo: "Configure o envio de e-mails do sistema", tom: "blue" },
  whatsapp: { icon: MessageCircle, titulo: "WhatsApp", subtitulo: "API oficial, webhooks e atendentes", tom: "emerald" },
  ia: { icon: Bot, titulo: "Inteligência Artificial", subtitulo: "Modelos, prompts e limites de uso", tom: "violet" },
  financeiro: { icon: DollarSign, titulo: "Financeiro", subtitulo: "Gateways de pagamento e regras", tom: "emerald" },
  sicaf: { icon: FileCheck2, titulo: "SICAF", subtitulo: "Níveis obrigatórios e automações", tom: "amber" },
  seguranca: { icon: Shield, titulo: "Segurança", subtitulo: "2FA, sessões e políticas", tom: "rose" },
  usuarios: { icon: Users, titulo: "Usuários e Papéis", subtitulo: "RBAC e permissões granulares", tom: "blue" },
  googleads: { icon: TrendingUp, titulo: "Google Ads", subtitulo: "MCC, conversão e atribuição", tom: "emerald" },
  armazenamento: { icon: Cloud, titulo: "Armazenamento", subtitulo: "Bucket, retenção e versionamento", tom: "slate" },
  integracoes: { icon: Plug, titulo: "Integrações", subtitulo: "API pública, webhooks e automações", tom: "violet" },
};

const tomCls: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/20",
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
  rose: "bg-rose-500/10 text-rose-600 ring-rose-500/20",
  slate: "bg-slate-500/10 text-slate-600 ring-slate-500/20",
};

export function ConfiguracaoModal({ moduleKey, open, onOpenChange }: Props) {
  if (!moduleKey) return null;
  const meta = MODULE_META[moduleKey];
  const Icon = meta.icon;

  const handleSave = () => {
    if (moduleKey === "emails" || moduleKey === "ia" || moduleKey === "armazenamento") return;
    toast.success(`Configurações de ${meta.titulo} salvas`, {
      description: "As alterações entram em vigor imediatamente.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">Configurar {meta.titulo}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b bg-gradient-to-br from-muted/30 to-background px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ring-1 ${tomCls[meta.tom]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{meta.titulo}</h2>
              <p className="text-xs text-muted-foreground">{meta.subtitulo}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <ScrollArea className="max-h-[70vh]">
          <div className="p-6">
            {moduleKey === "emails" && <EmailsConfigPanel onSaved={() => onOpenChange(false)} />}
            {moduleKey === "whatsapp" && <WhatsAppBody />}
            {moduleKey === "ia" && <IaConfigPanel onSaved={() => onOpenChange(false)} />}
            {moduleKey === "financeiro" && <FinanceiroBody />}
            {moduleKey === "sicaf" && <SicafBody />}
            {moduleKey === "seguranca" && <SegurancaBody />}
            {moduleKey === "usuarios" && <UsuariosBody />}
            {moduleKey === "googleads" && <GoogleAdsBody />}
            {moduleKey === "armazenamento" && <StorageConfigPanel onSaved={() => onOpenChange(false)} />}
            {moduleKey === "integracoes" && <IntegracoesBody />}
          </div>
        </ScrollArea>

        {/* Footer — e-mails tem botão próprio no painel */}
        {moduleKey !== "emails" && moduleKey !== "ia" && moduleKey !== "armazenamento" && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
            <p className="text-xs text-muted-foreground">As alterações se aplicam a toda a plataforma.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" /> Salvar alterações
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Helpers ─────────────────────────
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
  icon: any;
  title: string;
  desc: string;
  chip?: string;
}) {
  return (
    <button
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

function ToggleRow({
  title,
  desc,
  defaultChecked,
}: {
  title: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  const [v, setV] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={v} onCheckedChange={setV} />
    </div>
  );
}

// ───────────────────────── WHATSAPP ─────────────────────────
function WhatsAppBody() {
  const [tipo, setTipo] = useState<"oficial" | "naoof">("oficial");
  return (
    <>
      <Section title="Tipo de integração" desc="Selecione como conectar o WhatsApp à plataforma.">
        <div className="grid gap-3 sm:grid-cols-2">
          <BigCard selected={tipo === "oficial"} onClick={() => setTipo("oficial")} icon={CheckCircle2} title="API Oficial (Cloud API)" desc="Meta Cloud API com número verificado e templates aprovados." chip="Recomendado" />
          <BigCard selected={tipo === "naoof"} onClick={() => setTipo("naoof")} icon={MessageCircle} title="WhatsApp Web (Evolution/Baileys)" desc="Conexão via QR Code. Sem custo por mensagem, sem garantia." chip="Sem garantia" />
        </div>
      </Section>

      {tipo === "oficial" ? (
        <Section title="Credenciais Meta">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone Number ID"><Input placeholder="123456789012345" /></Field>
            <Field label="WhatsApp Business Account ID"><Input placeholder="987654321098765" /></Field>
            <Field label="Token de acesso"><Input type="password" placeholder="EAAxxxxxxxxxxxxxx" /></Field>
            <Field label="App Secret"><Input type="password" placeholder="••••••••" /></Field>
            <Field label="URL do webhook"><Input defaultValue="https://app.cadbrasil.com.br/api/whatsapp/webhook" readOnly /></Field>
            <Field label="Verify Token"><Input placeholder="cadbrasil_verify_2026" /></Field>
          </div>
        </Section>
      ) : (
        <Section title="Conexão via QR">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8">
            <div className="flex h-40 w-40 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">QR Code</div>
            <p className="text-xs text-muted-foreground">Abra WhatsApp &gt; Dispositivos conectados e escaneie.</p>
            <Button variant="outline" size="sm">Gerar novo QR</Button>
          </div>
        </Section>
      )}

      <Section title="Atendentes & filas">
        <div className="space-y-2">
          <ToggleRow title="Distribuição automática" desc="Distribui novos chats em round-robin entre atendentes online." defaultChecked />
          <ToggleRow title="Horário comercial" desc="Bloqueia disparos fora do horário (08–18h)." defaultChecked />
          <ToggleRow title="Resposta automática fora do expediente" desc="Envia mensagem de retorno automática." />
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── FINANCEIRO ─────────────────────────
function FinanceiroBody() {
  const [gw, setGw] = useState<"asaas" | "stripe" | "mp">("asaas");
  return (
    <>
      <Section title="Gateway de pagamento">
        <div className="grid gap-3 sm:grid-cols-3">
          <BigCard selected={gw === "asaas"} onClick={() => setGw("asaas")} icon={DollarSign} title="Asaas" desc="PIX, boleto e cartão. Antifraude incluso." chip="Brasil" />
          <BigCard selected={gw === "stripe"} onClick={() => setGw("stripe")} icon={DollarSign} title="Stripe" desc="Cartão internacional + recorrência." chip="Internacional" />
          <BigCard selected={gw === "mp"} onClick={() => setGw("mp")} icon={DollarSign} title="Mercado Pago" desc="PIX, cartão e boleto via MP." chip="Brasil" />
        </div>
      </Section>

      <Section title="Credenciais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="API Key" hint="Use a chave de produção apenas em ambiente live.">
            <Input type="password" placeholder="••••••••••••" />
          </Field>
          <Field label="Ambiente">
            <Select defaultValue="prod">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prod">Produção</SelectItem>
                <SelectItem value="sandbox">Sandbox</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Webhook URL"><Input defaultValue="https://app.cadbrasil.com.br/api/financeiro/webhook" readOnly /></Field>
          <Field label="Chave PIX padrão"><Input placeholder="00.000.000/0001-00" /></Field>
        </div>
      </Section>

      <Section title="Regras de cobrança">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Juros por dia (%)"><Input type="number" defaultValue={0.033} step={0.001} /></Field>
          <Field label="Multa por atraso (%)"><Input type="number" defaultValue={2} /></Field>
          <Field label="Dias até vencimento padrão"><Input type="number" defaultValue={7} /></Field>
          <Field label="Tentativas de cobrança"><Input type="number" defaultValue={3} /></Field>
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── SICAF ─────────────────────────
function SicafBody() {
  return (
    <>
      <Section title="Níveis obrigatórios" desc="Marque os níveis exigidos por padrão para novas empresas.">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "Nível I — Credenciamento",
            "Nível II — Habilitação Jurídica",
            "Nível III — Regularidade Fiscal Federal",
            "Nível IV — Regularidade Fiscal Estadual/Municipal",
            "Nível V — Qualificação Técnica",
            "Nível VI — Qualificação Econômico-Financeira",
          ].map((n, i) => (
            <ToggleRow key={n} title={n} desc="Aplicado automaticamente a novas empresas." defaultChecked={i < 4} />
          ))}
        </div>
      </Section>

      <Section title="Automações de vencimento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Avisar com antecedência (dias)"><Input type="number" defaultValue={30} /></Field>
          <Field label="Reenviar lembrete a cada (dias)"><Input type="number" defaultValue={7} /></Field>
        </div>
        <div className="mt-3 space-y-2">
          <ToggleRow title="Abrir ticket automaticamente" desc="Cria ticket interno 30 dias antes do vencimento." defaultChecked />
          <ToggleRow title="Notificar cliente por e-mail e WhatsApp" desc="Dispara comunicação em ambos os canais." defaultChecked />
          <ToggleRow title="Bloquear emissão de relatório se vencido" desc="Apenas relatórios oficiais." />
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── SEGURANÇA ─────────────────────────
function SegurancaBody() {
  return (
    <>
      <Section title="Autenticação">
        <div className="space-y-2">
          <ToggleRow title="2FA obrigatório para admins" desc="Exige autenticação em duas etapas para perfis administradores." defaultChecked />
          <ToggleRow title="2FA opcional para operadores" desc="Permite que operadores ativem 2FA." defaultChecked />
          <ToggleRow title="Login com Google" desc="Permite SSO via Google Workspace." />
        </div>
      </Section>

      <Section title="Política de senhas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tamanho mínimo"><Input type="number" defaultValue={10} /></Field>
          <Field label="Expira em (dias)"><Input type="number" defaultValue={90} /></Field>
        </div>
        <div className="mt-3 space-y-2">
          <ToggleRow title="Exigir maiúscula, número e símbolo" desc="Aumenta complexidade obrigatória." defaultChecked />
          <ToggleRow title="Bloquear senhas vazadas (HIBP)" desc="Consulta lista pública de vazamentos." defaultChecked />
        </div>
      </Section>

      <Section title="Sessões & acesso">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expirar sessão após (horas)"><Input type="number" defaultValue={8} /></Field>
          <Field label="IP allow-list (separado por vírgula)"><Input placeholder="200.100.50.0/24, 187.65.43.10" /></Field>
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── USUÁRIOS ─────────────────────────
function UsuariosBody() {
  const papeis = [
    { n: "Administrador", desc: "Acesso total — configurações, financeiro, equipe.", qt: 2, tom: "rose" },
    { n: "Operador", desc: "Operação de SICAF, certidões e atendimento.", qt: 5, tom: "blue" },
    { n: "Consulta", desc: "Apenas leitura de relatórios e clientes.", qt: 1, tom: "slate" },
  ];
  return (
    <>
      <Section title="Papéis ativos" desc="Defina permissões granulares por módulo.">
        <div className="space-y-2">
          {papeis.map((p) => (
            <div key={p.n} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tomCls[p.tom]}`}>
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.n}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{p.qt} usuários</Badge>
                <Button size="sm" variant="outline">Editar permissões</Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3">
          <Plus className="mr-2 h-3.5 w-3.5" /> Novo papel
        </Button>
      </Section>

      <Section title="Convites">
        <div className="space-y-2">
          <ToggleRow title="Exigir aprovação de admin" desc="Novos cadastros aguardam liberação." defaultChecked />
          <ToggleRow title="Convite expira em 7 dias" desc="Links de convite têm prazo automático." defaultChecked />
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── GOOGLE ADS ─────────────────────────
function GoogleAdsBody() {
  return (
    <>
      <Section title="Conta MCC">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer ID (MCC)"><Input placeholder="123-456-7890" /></Field>
          <Field label="Developer Token"><Input type="password" placeholder="••••••••" /></Field>
          <Field label="OAuth Client ID"><Input placeholder="xxx.apps.googleusercontent.com" /></Field>
          <Field label="OAuth Client Secret"><Input type="password" placeholder="••••••••" /></Field>
        </div>
      </Section>

      <Section title="Conversão & atribuição">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Conversion ID"><Input placeholder="AW-123456789" /></Field>
          <Field label="Conversion Label"><Input placeholder="abcDEF123" /></Field>
          <Field label="Modelo de atribuição">
            <Select defaultValue="data-driven">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last-click">Último clique</SelectItem>
                <SelectItem value="first-click">Primeiro clique</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="data-driven">Data-driven</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Janela de conversão (dias)"><Input type="number" defaultValue={30} /></Field>
        </div>
      </Section>

      <Section title="Sincronização">
        <div className="space-y-2">
          <ToggleRow title="Importar leads automaticamente" desc="Sincroniza leads do Google Ads a cada 15 minutos." defaultChecked />
          <ToggleRow title="Enviar conversões offline" desc="Envia conversões fechadas via API." defaultChecked />
        </div>
      </Section>
    </>
  );
}

// ───────────────────────── INTEGRAÇÕES ─────────────────────────
function IntegracoesBody() {
  const conexoes = [
    { n: "Zapier", st: "Conectado", t: "violet", i: Zap },
    { n: "n8n", st: "Conectado", t: "emerald", i: Webhook },
    { n: "Make (Integromat)", st: "Desconectado", t: "slate", i: Plug },
    { n: "Pipedrive CRM", st: "Conectado", t: "emerald", i: Plug },
    { n: "RD Station", st: "Conectado", t: "emerald", i: Plug },
  ];
  return (
    <>
      <Section title="API pública">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="API Key" hint="Use no header Authorization: Bearer ...">
            <Input type="password" defaultValue="cb_live_8d9f2a1b4c3e5f6789abcdef01234567" />
          </Field>
          <Field label="Rate limit (req/min)"><Input type="number" defaultValue={120} /></Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline"><Key className="mr-1.5 h-3.5 w-3.5" /> Rotacionar chave</Button>
          <Button size="sm" variant="outline">Ver documentação</Button>
        </div>
      </Section>

      <Section title="Webhooks de saída">
        <div className="space-y-2">
          <Field label="URL de destino"><Input placeholder="https://meuapp.com/webhook" /></Field>
          <Field label="Eventos">
            <Select defaultValue="todos">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os eventos</SelectItem>
                <SelectItem value="sicaf">Apenas SICAF</SelectItem>
                <SelectItem value="financeiro">Apenas financeiro</SelectItem>
                <SelectItem value="tickets">Apenas tickets</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ToggleRow title="Assinar payloads (HMAC SHA-256)" desc="Garante autenticidade dos webhooks." defaultChecked />
        </div>
      </Section>

      <Section title="Conexões ativas">
        <div className="space-y-2">
          {conexoes.map((c) => {
            const I = c.i;
            const ativo = c.st === "Conectado";
            return (
              <div key={c.n} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tomCls[c.t]}`}>
                    <I className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.n}</p>
                    <p className="text-xs text-muted-foreground">{ativo ? "Sincronizando" : "Não conectado"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ativo ? "default" : "secondary"} className="text-[10px]">
                    {ativo ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                    {c.st}
                  </Badge>
                  <Button size="sm" variant="outline">{ativo ? "Gerenciar" : "Conectar"}</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
