import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Bot, CheckCircle2, Loader2, Save, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  EMAIL_SECRET_MASK,
  fetchIaSettings,
  saveIaSettings,
  testIaSettings,
  type IaSettings,
  type IaSettingsStatus,
} from "@/lib/admin-settings-api";

const DEFAULT_PROMPT_HINT =
  "Deixe em branco para usar o prompt completo do Assistente SICAF (níveis I–VI, certidões, etc.).";

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
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof Bot;
  title: string;
  desc: string;
  chip?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-col rounded-xl border-2 p-5 text-left transition ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      } ${
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${
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

export function IaConfigPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<IaSettings | null>(null);
  const [status, setStatus] = useState<IaSettingsStatus | null>(null);
  const [temp, setTemp] = useState([0.4]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchIaSettings();
      setSettings(res.settings);
      setStatus(res.status);
      setTemp([parseFloat(res.settings.ia_temperatura) || 0.4]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar IA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const patch = (key: keyof IaSettings, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const salvar = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const msg = await saveIaSettings({
        ...settings,
        ia_temperatura: String(temp[0]),
      });
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
    setTesting(true);
    try {
      if (settings) {
        await saveIaSettings({ ...settings, ia_temperatura: String(temp[0]) });
      }
      const res = await testIaSettings();
      toast.success(res.message, {
        description: res.resposta ? `Resposta: ${res.resposta}` : undefined,
      });
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando configurações de IA...
      </div>
    );
  }

  const provider = settings.ia_provedor || "openai";

  return (
    <>
      {status && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <Badge variant={status.configured ? "default" : "destructive"}>
            {status.configured ? "Configurada" : "Não configurada"}
          </Badge>
          <span className="text-muted-foreground">
            Modelo: <strong className="text-foreground">{status.model}</strong>
          </span>
          {status.apiKeySource !== "none" && (
            <span className="text-muted-foreground">
              API Key:{" "}
              <strong className="text-foreground">
                {status.apiKeySource === "database"
                  ? "banco de dados"
                  : status.apiKeySource === "env"
                    ? ".env (fallback)"
                    : "—"}
              </strong>
            </span>
          )}
        </div>
      )}

      <Section
        title="Provedor de IA"
        desc="Salvo em configuracoes_sistema (categoria ia). Hoje apenas OpenAI está integrado ao assistente SICAF."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <BigCard
            selected={provider === "openai"}
            onClick={() => patch("ia_provedor", "openai")}
            icon={Bot}
            title="OpenAI"
            desc="GPT-4o e variantes. Usado no chat e leitura de PDFs SICAF."
            chip="Funcional"
          />
          <BigCard
            selected={provider === "anthropic"}
            onClick={() => patch("ia_provedor", "anthropic")}
            icon={Bot}
            title="Anthropic"
            desc="Claude — configuração salva, integração em breve."
            chip="Em breve"
            disabled
          />
          <BigCard
            selected={provider === "lovable"}
            onClick={() => patch("ia_provedor", "lovable")}
            icon={Sparkles}
            title="Gateway"
            desc="Provedor agregador — em breve."
            chip="Em breve"
            disabled
          />
        </div>
      </Section>

      <Section title="Modelo e parâmetros">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modelo padrão">
            <Select value={settings.ia_modelo} onValueChange={(v) => patch("ia_modelo", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o (recomendado)</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (econômico)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Limite de tokens / requisição">
            <Input
              type="number"
              value={settings.ia_max_tokens}
              onChange={(e) => patch("ia_max_tokens", e.target.value)}
            />
          </Field>
          <Field
            label="API Key OpenAI"
            hint={
              settings.ia_api_key === EMAIL_SECRET_MASK
                ? "Chave já cadastrada — deixe em branco para manter. Fallback: OPENAI_API_KEY no .env"
                : "Fallback: OPENAI_API_KEY no .env se vazio aqui"
            }
          >
            <Input
              type="password"
              placeholder={settings.ia_api_key === EMAIL_SECRET_MASK ? "••••••••••••" : "sk-..."}
              value={settings.ia_api_key === EMAIL_SECRET_MASK ? "" : settings.ia_api_key}
              onChange={(e) => patch("ia_api_key", e.target.value)}
            />
          </Field>
          <Field label={`Temperatura: ${temp[0].toFixed(2)}`} hint="0 = determinístico, 1 = criativo.">
            <Slider
              value={temp}
              onValueChange={(v) => {
                setTemp(v);
                patch("ia_temperatura", String(v[0]));
              }}
              min={0}
              max={1}
              step={0.05}
            />
          </Field>
        </div>
      </Section>

      <Section title="Prompt base do assistente" desc={DEFAULT_PROMPT_HINT}>
        <Textarea
          rows={6}
          value={settings.ia_prompt_sistema}
          onChange={(e) => patch("ia_prompt_sistema", e.target.value)}
          placeholder="Prompt customizado (opcional)..."
        />
      </Section>

      <Section title="Limites de uso" desc="Regras salvas para futura aplicação no rate limit.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Máx. requisições / dia (por cliente)">
            <Input
              type="number"
              value={settings.ia_limite_requisicoes_dia}
              onChange={(e) => patch("ia_limite_requisicoes_dia", e.target.value)}
            />
          </Field>
          <Field label="Orçamento mensal máximo (R$)">
            <Input
              type="number"
              value={settings.ia_orcamento_mensal_max}
              onChange={(e) => patch("ia_orcamento_mensal_max", e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Limitar requisições por cliente</p>
              <p className="text-xs text-muted-foreground">Controle diário por empresa.</p>
            </div>
            <Switch
              checked={settings.ia_limite_por_cliente !== "false"}
              onCheckedChange={(v) => patch("ia_limite_por_cliente", v ? "true" : "false")}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Bloquear ao atingir orçamento mensal</p>
              <p className="text-xs text-muted-foreground">Encerra chamadas quando ultrapassar o limite.</p>
            </div>
            <Switch
              checked={settings.ia_bloquear_orcamento === "true"}
              onCheckedChange={(v) => patch("ia_bloquear_orcamento", v ? "true" : "false")}
            />
          </div>
        </div>
      </Section>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button variant="outline" className="gap-1.5" disabled={testing || saving} onClick={() => void testar()}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Testar conexão
        </Button>
        <Button className="gap-1.5" disabled={saving} onClick={() => void salvar()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações de IA
        </Button>
      </div>
    </>
  );
}
