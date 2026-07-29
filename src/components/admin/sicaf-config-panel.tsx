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
import {
  PRECO_FALLBACK,
  formatMoneyPtBr,
  maskMoneyPtBrInput,
  parseMoneyPtBr,
} from "@/lib/sicaf-precos";

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
  valorCadastroSicaf: PRECO_FALLBACK.valorCadastroSicaf,
  valorCadastroSicafImediato: PRECO_FALLBACK.valorCadastroSicafImediato,
  valorManutencaoMensal: PRECO_FALLBACK.valorManutencaoMensal,
  valorManutencaoAnual: PRECO_FALLBACK.valorManutencaoMensal * 12,
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

type MoneyKey = "valorCadastroSicaf" | "valorCadastroSicafImediato" | "valorManutencaoMensal" | "valorManutencaoAnual";

type Props = {
  onSaved?: () => void;
};

export function SicafConfigPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SicafSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SicafSettingsStatus | null>(null);
  const [moneyDraft, setMoneyDraft] = useState({
    valorCadastroSicaf: formatMoneyPtBr(DEFAULT_SETTINGS.valorCadastroSicaf),
    valorCadastroSicafImediato: formatMoneyPtBr(DEFAULT_SETTINGS.valorCadastroSicafImediato),
    valorManutencaoMensal: formatMoneyPtBr(DEFAULT_SETTINGS.valorManutencaoMensal),
    valorManutencaoAnual: formatMoneyPtBr(DEFAULT_SETTINGS.valorManutencaoAnual),
  });
  /** Qual campo de manutenção o usuário editou por último — evita sobrescrever o anual digitado. */
  const [manutOrigem, setManutOrigem] = useState<"mensal" | "anual">("mensal");

  const applySettings = (next: SicafSettings) => {
    setSettings(next);
    setMoneyDraft({
      valorCadastroSicaf: formatMoneyPtBr(next.valorCadastroSicaf),
      valorCadastroSicafImediato: formatMoneyPtBr(next.valorCadastroSicafImediato),
      valorManutencaoMensal: formatMoneyPtBr(next.valorManutencaoMensal),
      valorManutencaoAnual: formatMoneyPtBr(next.valorManutencaoAnual),
    });
    setManutOrigem("mensal");
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSicafSettings();
      applySettings({
        ...DEFAULT_SETTINGS,
        ...data.settings,
        valorCadastroSicaf: data.settings.valorCadastroSicaf ?? DEFAULT_SETTINGS.valorCadastroSicaf,
        valorCadastroSicafImediato:
          data.settings.valorCadastroSicafImediato ?? DEFAULT_SETTINGS.valorCadastroSicafImediato,
        valorManutencaoMensal: data.settings.valorManutencaoMensal ?? DEFAULT_SETTINGS.valorManutencaoMensal,
        valorManutencaoAnual:
          data.settings.valorManutencaoAnual
          ?? Math.round((data.settings.valorManutencaoMensal ?? PRECO_FALLBACK.valorManutencaoMensal) * 12 * 100) / 100,
      });
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

  const patchNum = (
    key: keyof Pick<SicafSettings, "avisoAntecedenciaDias" | "lembreteReenvioDias" | "centralAlertaCertidoesDias">,
    raw: string,
  ) => {
    const n = parseInt(raw, 10);
    setSettings((prev) => ({ ...prev, [key]: Number.isFinite(n) && n > 0 ? n : prev[key] }));
  };

  const onMoneyChange = (key: MoneyKey, raw: string) => {
    if (key === "valorManutencaoMensal") setManutOrigem("mensal");
    if (key === "valorManutencaoAnual") setManutOrigem("anual");
    setMoneyDraft((d) => ({ ...d, [key]: maskMoneyPtBrInput(raw) }));
  };

  const commitMoney = (key: MoneyKey) => {
    setSettings((prev) => {
      if (key === "valorManutencaoMensal") {
        const mensal = parseMoneyPtBr(moneyDraft.valorManutencaoMensal, prev.valorManutencaoMensal);
        const anual = Math.round(mensal * 12 * 100) / 100;
        setManutOrigem("mensal");
        setMoneyDraft((d) => ({
          ...d,
          valorManutencaoMensal: formatMoneyPtBr(mensal),
          valorManutencaoAnual: formatMoneyPtBr(anual),
        }));
        return { ...prev, valorManutencaoMensal: mensal, valorManutencaoAnual: anual };
      }
      if (key === "valorManutencaoAnual") {
        // Preserva o anual digitado; mensal só é referência (anual/12).
        const anual = parseMoneyPtBr(moneyDraft.valorManutencaoAnual, prev.valorManutencaoAnual);
        const mensal = Math.round((anual / 12) * 100) / 100;
        setManutOrigem("anual");
        setMoneyDraft((d) => ({
          ...d,
          valorManutencaoMensal: formatMoneyPtBr(mensal),
          valorManutencaoAnual: formatMoneyPtBr(anual),
        }));
        return { ...prev, valorManutencaoMensal: mensal, valorManutencaoAnual: anual };
      }
      const value = parseMoneyPtBr(moneyDraft[key], prev[key]);
      setMoneyDraft((d) => ({ ...d, [key]: formatMoneyPtBr(value) }));
      return { ...prev, [key]: value };
    });
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const valorCadastroSicaf = parseMoneyPtBr(moneyDraft.valorCadastroSicaf, settings.valorCadastroSicaf);
      const valorCadastroSicafImediato = parseMoneyPtBr(
        moneyDraft.valorCadastroSicafImediato,
        settings.valorCadastroSicafImediato,
      );

      let valorManutencaoMensal: number;
      let valorManutencaoAnual: number;
      if (manutOrigem === "anual") {
        valorManutencaoAnual = parseMoneyPtBr(moneyDraft.valorManutencaoAnual, settings.valorManutencaoAnual);
        valorManutencaoMensal = Math.round((valorManutencaoAnual / 12) * 100) / 100;
      } else {
        valorManutencaoMensal = parseMoneyPtBr(moneyDraft.valorManutencaoMensal, settings.valorManutencaoMensal);
        valorManutencaoAnual = Math.round(valorManutencaoMensal * 12 * 100) / 100;
      }

      const payload: SicafSettings = {
        ...settings,
        valorCadastroSicaf,
        valorCadastroSicafImediato,
        valorManutencaoMensal,
        valorManutencaoAnual,
      };
      const msg = await saveSicafSettings(payload);
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
            {status.valorCadastroSicaf != null && (
              <> · SICAF R$ {formatMoneyPtBr(status.valorCadastroSicaf)}</>
            )}
            {status.valorManutencaoAnual != null && (
              <> · Manutenção anual R$ {formatMoneyPtBr(status.valorManutencaoAnual)}</>
            )}
          </span>
        </div>
      )}

      <Section
        title="Valores comerciais"
        desc="Esses valores ficam no banco e alimentam cobranças, planos e telas do portal. Alterar aqui atualiza todos os pontos."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Taxa SICAF padrão (R$)"
            hint="Valor anual do cadastro padrão (lido de configuracoes_sistema)."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                inputMode="numeric"
                className="pl-10 tabular-nums"
                value={moneyDraft.valorCadastroSicaf}
                onChange={(e) => onMoneyChange("valorCadastroSicaf", e.target.value)}
                onBlur={() => commitMoney("valorCadastroSicaf")}
                disabled={saving}
                placeholder="0,00"
              />
            </div>
          </Field>
          <Field
            label="Taxa SICAF imediato (R$)"
            hint="Valor do atendimento imediato (plano sicaf_imediato)."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                inputMode="numeric"
                className="pl-10 tabular-nums"
                value={moneyDraft.valorCadastroSicafImediato}
                onChange={(e) => onMoneyChange("valorCadastroSicafImediato", e.target.value)}
                onBlur={() => commitMoney("valorCadastroSicafImediato")}
                disabled={saving}
                placeholder="0,00"
              />
            </div>
          </Field>
          <Field
            label="Manutenção mensal (R$)"
            hint="Fonte no banco: valor_manutencao_mensal."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                inputMode="numeric"
                className="pl-10 tabular-nums"
                value={moneyDraft.valorManutencaoMensal}
                onChange={(e) => onMoneyChange("valorManutencaoMensal", e.target.value)}
                onBlur={() => commitMoney("valorManutencaoMensal")}
                disabled={saving}
                placeholder="0,00"
              />
            </div>
          </Field>
          <Field
            label="Manutenção anual integral (R$)"
            hint="Valor integral do contrato. Digitar aqui preserva este total (o mensal vira anual÷12 para boletos)."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                inputMode="numeric"
                className="pl-10 tabular-nums"
                value={moneyDraft.valorManutencaoAnual}
                onChange={(e) => onMoneyChange("valorManutencaoAnual", e.target.value)}
                onBlur={() => commitMoney("valorManutencaoAnual")}
                disabled={saving}
                placeholder="0,00"
              />
            </div>
          </Field>
        </div>
      </Section>

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
