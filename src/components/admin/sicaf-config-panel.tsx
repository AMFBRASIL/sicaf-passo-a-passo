import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileCheck2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSicafSettings,
  saveSicafSettings,
  type SicafSettings,
  type SicafSettingsStatus,
} from "@/lib/admin-settings-api";

const NIVEL_LABELS = [
  "Nível I — Credenciamento",
  "Nível II — Habilitação Jurídica",
  "Nível III — Regularidade Fiscal Federal",
  "Nível IV — Regularidade Fiscal Estadual/Municipal",
  "Nível V — Qualificação Técnica",
  "Nível VI — Qualificação Econômico-Financeira",
];

const DEFAULT_SETTINGS: SicafSettings = {
  niveisObrigatorios: [true, true, true, true, false, false],
  avisoAntecedenciaDias: 30,
  lembreteReenvioDias: 7,
  centralAlertaCertidoesDias: 30,
  ticketAutomatico: true,
  notificarEmailWhatsapp: true,
  bloquearRelatorioVencido: false,
};

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
  checked,
  onCheckedChange,
  disabled,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

type Props = {
  onSaved?: () => void;
};

export function SicafConfigPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SicafSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SicafSettingsStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSicafSettings();
      setSettings(data.settings);
      setStatus(data.status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar configurações SICAF");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchNivel = (index: number, value: boolean) => {
    setSettings((prev) => {
      const niveis = [...prev.niveisObrigatorios];
      niveis[index] = value;
      return { ...prev, niveisObrigatorios: niveis };
    });
  };

  const patchNum = (key: keyof Pick<SicafSettings, "avisoAntecedenciaDias" | "lembreteReenvioDias" | "centralAlertaCertidoesDias">, raw: string) => {
    const n = parseInt(raw, 10);
    setSettings((prev) => ({ ...prev, [key]: Number.isFinite(n) && n > 0 ? n : prev[key] }));
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const msg = await saveSicafSettings(settings);
      toast.success(msg);
      await load();
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando configurações SICAF…
      </div>
    );
  }

  const diasAviso = settings.avisoAntecedenciaDias;

  return (
    <>
      {status && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <FileCheck2 className="h-4 w-4 shrink-0" />
          <span>
            {status.niveisAtivos} nível(is) obrigatório(s) · Central de alertas: {status.centralAlertaDias} dias ·
            Aviso antecedência: {status.avisoAntecedenciaDias} dias
          </span>
        </div>
      )}

      <Section title="Níveis obrigatórios" desc="Marque os níveis exigidos por padrão para novas empresas.">
        <div className="grid gap-2 sm:grid-cols-2">
          {NIVEL_LABELS.map((label, i) => (
            <ToggleRow
              key={label}
              title={label}
              desc="Aplicado automaticamente a novas empresas."
              checked={settings.niveisObrigatorios[i] ?? false}
              onCheckedChange={(v) => patchNivel(i, v)}
              disabled={saving}
            />
          ))}
        </div>
      </Section>

      <Section title="Automações de vencimento">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Avisar com antecedência (dias)" hint="Classifica certidões como “vencendo” no checklist.">
            <Input
              type="number"
              min={1}
              value={settings.avisoAntecedenciaDias}
              onChange={(e) => patchNum("avisoAntecedenciaDias", e.target.value)}
              disabled={saving}
            />
          </Field>
          <Field label="Reenviar lembrete a cada (dias)">
            <Input
              type="number"
              min={1}
              value={settings.lembreteReenvioDias}
              onChange={(e) => patchNum("lembreteReenvioDias", e.target.value)}
              disabled={saving}
            />
          </Field>
          <Field
            label="Central de Alertas — certidões a vencer (dias)"
            hint="Na página inicial do cliente, só aparecem alertas de certidões que vencem dentro deste prazo."
          >
            <Input
              type="number"
              min={1}
              value={settings.centralAlertaCertidoesDias}
              onChange={(e) => patchNum("centralAlertaCertidoesDias", e.target.value)}
              disabled={saving}
            />
          </Field>
        </div>
        <div className="mt-3 space-y-2">
          <ToggleRow
            title="Abrir ticket automaticamente"
            desc={`Cria ticket interno ${diasAviso} dias antes do vencimento.`}
            checked={settings.ticketAutomatico}
            onCheckedChange={(v) => setSettings((p) => ({ ...p, ticketAutomatico: v }))}
            disabled={saving}
          />
          <ToggleRow
            title="Notificar cliente por e-mail e WhatsApp"
            desc="Dispara comunicação em ambos os canais."
            checked={settings.notificarEmailWhatsapp}
            onCheckedChange={(v) => setSettings((p) => ({ ...p, notificarEmailWhatsapp: v }))}
            disabled={saving}
          />
          <ToggleRow
            title="Bloquear emissão de relatório se vencido"
            desc="Apenas relatórios oficiais."
            checked={settings.bloquearRelatorioVencido}
            onCheckedChange={(v) => setSettings((p) => ({ ...p, bloquearRelatorioVencido: v }))}
            disabled={saving}
          />
        </div>
      </Section>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button className="gap-1.5" disabled={saving} onClick={() => void salvar()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações SICAF
        </Button>
      </div>
    </>
  );
}
