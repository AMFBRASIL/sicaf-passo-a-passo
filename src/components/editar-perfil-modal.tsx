import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Lock,
  Shield,
  Check,
  ArrowRight,
  ArrowLeft,
  Camera,
  Bell,
  Globe,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
} from "lucide-react";
import bgImg from "@/assets/editar-perfil-bg.jpg";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import {
  atualizarPerfilEmpresa,
  atualizarPerfilUsuario,
  carregarPerfilEdicao,
  savePreferenciasLocal,
  type PerfilPreferencias,
} from "@/lib/perfil-api";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const steps = [
  { id: 1, title: "Perfil", desc: "Dados pessoais e foto", icon: User },
  { id: 2, title: "Contato", desc: "E-mail, telefone e endereço", icon: Mail },
  { id: 3, title: "Empresa", desc: "Razão social e CNPJ", icon: Building2 },
  { id: 4, title: "Segurança", desc: "Senha e autenticação", icon: Shield },
  { id: 5, title: "Preferências", desc: "Notificações e idioma", icon: Bell },
];

type FormState = {
  clienteId: number | null;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  cep: string;
  endereco: string;
  empresa: string;
  cnpj: string;
  senhaAtual: string;
  novaSenha: string;
  twoFA: boolean;
  notifEmail: boolean;
  notifWhats: boolean;
  notifPush: boolean;
  idioma: string;
};

const emptyForm = (): FormState => ({
  clienteId: null,
  nome: "",
  cargo: "",
  email: "",
  telefone: "",
  cep: "",
  endereco: "",
  empresa: "",
  cnpj: "",
  senhaAtual: "",
  novaSenha: "",
  twoFA: false,
  notifEmail: true,
  notifWhats: true,
  notifPush: false,
  idioma: "pt-BR",
});

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function EditarPerfilModal({ open, onOpenChange }: Props) {
  const { user, setUser, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [showPass, setShowPass] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!open || !user) return;

    let cancelled = false;
    const carregar = async () => {
      setCarregando(true);
      setStep(1);
      setShowPass(false);

      const res = await carregarPerfilEdicao(user);
      if (cancelled) return;

      if (res.ok && res.dados) {
        const d = res.dados;
        setForm({
          clienteId: d.clienteId,
          nome: d.nome,
          cargo: d.cargo,
          email: d.email,
          telefone: d.telefone,
          cep: d.cep,
          endereco: d.endereco,
          empresa: d.empresa,
          cnpj: d.cnpj,
          senhaAtual: "",
          novaSenha: "",
          twoFA: false,
          notifEmail: d.preferencias.notifEmail,
          notifWhats: d.preferencias.notifWhats,
          notifPush: d.preferencias.notifPush,
          idioma: d.preferencias.idioma,
        });
      } else {
        setForm({
          ...emptyForm(),
          nome: user.nome,
          cargo: user.departamento || "",
          email: user.email,
          telefone: user.telefone || "",
        });
      }

      setCarregando(false);
    };

    void carregar();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const progress = ((step - 1) / (steps.length - 1)) * 100;
  const isLast = step === steps.length;
  const avatarIniciais = useMemo(() => iniciais(form.nome || user?.nome || ""), [form.nome, user?.nome]);

  async function handleNext() {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }

    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    if (form.novaSenha.trim() && form.novaSenha.trim().length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      setStep(4);
      return;
    }

    if (form.novaSenha.trim() && !form.senhaAtual.trim()) {
      toast.error("Informe a senha atual para alterar a senha");
      setStep(4);
      return;
    }

    setSalvando(true);
    try {
      const userRes = await atualizarPerfilUsuario({
        nome: form.nome.trim(),
        cargo: form.cargo.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        senhaAtual: form.senhaAtual.trim() || undefined,
        novaSenha: form.novaSenha.trim() || undefined,
      });

      if (!userRes.ok) {
        toast.error(userRes.error || "Erro ao atualizar perfil");
        return;
      }

      if (userRes.user) setUser(userRes.user);

      if (form.clienteId) {
        const empRes = await atualizarPerfilEmpresa(form.clienteId, {
          razao_social: form.empresa.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          cep: form.cep.trim(),
          endereco: form.endereco.trim(),
          responsavel: form.nome.trim(),
        });
        if (!empRes.ok) {
          toast.error(empRes.error || "Perfil salvo, mas houve erro nos dados da empresa");
        }
      }

      const prefs: PerfilPreferencias = {
        notifEmail: form.notifEmail,
        notifWhats: form.notifWhats,
        notifPush: form.notifPush,
        idioma: form.idioma,
      };
      savePreferenciasLocal(user.id, prefs);

      await refreshUser();
      toast.success("Dados atualizados com sucesso!");
      onOpenChange(false);
      setTimeout(() => setStep(1), 300);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-[980px]">
        <DialogTitle className="sr-only">Editar perfil</DialogTitle>
        <div className="grid h-[640px] grid-cols-1 md:grid-cols-[320px_1fr]">
          <aside
            className="relative hidden flex-col justify-between overflow-hidden p-6 text-white md:flex"
            style={{
              backgroundImage: `linear-gradient(135deg, oklch(0.3 0.15 260 / 0.9), oklch(0.35 0.18 280 / 0.85)), url(${bgImg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div>
              <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium backdrop-blur">
                <Sparkles className="h-3 w-3" />
                EDITAR PERFIL
              </div>
              <h2 className="mt-3 text-2xl font-bold leading-tight">
                Mantenha seus dados sempre atualizados
              </h2>
              <p className="mt-2 text-sm text-white/75">
                Informações precisas garantem agilidade em licitações e validações.
              </p>
            </div>

            <ol className="space-y-2.5">
              {steps.map((s) => {
                const active = s.id === step;
                const done = s.id < step;
                const Icon = s.icon;
                return (
                  <li
                    key={s.id}
                    onClick={() => !carregando && s.id < step && setStep(s.id)}
                    className={`group relative flex items-start gap-3 rounded-xl border p-2.5 transition-all ${
                      active
                        ? "border-white/40 bg-white/15 shadow-lg shadow-black/20 backdrop-blur"
                        : done
                          ? "cursor-pointer border-white/15 bg-white/5 hover:bg-white/10"
                          : "border-white/10 bg-transparent opacity-70"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        done
                          ? "bg-emerald-400 text-emerald-950"
                          : active
                            ? "bg-white text-[oklch(0.3_0.15_260)]"
                            : "bg-white/10 text-white/70"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">{s.title}</p>
                      <p className="text-[11px] leading-tight text-white/65">{s.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="text-[11px] text-white/60">
              Etapa {step} de {steps.length} · Dados protegidos por criptografia
            </div>
          </aside>

          <div className="flex flex-col">
            <div className="border-b border-border bg-card px-6 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Etapa {step} de {steps.length}
                  </p>
                  <h3 className="text-lg font-bold tracking-tight">
                    {steps[step - 1].title}
                  </h3>
                </div>
                <span className="text-xs font-medium text-primary">
                  {Math.round(progress)}% completo
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[oklch(0.6_0.2_280)] transition-all duration-500"
                  style={{ width: `${Math.max(progress, 8)}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {carregando ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Carregando seus dados…</p>
                </div>
              ) : (
                <>
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                        <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                          {avatarIniciais || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md opacity-50 cursor-not-allowed"
                        title="Em breve"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div>
                      <p className="font-semibold">Foto de perfil</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG até 2MB</p>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" disabled>
                        Trocar foto
                      </Button>
                    </div>
                  </div>
                  <FormField label="Nome completo" icon={<User className="h-4 w-4" />}>
                    <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} />
                  </FormField>
                  <FormField label="Cargo / função" icon={<Building2 className="h-4 w-4" />}>
                    <Input value={form.cargo} onChange={(e) => update("cargo", e.target.value)} />
                  </FormField>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <FormField label="E-mail" icon={<Mail className="h-4 w-4" />}>
                    <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </FormField>
                  <FormField label="Telefone / WhatsApp" icon={<Phone className="h-4 w-4" />}>
                    <Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} />
                  </FormField>
                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <FormField label="CEP" icon={<MapPin className="h-4 w-4" />}>
                      <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} />
                    </FormField>
                    <FormField label="Endereço">
                      <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} />
                    </FormField>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <FormField label="Razão social" icon={<Building2 className="h-4 w-4" />}>
                    <Input value={form.empresa} onChange={(e) => update("empresa", e.target.value)} />
                  </FormField>
                  <FormField label="CNPJ">
                    <Input value={form.cnpj} readOnly className="bg-muted/50" />
                  </FormField>
                  {!form.clienteId && (
                    <div className="rounded-xl border border-dashed border-warning/40 bg-warning/5 p-4 text-xs text-muted-foreground">
                      Nenhuma empresa vinculada à sua conta. Cadastre uma empresa em <strong>Minhas Empresas</strong>.
                    </div>
                  )}
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                    Para alterar o CNPJ, é necessário enviar comprovante. Vá em <strong>Empresas</strong> para gerenciar mais filiais.
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <FormField label="Senha atual" icon={<Lock className="h-4 w-4" />}>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={form.senhaAtual}
                        onChange={(e) => update("senhaAtual", e.target.value)}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Nova senha" icon={<KeyRound className="h-4 w-4" />}>
                    <Input
                      type="password"
                      value={form.novaSenha}
                      onChange={(e) => update("novaSenha", e.target.value)}
                      placeholder="Mínimo 6 caracteres (deixe em branco para manter)"
                    />
                  </FormField>
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 opacity-60">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Shield className="h-4 w-4 text-emerald-600" /> Autenticação em 2 fatores
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Recurso em desenvolvimento.
                      </p>
                    </div>
                    <Switch checked={form.twoFA} disabled onCheckedChange={(v) => update("twoFA", v)} />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  {[
                    { k: "notifEmail" as const, label: "Notificações por e-mail", desc: "Resumos e alertas importantes" },
                    { k: "notifWhats" as const, label: "Alertas por WhatsApp", desc: "Vencimentos e oportunidades" },
                    { k: "notifPush" as const, label: "Notificações push", desc: "Alertas em tempo real no navegador" },
                  ].map((n) => (
                    <div key={n.k} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                      <div>
                        <p className="text-sm font-semibold">{n.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.desc}</p>
                      </div>
                      <Switch
                        checked={form[n.k]}
                        onCheckedChange={(v) => update(n.k, v)}
                      />
                    </div>
                  ))}
                  <FormField label="Idioma" icon={<Globe className="h-4 w-4" />}>
                    <select
                      value={form.idioma}
                      onChange={(e) => update("idioma", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
                  </FormField>
                </div>
              )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-card px-6 py-4">
              <Button
                variant="ghost"
                disabled={salvando}
                onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => s - 1))}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === 1 ? "Cancelar" : "Voltar"}
              </Button>
              <Button onClick={handleNext} disabled={carregando || salvando} className="gap-1.5">
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                  </>
                ) : isLast ? (
                  <>
                    <Check className="h-4 w-4" /> Salvar alterações
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}
