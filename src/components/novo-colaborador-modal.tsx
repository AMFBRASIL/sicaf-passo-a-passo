import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Crown,
  Eye,
  FileSignature,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  UserCog,
  Users,
  X,
  Building2,
} from "lucide-react";
import bg from "@/assets/colaborador-wizard-bg.jpg";
import { empresasMock } from "@/routes/empresas";

type Vinculo = "socio" | "admin" | "operador" | "consulta";
type Acesso = "todas" | "selecionadas";

const vinculos: { id: Vinculo; label: string; desc: string; icon: typeof User; tone: string }[] = [
  { id: "socio", label: "Sócio / Representante", desc: "Acesso total, assinaturas e decisões finais.", icon: Crown, tone: "from-amber-500/20 to-amber-500/5 border-amber-500/40" },
  { id: "admin", label: "Administrador", desc: "Gerencia documentos, certidões e equipe.", icon: UserCog, tone: "from-primary/20 to-primary/5 border-primary/40" },
  { id: "operador", label: "Operador", desc: "Envia documentos e acompanha pendências.", icon: FileSignature, tone: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40" },
  { id: "consulta", label: "Consulta", desc: "Apenas visualiza dados e relatórios.", icon: Eye, tone: "from-slate-400/20 to-slate-400/5 border-slate-400/40" },
];

const steps = [
  { id: 1, label: "Vínculo", icon: ShieldCheck },
  { id: 2, label: "Dados pessoais", icon: User },
  { id: 3, label: "Empresas", icon: Building2 },
  { id: 4, label: "Revisão", icon: Sparkles },
];

export function NovoColaboradorModal({
  open,
  onOpenChange,
  defaultCnpj,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCnpj?: string;
  onCreate?: (c: { nome: string; email: string; telefone: string; cargo: string; vinculo: Vinculo; cnpjs: string[] }) => void;
}) {
  const [step, setStep] = useState(1);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [acesso, setAcesso] = useState<Acesso>(defaultCnpj ? "selecionadas" : "todas");
  const [cnpjs, setCnpjs] = useState<string[]>(defaultCnpj ? [defaultCnpj] : []);
  const [done, setDone] = useState(false);

  const total = steps.length;
  const progress = (step / total) * 100;

  const reset = () => {
    setStep(1);
    setVinculo(null);
    setNome("");
    setEmail("");
    setTelefone("");
    setCargo("");
    setAcesso(defaultCnpj ? "selecionadas" : "todas");
    setCnpjs(defaultCnpj ? [defaultCnpj] : []);
    setDone(false);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 300);
  };

  const canNext = () => {
    if (step === 1) return Boolean(vinculo);
    if (step === 2) return nome.trim().length > 1 && /.+@.+\..+/.test(email);
    if (step === 3) return acesso === "todas" || cnpjs.length > 0;
    return true;
  };

  const next = () => {
    if (step < total) return setStep((s) => s + 1);
    onCreate?.({
      nome,
      email,
      telefone,
      cargo,
      vinculo: vinculo!,
      cnpjs: acesso === "todas" ? empresasMock.map((e) => e.cnpj) : cnpjs,
    });
    setDone(true);
  };
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const toggleCnpj = (c: string) =>
    setCnpjs((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 sm:max-w-[1000px] max-h-[92vh] overflow-hidden border-0 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[600px]">
          {/* Sidebar */}
          <aside
            className="relative hidden md:flex flex-col justify-between p-8 text-white overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(160deg, rgba(6,28,32,0.78), rgba(8,40,46,0.92)), url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                <Users className="h-3.5 w-3.5" /> Equipe
              </div>
              <h2 className="mt-6 text-3xl font-bold leading-tight">
                Adicione um novo colaborador
              </h2>
              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                Defina o vínculo, dados de contato e quais CNPJs o colaborador pode acessar.
              </p>
            </div>

            {!done && (
              <ol className="space-y-3 mt-8">
                {steps.map((s) => {
                  const Icon = s.icon;
                  const active = s.id === step;
                  const completed = s.id < step;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-xl p-3 transition ${
                        active ? "bg-white/15 backdrop-blur shadow-lg" : "opacity-70"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          completed
                            ? "bg-emerald-400 text-emerald-950"
                            : active
                            ? "bg-white text-slate-900"
                            : "bg-white/15 text-white"
                        }`}
                      >
                        {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-white/60">Etapa {s.id}</p>
                        <p className="text-sm font-semibold truncate">{s.label}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="text-[11px] text-white/50">
              Permissões podem ser ajustadas a qualquer momento no painel.
            </div>
          </aside>

          {/* Content */}
          <div className="flex flex-col bg-card">
            <header className="px-8 pt-6 pb-4 border-b flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  Etapa {Math.min(step, total)} de {total}
                </p>
                <Progress value={done ? 100 : progress} className="mt-2 h-1.5" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleClose(false)}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <ScrollArea className="flex-1">
              <div className="px-8 py-8">
                {done ? (
                  <div className="flex flex-col items-center justify-center text-center py-10">
                    <div className="h-20 w-20 rounded-full bg-success/15 text-success flex items-center justify-center mb-5">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h3 className="text-2xl font-bold">Colaborador cadastrado!</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">
                      Enviamos um convite por e-mail para <span className="font-semibold">{email}</span>.
                      Ele já pode acessar as empresas selecionadas com o vínculo definido.
                    </p>
                  </div>
                ) : step === 1 ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-bold">Qual o vínculo deste colaborador?</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Isso determina o nível de acesso aos CNPJs vinculados.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {vinculos.map((v) => {
                        const Icon = v.icon;
                        const active = vinculo === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVinculo(v.id)}
                            className={`text-left rounded-2xl border-2 bg-gradient-to-br p-5 transition hover:shadow-soft ${v.tone} ${
                              active ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="h-11 w-11 rounded-xl bg-white/70 dark:bg-black/30 flex items-center justify-center">
                                <Icon className="h-5 w-5" />
                              </div>
                              {active && <Check className="h-5 w-5 text-primary" />}
                            </div>
                            <p className="font-semibold mt-3">{v.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{v.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : step === 2 ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-bold">Dados do colaborador</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Usaremos o e-mail para enviar o convite de acesso.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Nome completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Souza" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>E-mail</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@empresa.com" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Telefone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 90000-0000" />
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Cargo (opcional)</Label>
                        <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Gerente Financeiro" />
                      </div>
                    </div>
                  </div>
                ) : step === 3 ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-bold">Quais CNPJs ele acessa?</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Vincule o colaborador a uma ou mais empresas.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setAcesso("todas")}
                        className={`text-left rounded-xl border-2 p-4 transition ${
                          acesso === "todas" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                        }`}
                      >
                        <p className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Todas as empresas</p>
                        <p className="text-xs text-muted-foreground mt-1">Acesso a todos os CNPJs atuais e futuros.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAcesso("selecionadas")}
                        className={`text-left rounded-xl border-2 p-4 transition ${
                          acesso === "selecionadas" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                        }`}
                      >
                        <p className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Selecionar empresas</p>
                        <p className="text-xs text-muted-foreground mt-1">Escolha manualmente os CNPJs permitidos.</p>
                      </button>
                    </div>

                    {acesso === "selecionadas" && (
                      <div className="space-y-2 pt-2">
                        {empresasMock.map((e) => {
                          const checked = cnpjs.includes(e.cnpj);
                          return (
                            <button
                              key={e.cnpj}
                              type="button"
                              onClick={() => toggleCnpj(e.cnpj)}
                              className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                                checked ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{e.nome}</p>
                                <p className="text-xs text-muted-foreground">CNPJ {e.cnpj}</p>
                              </div>
                              <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                                {checked && <Check className="h-3 w-3" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-bold">Revise antes de enviar o convite</h3>
                      <p className="text-sm text-muted-foreground mt-1">Confira os dados do novo colaborador.</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold">
                          {nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{nome}</p>
                          <p className="text-xs text-muted-foreground">{cargo || "—"}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div><p className="text-xs text-muted-foreground">E-mail</p><p>{email}</p></div>
                        <div><p className="text-xs text-muted-foreground">Telefone</p><p>{telefone || "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Vínculo</p><p>{vinculos.find((v) => v.id === vinculo)?.label}</p></div>
                        <div><p className="text-xs text-muted-foreground">Empresas</p>
                          <p>{acesso === "todas" ? "Todas" : `${cnpjs.length} selecionada(s)`}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <footer className="border-t px-8 py-4 flex items-center justify-between gap-3 bg-card">
              {done ? (
                <Button onClick={() => handleClose(false)} size="lg" className="ml-auto gap-2">
                  Concluir <Check className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={prev} disabled={step === 1} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={next} disabled={!canNext()} size="lg" className="gap-2">
                    {step === total ? "Enviar convite" : "Continuar"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
