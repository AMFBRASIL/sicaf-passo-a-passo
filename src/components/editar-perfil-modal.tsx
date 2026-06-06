import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
} from "lucide-react";
import bgImg from "@/assets/editar-perfil-bg.jpg";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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

export function EditarPerfilModal({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(1);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    nome: "João Silva",
    cargo: "Diretor Comercial",
    email: "joao@empresa.com",
    telefone: "(61) 99999-0000",
    cep: "70000-000",
    endereco: "SCS Quadra 1, Brasília - DF",
    empresa: "Nova Filial Brasília LTDA",
    cnpj: "12.345.678/0001-90",
    senhaAtual: "",
    novaSenha: "",
    twoFA: true,
    notifEmail: true,
    notifWhats: true,
    notifPush: false,
    idioma: "pt-BR",
  });

  const update = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const progress = ((step - 1) / (steps.length - 1)) * 100;
  const isLast = step === steps.length;

  function handleNext() {
    if (isLast) {
      toast.success("Dados atualizados com sucesso!");
      onOpenChange(false);
      setTimeout(() => setStep(1), 300);
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="overflow-hidden border-0 p-0 sm:max-w-[980px]"
      >
        <div className="grid h-[640px] grid-cols-1 md:grid-cols-[320px_1fr]">
          {/* Sidebar com imagem */}
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

            {/* Steps */}
            <ol className="space-y-2.5">
              {steps.map((s) => {
                const active = s.id === step;
                const done = s.id < step;
                const Icon = s.icon;
                return (
                  <li
                    key={s.id}
                    onClick={() => s.id < step && setStep(s.id)}
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

          {/* Conteúdo */}
          <div className="flex flex-col">
            {/* Progress */}
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

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                        <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                          JS
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110">
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div>
                      <p className="font-semibold">Foto de perfil</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG até 2MB</p>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
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
                    <Input value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} />
                  </FormField>
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
                      placeholder="Mínimo 8 caracteres"
                    />
                  </FormField>
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Shield className="h-4 w-4 text-emerald-600" /> Autenticação em 2 fatores
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Receba um código por SMS ao entrar de um novo dispositivo.
                      </p>
                    </div>
                    <Switch checked={form.twoFA} onCheckedChange={(v) => update("twoFA", v)} />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  {[
                    { k: "notifEmail", label: "Notificações por e-mail", desc: "Resumos e alertas importantes" },
                    { k: "notifWhats", label: "Alertas por WhatsApp", desc: "Vencimentos e oportunidades" },
                    { k: "notifPush", label: "Notificações push", desc: "Alertas em tempo real no navegador" },
                  ].map((n) => (
                    <div key={n.k} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                      <div>
                        <p className="text-sm font-semibold">{n.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.desc}</p>
                      </div>
                      <Switch
                        checked={(form as any)[n.k]}
                        onCheckedChange={(v) => update(n.k as any, v)}
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border bg-card px-6 py-4">
              <Button
                variant="ghost"
                onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => s - 1))}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === 1 ? "Cancelar" : "Voltar"}
              </Button>
              <Button onClick={handleNext} className="gap-1.5">
                {isLast ? (
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
