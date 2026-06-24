import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffUser } from "@/lib/auth-roles";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Entrar — Portal CADBRASIL" },
      { name: "description", content: "Acesse o Portal do Fornecedor CADBRASIL com segurança." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const defaultRoute = isStaffUser(user) ? "/admin" : "/";

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void navigate({ to: defaultRoute });
    }
  }, [authLoading, isAuthenticated, defaultRoute, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await login(email.trim(), senha);
    setLoading(false);

    if (result.ok) {
      toast.success("Login realizado com sucesso!", {
        description: "Redirecionando para o portal...",
      });
      const route = isStaffUser(result.user) ? "/admin" : "/";
      void navigate({ to: route });
      return;
    }

    toast.error(result.error || "Falha no login");
  }

  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0f1729] text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm text-white/70">Carregando...</p>
        </div>
      }
    >
      <AuthPageContent
        authLoading={authLoading}
        isAuthenticated={isAuthenticated}
        loading={loading}
        email={email}
        senha={senha}
        showPass={showPass}
        onEmailChange={setEmail}
        onSenhaChange={setSenha}
        onTogglePass={() => setShowPass((s) => !s)}
        onSubmit={onSubmit}
        forgotEmail={email.trim()}
      />
    </ClientOnly>
  );
}

function AuthPageContent({
  authLoading,
  isAuthenticated,
  loading,
  email,
  senha,
  showPass,
  onEmailChange,
  onSenhaChange,
  onTogglePass,
  onSubmit,
  forgotEmail,
}: {
  authLoading: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  email: string;
  senha: string;
  showPass: boolean;
  onEmailChange: (v: string) => void;
  onSenhaChange: (v: string) => void;
  onTogglePass: () => void;
  onSubmit: (e: React.FormEvent) => void;
  forgotEmail?: string;
}) {
  if (authLoading || isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0f1729] text-white">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-sm text-white/70">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#0f1729] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-blue-600/40 blur-[120px]" />
        <div className="absolute -bottom-40 -right-24 h-[600px] w-[600px] rounded-full bg-cyan-500/25 blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
        <aside className="relative hidden min-h-dvh flex-col justify-between p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-white/60 shadow-2xl shadow-black/30">
              <ShieldCheck className="h-6 w-6 text-[oklch(0.3_0.15_260)]" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">CADBRASIL</p>
              <p className="text-xs text-white/60">Portal do Fornecedor</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-white/80">Plataforma oficial certificada</span>
              </div>
              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight">
                Sua jornada para
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-fuchsia-300 bg-clip-text text-transparent">
                  vencer licitações
                </span>
                <br />
                começa aqui.
              </h1>
            </div>
            <ul className="grid gap-3">
              {[
                "Acompanhamento SICAF em tempo real",
                "Certidões e documentos sempre atualizados",
                "Assistente IA para licitações",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-white/85">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/40">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-6 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Criptografia AES-256
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Conformidade LGPD
            </span>
          </div>
        </aside>

        <main className="flex min-h-dvh items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-md">
            <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
              <div className="mb-6 flex items-center gap-2 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <ShieldCheck className="h-5 w-5 text-[oklch(0.3_0.15_260)]" />
                </div>
                <span className="font-bold tracking-tight">CADBRASIL</span>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
                <p className="mt-1 text-sm text-white/60">
                  Entre com suas credenciais do portal CADBRASIL.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <Field
                  icon={<Mail className="h-4 w-4" />}
                  label="E-mail"
                  value={email}
                  onChange={onEmailChange}
                  placeholder="voce@empresa.com.br"
                  type="email"
                  required
                  autoComplete="email"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-white/80">Senha</Label>
                    <Link
                      to="/esqueci-senha"
                      search={forgotEmail ? { email: forgotEmail } : {}}
                      className="text-xs text-white/60 transition-colors hover:text-white"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="group relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                      <Lock className="h-4 w-4" />
                    </span>
                    <Input
                      type={showPass ? "text" : "password"}
                      value={senha}
                      onChange={(e) => onSenhaChange(e.target.value)}
                      placeholder="••••••••••"
                      required
                      autoComplete="current-password"
                      className="h-11 border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20"
                    />
                    <button
                      type="button"
                      onClick={onTogglePass}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                  <Checkbox className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-[oklch(0.2_0.05_260)]" />
                  Manter conectado por 7 dias
                </label>

                <Button
                  type="submit"
                  disabled={loading}
                  className="group relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-white to-white/90 text-[oklch(0.2_0.05_260)] shadow-xl shadow-black/30"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar agora
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </span>
                </Button>
              </form>

              <p className="mt-6 text-center text-[11px] text-white/40">
                <Link to="/" className="hover:text-white/70">
                  Voltar ao início
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type,
  required,
  autoComplete,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-white/80">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
          {icon}
        </span>
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20"
        />
      </div>
    </div>
  );
}
