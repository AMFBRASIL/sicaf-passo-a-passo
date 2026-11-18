import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  EMAIL_SECRET_MASK,
  fetchNfseSettings,
  saveNfseSettings,
  testNfseSettings,
  type NfseSettings,
  type NfseSettingsStatus,
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

function ToggleRow({
  title,
  desc,
  checked,
  onCheckedChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface Props {
  onSaved?: () => void;
}

export function NfseConfigPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<NfseSettings | null>(null);
  const [status, setStatus] = useState<NfseSettingsStatus | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNfseSettings();
      setSettings(data.settings);
      setStatus(data.status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar Fiscal Config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const patch = (key: keyof NfseSettings, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const salvar = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload = { ...settings };
      if (!payload.nfse_cert_pfx_password) payload.nfse_cert_pfx_password = EMAIL_SECRET_MASK;
      if (!payload.nfse_cert_pfx_base64) payload.nfse_cert_pfx_base64 = EMAIL_SECRET_MASK;
      const msg = await saveNfseSettings(payload);
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
      const msg = await testNfseSettings();
      toast.success(msg);
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
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações fiscais...
      </div>
    );
  }

  return (
    <>
      {status && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant={status.configured ? "default" : "secondary"} className="text-[10px]">
            {status.configured ? "Pronto para emitir" : "Incompleto"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Fonte: {status.configSource === "database" ? "banco de dados" : ".env"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {status.ambiente === "producao" ? "Produção" : "Produção restrita"}
          </Badge>
          {status.certificadoConfigurado && (
            <Badge variant="outline" className="text-[10px]">
              Certificado OK
            </Badge>
          )}
        </div>
      )}

      <Section title="Geral" desc="Liga/desliga o módulo e define o ambiente da API Nacional.">
        <div className="space-y-3">
          <ToggleRow
            title="NFS-e habilitada"
            desc="Quando desligada, emissão e cancelamento são bloqueados."
            checked={settings.nfse_enabled !== "false"}
            onCheckedChange={(v) => patch("nfse_enabled", v ? "true" : "false")}
          />
          <Field label="Ambiente">
            <Select
              value={settings.nfse_ambiente === "producao" ? "producao" : "producaorestrita"}
              onValueChange={(v) => patch("nfse_ambiente", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="producaorestrita">Produção restrita (homologação)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        title="Certificado A1 (sistema / prestador CadBrasil)"
        desc="Usado nas emissões do portal. Senha e Base64 ficam mascarados; deixe em branco para manter o valor atual."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caminho do PFX" hint="Ex.: C:\certs\empresa.pfx ou /var/certs/empresa.pfx">
            <Input
              value={settings.nfse_cert_pfx_path}
              onChange={(e) => patch("nfse_cert_pfx_path", e.target.value)}
              placeholder="/caminho/certificado.pfx"
            />
          </Field>
          <Field label="Senha do PFX">
            <Input
              type="password"
              placeholder={
                settings.nfse_cert_pfx_password === EMAIL_SECRET_MASK ? "••••••••••••" : ""
              }
              value={
                settings.nfse_cert_pfx_password === EMAIL_SECRET_MASK
                  ? ""
                  : settings.nfse_cert_pfx_password
              }
              onChange={(e) => patch("nfse_cert_pfx_password", e.target.value)}
            />
          </Field>
          <Field
            label="PFX em Base64 (opcional)"
            hint="Alternativa ao caminho em disco. Útil em ambientes sem arquivo local."
          >
            <Input
              type="password"
              placeholder={
                settings.nfse_cert_pfx_base64 === EMAIL_SECRET_MASK ? "•••• (já configurado)" : ""
              }
              value={
                settings.nfse_cert_pfx_base64 === EMAIL_SECRET_MASK ? "" : settings.nfse_cert_pfx_base64
              }
              onChange={(e) => patch("nfse_cert_pfx_base64", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Prestador" desc="Dados do emitente usados no XML da DPS.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CNPJ do prestador">
            <Input
              value={settings.nfse_prestador_cnpj}
              onChange={(e) => patch("nfse_prestador_cnpj", e.target.value)}
            />
          </Field>
          <Field label="Código IBGE município emissor (cMun)">
            <Input
              value={settings.nfse_c_mun_emi}
              onChange={(e) => patch("nfse_c_mun_emi", e.target.value)}
            />
          </Field>
          <Field label="Série DPS">
            <Input value={settings.nfse_serie} onChange={(e) => patch("nfse_serie", e.target.value)} />
          </Field>
          <Field label="Inscrição municipal (IM)">
            <Input
              value={settings.nfse_im_prestador}
              onChange={(e) => patch("nfse_im_prestador", e.target.value)}
            />
          </Field>
          <Field label="E-mail do prestador">
            <Input
              value={settings.nfse_prestador_email}
              onChange={(e) => patch("nfse_prestador_email", e.target.value)}
            />
          </Field>
          <Field label="Telefone do prestador">
            <Input
              value={settings.nfse_prestador_fone}
              onChange={(e) => patch("nfse_prestador_fone", e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3">
          <ToggleRow
            title="Incluir IM no XML"
            desc="Em produção restrita, IM costuma gerar rejeição E0120 se o CNC não tiver cadastro complementar."
            checked={settings.nfse_incluir_im === "true"}
            onCheckedChange={(v) => patch("nfse_incluir_im", v ? "true" : "false")}
          />
        </div>
      </Section>

      <Section title="Tributação do serviço" desc="Códigos usados por padrão na emissão fiscal do cliente.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="cTribNac" hint="6 dígitos (ex.: 010501). Não é o opSimpNac.">
            <Input value={settings.nfse_ctrib_nac} onChange={(e) => patch("nfse_ctrib_nac", e.target.value)} />
          </Field>
          <Field label="cTribMun">
            <Input value={settings.nfse_ctrib_mun} onChange={(e) => patch("nfse_ctrib_mun", e.target.value)} />
          </Field>
          <Field label="cNBS" hint="9 dígitos (ex.: 111032200). Não use a IM aqui.">
            <Input value={settings.nfse_cnbs} onChange={(e) => patch("nfse_cnbs", e.target.value)} />
          </Field>
          <Field label="opSimpNac" hint="1=não optante SN, 2=MEI, 3=ME/EPP">
            <Input
              value={settings.nfse_op_simp_nac}
              onChange={(e) => patch("nfse_op_simp_nac", e.target.value)}
            />
          </Field>
          <Field label="regApTribSN">
            <Input
              value={settings.nfse_reg_ap_trib_sn}
              onChange={(e) => patch("nfse_reg_ap_trib_sn", e.target.value)}
            />
          </Field>
          <Field label="regEspTrib">
            <Input
              value={settings.nfse_reg_esp_trib}
              onChange={(e) => patch("nfse_reg_esp_trib", e.target.value)}
            />
          </Field>
          <Field label="pTotTribSN (%)">
            <Input
              value={settings.nfse_p_tot_trib_sn}
              onChange={(e) => patch("nfse_p_tot_trib_sn", e.target.value)}
            />
          </Field>
          <Field label="CST">
            <Input value={settings.nfse_cst} onChange={(e) => patch("nfse_cst", e.target.value)} />
          </Field>
          <Field label="tpRetPisCofins">
            <Input
              value={settings.nfse_tp_ret_pis_cofins}
              onChange={(e) => patch("nfse_tp_ret_pis_cofins", e.target.value)}
            />
          </Field>
          <Field label="IBGE tomador (padrão)" hint="Usado quando o cliente não tem código IBGE.">
            <Input
              value={settings.nfse_tomador_ibge_padrao}
              onChange={(e) => patch("nfse_tomador_ibge_padrao", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="URLs da API (opcional)"
        desc="Deixe em branco para usar as URLs oficiais do ambiente selecionado."
      >
        <div className="grid gap-4">
          <Field label="SEFIN URL">
            <Input
              value={settings.nfse_sefin_url}
              onChange={(e) => patch("nfse_sefin_url", e.target.value)}
              placeholder="https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional"
            />
          </Field>
          <Field label="ADN Contribuintes URL">
            <Input
              value={settings.nfse_adn_contribuintes_url}
              onChange={(e) => patch("nfse_adn_contribuintes_url", e.target.value)}
            />
          </Field>
          <Field label="DANFSe URL">
            <Input
              value={settings.nfse_danfse_url}
              onChange={(e) => patch("nfse_danfse_url", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Alterações no banco têm prioridade sobre o .env e valem em ~30s (ou imediatamente após salvar).
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void testar()} disabled={testing || saving}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Testar certificado
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={saving || testing}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </>
  );
}
