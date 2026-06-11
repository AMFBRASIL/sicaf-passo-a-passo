import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import {
  Building2,
  User,
  MapPin,
  Briefcase,
  KeyRound,
  CheckCircle2,
  ChevronRight,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar?: (cliente: NovoClienteData) => void | Promise<void>;
}

export interface NovoClienteData {
  // Empresa
  razao: string;
  fantasia: string;
  cnpj: string;
  ie: string;
  porte: string;
  segmento: string;
  // Contato
  responsavel: string;
  cargo: string;
  email: string;
  telefone: string;
  whatsapp: string;
  // Endereço
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Comercial
  plano: string;
  mrr: string;
  vendedor: string;
  origem: string;
  observacoes: string;
  // Acesso
  criarAcesso: boolean;
  emailAcesso: string;
  enviarBoasVindas: boolean;
}

type StepKey = "empresa" | "contato" | "endereco" | "comercial" | "acesso" | "revisar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "empresa", label: "Empresa", desc: "Dados cadastrais (CNPJ)", icon: Building2 },
  { key: "contato", label: "Contato", desc: "Responsável e canais", icon: User },
  { key: "endereco", label: "Endereço", desc: "Localização da sede", icon: MapPin },
  { key: "comercial", label: "Comercial", desc: "Plano, MRR e origem", icon: Briefcase },
  { key: "acesso", label: "Acesso", desc: "Criação de login", icon: KeyRound },
  { key: "revisar", label: "Revisar", desc: "Confirmar e salvar", icon: CheckCircle2 },
];

const planos = ["Onboarding", "Essencial", "Manutenção SICAF", "Manutenção SICAF Plus", "Premium"];
const portes = ["MEI", "ME", "EPP", "Médio", "Grande"];
const segmentos = ["Construção", "Engenharia", "Serviços", "Comércio", "Tecnologia", "Energia", "Outro"];
const vendedores = ["Anderson", "Maria S.", "João P.", "Carla R.", "Indicação"];
const origens = ["Site", "Google Ads", "Indicação", "Inbound", "Prospecção ativa", "Evento"];
const ufs = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const empty: NovoClienteData = {
  razao: "", fantasia: "", cnpj: "", ie: "", porte: "", segmento: "",
  responsavel: "", cargo: "", email: "", telefone: "", whatsapp: "",
  cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  plano: "", mrr: "", vendedor: "", origem: "", observacoes: "",
  criarAcesso: true, emailAcesso: "", enviarBoasVindas: true,
};

export function NovoClienteModal({ open, onOpenChange, onCriar }: Props) {
  const [step, setStep] = useState<StepKey>("empresa");
  const [data, setData] = useState<NovoClienteData>(empty);

  const upd = <K extends keyof NovoClienteData>(k: K, v: NovoClienteData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const canNext: Record<StepKey, boolean> = {
    empresa: !!data.razao.trim() && !!data.cnpj.trim(),
    contato: !!data.responsavel.trim() && !!data.email.trim(),
    endereco: !!data.cidade.trim() && !!data.uf,
    comercial: !!data.plano,
    acesso: true,
    revisar: true,
  };

  const criar = async () => {
    if (!canNext.empresa || !canNext.contato) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    try {
      await onCriar?.(data);
      toast.success(`Cliente ${data.razao} criado com sucesso`);
      setData(empty);
      setStep("empresa");
      onOpenChange(false);
    } catch {
      /* erro tratado no callback */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Novo cliente</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[640px]">
          <div
            className="relative p-6 text-white flex flex-col"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.95)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">NOVO CLIENTE</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">Cadastrar cliente</h2>
            <p className="mt-1 text-xs text-white/70">Wizard guiado em 6 etapas</p>

            <div className="mt-6 space-y-1">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = s.key === step;
                const idxAtual = steps.findIndex((x) => x.key === step);
                const done = i < idxAtual;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStep(s.key)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 transition ${
                      active ? "bg-white/15 backdrop-blur" : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        active ? "bg-white text-slate-900" : done ? "bg-emerald-500/80 text-white" : "bg-white/10"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-[11px] text-white/60 truncate">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6 text-[11px] text-white/60">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Dados em conformidade LGPD
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa {steps.findIndex(s => s.key === step) + 1} de {steps.length}</div>
                <div className="text-base font-semibold">{steps.find((s) => s.key === step)?.label}</div>
              </div>
              <div className="w-40 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((steps.findIndex(s => s.key === step) + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[480px]">
              <div className="px-6 py-5">
                {step === "empresa" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Razão social *" className="col-span-2">
                      <Input value={data.razao} onChange={(e) => upd("razao", e.target.value)} placeholder="Ex.: JR Construtora EIRELI" />
                    </Field>
                    <Field label="Nome fantasia">
                      <Input value={data.fantasia} onChange={(e) => upd("fantasia", e.target.value)} placeholder="Nome comercial" />
                    </Field>
                    <Field label="CNPJ *">
                      <Input value={data.cnpj} onChange={(e) => upd("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                    </Field>
                    <Field label="Inscrição Estadual">
                      <Input value={data.ie} onChange={(e) => upd("ie", e.target.value)} placeholder="Isento ou número" />
                    </Field>
                    <Field label="Porte">
                      <Select value={data.porte} onValueChange={(v) => upd("porte", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{portes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Segmento" className="col-span-2">
                      <Select value={data.segmento} onValueChange={(v) => upd("segmento", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                        <SelectContent>{segmentos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}

                {step === "contato" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Responsável *">
                      <Input value={data.responsavel} onChange={(e) => upd("responsavel", e.target.value)} placeholder="Nome completo" />
                    </Field>
                    <Field label="Cargo">
                      <Input value={data.cargo} onChange={(e) => upd("cargo", e.target.value)} placeholder="Ex.: Sócio-administrador" />
                    </Field>
                    <Field label="E-mail *" className="col-span-2">
                      <Input type="email" value={data.email} onChange={(e) => upd("email", e.target.value)} placeholder="contato@empresa.com.br" />
                    </Field>
                    <Field label="Telefone">
                      <Input value={data.telefone} onChange={(e) => upd("telefone", e.target.value)} placeholder="(00) 0000-0000" />
                    </Field>
                    <Field label="WhatsApp">
                      <Input value={data.whatsapp} onChange={(e) => upd("whatsapp", e.target.value)} placeholder="(00) 00000-0000" />
                    </Field>
                  </div>
                )}

                {step === "endereco" && (
                  <div className="grid grid-cols-6 gap-4">
                    <Field label="CEP" className="col-span-2">
                      <Input value={data.cep} onChange={(e) => upd("cep", e.target.value)} placeholder="00000-000" />
                    </Field>
                    <Field label="Endereço" className="col-span-4">
                      <Input value={data.endereco} onChange={(e) => upd("endereco", e.target.value)} placeholder="Rua / Avenida" />
                    </Field>
                    <Field label="Número" className="col-span-2">
                      <Input value={data.numero} onChange={(e) => upd("numero", e.target.value)} />
                    </Field>
                    <Field label="Complemento" className="col-span-4">
                      <Input value={data.complemento} onChange={(e) => upd("complemento", e.target.value)} placeholder="Sala, andar..." />
                    </Field>
                    <Field label="Bairro" className="col-span-2">
                      <Input value={data.bairro} onChange={(e) => upd("bairro", e.target.value)} />
                    </Field>
                    <Field label="Cidade *" className="col-span-3">
                      <Input value={data.cidade} onChange={(e) => upd("cidade", e.target.value)} />
                    </Field>
                    <Field label="UF *">
                      <Select value={data.uf} onValueChange={(v) => upd("uf", v)}>
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>{ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}

                {step === "comercial" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Plano *">
                      <Select value={data.plano} onValueChange={(v) => upd("plano", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                        <SelectContent>{planos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="MRR (R$)">
                      <Input type="number" value={data.mrr} onChange={(e) => upd("mrr", e.target.value)} placeholder="0,00" />
                    </Field>
                    <Field label="Vendedor responsável">
                      <Select value={data.vendedor} onValueChange={(v) => upd("vendedor", v)}>
                        <SelectTrigger><SelectValue placeholder="Atribuir" /></SelectTrigger>
                        <SelectContent>{vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Origem">
                      <Select value={data.origem} onValueChange={(v) => upd("origem", v)}>
                        <SelectTrigger><SelectValue placeholder="Como chegou" /></SelectTrigger>
                        <SelectContent>{origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Observações" className="col-span-2">
                      <Textarea
                        value={data.observacoes}
                        onChange={(e) => upd("observacoes", e.target.value)}
                        rows={5}
                        placeholder="Contexto comercial, condições especiais, próximos passos..."
                      />
                    </Field>
                  </div>
                )}

                {step === "acesso" && (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <div className="text-sm font-medium">Criar acesso ao portal do cliente</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Gera login e envia link de definição de senha.</div>
                      </div>
                      <Switch checked={data.criarAcesso} onCheckedChange={(v) => upd("criarAcesso", v)} />
                    </div>
                    {data.criarAcesso && (
                      <Field label="E-mail de acesso">
                        <Input
                          type="email"
                          value={data.emailAcesso || data.email}
                          onChange={(e) => upd("emailAcesso", e.target.value)}
                          placeholder="Padrão: e-mail do contato"
                        />
                      </Field>
                    )}
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <div className="text-sm font-medium">Enviar e-mail de boas-vindas</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Inclui guia rápido e dados do plano contratado.</div>
                      </div>
                      <Switch checked={data.enviarBoasVindas} onCheckedChange={(v) => upd("enviarBoasVindas", v)} />
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Razão social" value={data.razao || "—"} />
                      <InfoCard label="CNPJ" value={data.cnpj || "—"} />
                      <InfoCard label="Responsável" value={data.responsavel || "—"} />
                      <InfoCard label="E-mail" value={data.email || "—"} />
                      <InfoCard label="Telefone" value={data.telefone || "—"} />
                      <InfoCard label="Cidade/UF" value={`${data.cidade || "—"}${data.uf ? "/" + data.uf : ""}`} />
                      <InfoCard label="Plano" value={data.plano || "—"} />
                      <InfoCard label="MRR" value={data.mrr ? `R$ ${data.mrr}` : "—"} />
                      <InfoCard label="Vendedor" value={data.vendedor || "—"} />
                      <InfoCard label="Origem" value={data.origem || "—"} />
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <div className="text-[11px] text-muted-foreground">Acesso ao portal</div>
                      <div className="text-sm font-medium mt-0.5">
                        {data.criarAcesso ? `Será criado para ${data.emailAcesso || data.email || "—"}` : "Não será criado"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-3">Boas-vindas</div>
                      <div className="text-sm font-medium mt-0.5">{data.enviarBoasVindas ? "E-mail será enviado" : "Não enviar"}</div>
                    </div>
                    {data.observacoes && (
                      <div className="rounded-lg border bg-card p-4">
                        <div className="text-[11px] text-muted-foreground">Observações</div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{data.observacoes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-6 py-3 flex items-center justify-between bg-card/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const idx = steps.findIndex((s) => s.key === step);
                  if (idx > 0) setStep(steps[idx - 1].key);
                  else onOpenChange(false);
                }}
              >
                {step === "empresa" ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "revisar" ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!canNext[step]}
                  onClick={() => {
                    const idx = steps.findIndex((s) => s.key === step);
                    setStep(steps[idx + 1].key);
                  }}
                >
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={criar}>
                  <Save className="h-3.5 w-3.5" /> Salvar cliente
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
