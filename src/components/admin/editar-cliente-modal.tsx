import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import {
  Building2,
  User,
  KeyRound,
  CheckCircle2,
  ChevronRight,
  Save,
  Edit3,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";

interface Props {
  cliente: ClienteDetalhe | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type StepKey = "empresa" | "contato" | "acesso" | "revisar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "empresa", label: "Empresa", desc: "Dados cadastrais", icon: Building2 },
  { key: "contato", label: "Contato", desc: "Responsável e canais", icon: User },
  { key: "acesso", label: "Acesso", desc: "Login e senha", icon: KeyRound },
  { key: "revisar", label: "Revisar", desc: "Confirmar alterações", icon: CheckCircle2 },
];

const planos = ["Onboarding", "Essencial", "Manutenção SICAF", "Manutenção SICAF Plus", "Premium"];

interface FormState {
  razao: string;
  cnpj: string;
  cidade: string;
  plano: string;
  responsavel: string;
  email: string;
  telefone: string;
  whatsapp: string;
  login: string;
  senha: string;
  forcarTroca: boolean;
  enviarReset: boolean;
}

function gerarSenha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function EditarClienteModal({ cliente, open, onOpenChange }: Props) {
  const [step, setStep] = useState<StepKey>("empresa");
  const [showSenha, setShowSenha] = useState(false);
  const [data, setData] = useState<FormState>({
    razao: "", cnpj: "", cidade: "", plano: "",
    responsavel: "", email: "", telefone: "", whatsapp: "",
    login: "", senha: "", forcarTroca: true, enviarReset: false,
  });

  useEffect(() => {
    if (cliente && open) {
      setData({
        razao: cliente.razao,
        cnpj: cliente.cnpj,
        cidade: cliente.cidade,
        plano: cliente.plano ?? "",
        responsavel: cliente.responsavel,
        email: cliente.email ?? "",
        telefone: cliente.telefone ?? "",
        whatsapp: "",
        login: cliente.email ?? cliente.cnpj,
        senha: "",
        forcarTroca: true,
        enviarReset: false,
      });
      setStep("empresa");
    }
  }, [cliente, open]);

  if (!cliente) return null;

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const canNext: Record<StepKey, boolean> = {
    empresa: !!data.razao.trim() && !!data.cnpj.trim(),
    contato: !!data.responsavel.trim() && !!data.email.trim(),
    acesso: !!data.login.trim(),
    revisar: true,
  };

  const salvar = () => {
    toast.success(`Dados de ${data.razao} atualizados`);
    onOpenChange(false);
  };

  const idxAtual = steps.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Editar cliente</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[600px]">
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
                <Edit3 className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">EDITAR</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">Editar cliente</h2>
            <p className="mt-1 text-xs text-white/70 truncate">{cliente.razao}</p>

            <div className="mt-6 space-y-1">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = s.key === step;
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
                <ShieldCheck className="h-3 w-3" /> Alterações ficam auditadas
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa {idxAtual + 1} de {steps.length}</div>
                <div className="text-base font-semibold">{steps[idxAtual].label}</div>
              </div>
              <div className="w-40 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${((idxAtual + 1) / steps.length) * 100}%` }} />
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[460px]">
              <div className="px-6 py-5">
                {step === "empresa" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Razão social *" className="col-span-2">
                      <Input value={data.razao} onChange={(e) => upd("razao", e.target.value)} />
                    </Field>
                    <Field label="CNPJ *">
                      <Input value={data.cnpj} onChange={(e) => upd("cnpj", e.target.value)} />
                    </Field>
                    <Field label="Cidade">
                      <Input value={data.cidade} onChange={(e) => upd("cidade", e.target.value)} />
                    </Field>
                    <Field label="Plano" className="col-span-2">
                      <Select value={data.plano} onValueChange={(v) => upd("plano", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                        <SelectContent>{planos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}

                {step === "contato" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Responsável *" className="col-span-2">
                      <Input value={data.responsavel} onChange={(e) => upd("responsavel", e.target.value)} />
                    </Field>
                    <Field label="E-mail *" className="col-span-2">
                      <Input type="email" value={data.email} onChange={(e) => upd("email", e.target.value)} />
                    </Field>
                    <Field label="Telefone">
                      <Input value={data.telefone} onChange={(e) => upd("telefone", e.target.value)} />
                    </Field>
                    <Field label="WhatsApp">
                      <Input value={data.whatsapp} onChange={(e) => upd("whatsapp", e.target.value)} />
                    </Field>
                  </div>
                )}

                {step === "acesso" && (
                  <div className="space-y-4">
                    <Field label="Login de acesso *">
                      <Input value={data.login} onChange={(e) => upd("login", e.target.value)} placeholder="email@empresa.com ou CNPJ" />
                    </Field>
                    <Field label="Nova senha">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showSenha ? "text" : "password"}
                            value={data.senha}
                            onChange={(e) => upd("senha", e.target.value)}
                            placeholder="Deixe em branco para manter a atual"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSenha((s) => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button variant="outline" size="sm" type="button" onClick={() => { upd("senha", gerarSenha()); setShowSenha(true); }}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Gerar
                        </Button>
                      </div>
                    </Field>

                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <div className="text-sm font-medium">Forçar troca no próximo login</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Cliente deverá definir nova senha ao acessar.</div>
                      </div>
                      <Switch checked={data.forcarTroca} onCheckedChange={(v) => upd("forcarTroca", v)} />
                    </div>
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <div className="text-sm font-medium">Enviar e-mail de redefinição</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Envia link seguro para o e-mail cadastrado.</div>
                      </div>
                      <Switch checked={data.enviarReset} onCheckedChange={(v) => upd("enviarReset", v)} />
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Razão social" value={data.razao} />
                      <InfoCard label="CNPJ" value={data.cnpj} />
                      <InfoCard label="Cidade" value={data.cidade || "—"} />
                      <InfoCard label="Plano" value={data.plano || "—"} />
                      <InfoCard label="Responsável" value={data.responsavel} />
                      <InfoCard label="E-mail" value={data.email} />
                      <InfoCard label="Telefone" value={data.telefone || "—"} />
                      <InfoCard label="WhatsApp" value={data.whatsapp || "—"} />
                      <InfoCard label="Login" value={data.login} />
                      <InfoCard label="Senha" value={data.senha ? "•••••••• (atualizada)" : "Mantida"} />
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-sm space-y-1">
                      <div>{data.forcarTroca ? "✓" : "✗"} Forçar troca de senha no próximo login</div>
                      <div>{data.enviarReset ? "✓" : "✗"} Enviar e-mail de redefinição</div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-6 py-3 flex items-center justify-between bg-card/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (idxAtual > 0) setStep(steps[idxAtual - 1].key);
                  else onOpenChange(false);
                }}
              >
                {step === "empresa" ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "revisar" ? (
                <Button size="sm" className="gap-1.5" disabled={!canNext[step]} onClick={() => setStep(steps[idxAtual + 1].key)}>
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={salvar}>
                  <Save className="h-3.5 w-3.5" /> Salvar alterações
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
