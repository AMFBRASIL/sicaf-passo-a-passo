import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Fingerprint,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Portal CADBRASIL" },
      { name: "description", content: "Acesse o Portal do Fornecedor CADBRASIL com segurança." },
    ],
  }),
  component: LoginPage,
});

type Mode = "login" | "cadastro";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");

  const strength = passwordStrength(senha);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(mode === "login" ? "Bem-vindo de volta!" : "Conta criada com sucesso!");
      navigate({ to: "/" });
    }, 900);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[oklch(0.13_0.04_255)] text-white">
      {/* Animated mesh background */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-[oklch(0.55_0.22_260)] opacity-40 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-24 h-[600px] w-[600px] rounded-full bg-[oklch(0.6_0.2_190)] opacity-30 blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[oklch(0.6_0.22_320)] opacity-20 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* Left: brand panel */}
        <aside className="relative hidden flex-col justify-between p-10 lg:flex">
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
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
                Acesse seu painel completo de SICAF, certidões, missões guiadas e suporte
                especializado — tudo em um único lugar.
              </p>
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

        {/* Right: form card */}
        <main className="flex items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-md">
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
              {/* Glow border */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-60"
                style={{
                  background:
                    "linear-gradient(140deg, oklch(0.7 0.2 260 / 0.4), transparent 40%, oklch(0.7 0.2 190 / 0.35))",
                  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  padding: "1px",
                }}
              />

              {/* Mobile logo */}
              <div className="mb-6 flex items-center gap-2 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <ShieldCheck className="h-5 w-5 text-[oklch(0.3_0.15_260)]" />
                </div>
                <span className="font-bold tracking-tight">CADBRASIL</span>
              </div>

              {/* Mode tabs */}
              <div className="relative mb-7 grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
                <button
                  onClick={() => setMode("login")}
                  className={`relative z-10 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    mode === "login" ? "text-[oklch(0.2_0.05_260)]" : "text-white/70 hover:text-white"
                  }`}
                >
                  Entrar
                </button>
                <button
                  onClick={() => setMode("cadastro")}
                  className={`relative z-10 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    mode === "cadastro"
                      ? "text-[oklch(0.2_0.05_260)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Cadastrar
                </button>
                <span
                  className="absolute inset-y-1 w-1/2 rounded-xl bg-white shadow-lg shadow-black/20 transition-transform duration-300 ease-out"
                  style={{ transform: mode === "login" ? "translateX(0)" : "translateX(100%)" }}
                />
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">
                  {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  {mode === "login"
                    ? "Entre com suas credenciais para continuar."
                    : "Em menos de 1 minuto, você começa sua jornada."}
                </p>
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-3">
                <SocialBtn label="Google" icon={<GoogleIcon />} />
                <SocialBtn label="Gov.br" icon={<GovBrIcon />} />
              </div>

              <div className="my-5 flex items-center gap-3">
                <Separator className="flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-white/40">
                  ou com e-mail
                </span>
                <Separator className="flex-1 bg-white/10" />
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "cadastro" && (
                  <>
                    <Field
                      icon={<User className="h-4 w-4" />}
                      label="Nome completo"
                      value={nome}
                      onChange={setNome}
                      placeholder="João da Silva"
                      type="text"
                      required
                    />
                    <Field
                      icon={<Building2 className="h-4 w-4" />}
                      label="Empresa / CNPJ"
                      value={empresa}
                      onChange={setEmpresa}
                      placeholder="Razão social ou 00.000.000/0000-00"
                      type="text"
                      required
                    />
                  </>
                )}

                <Field
                  icon={<Mail className="h-4 w-4" />}
                  label="E-mail"
                  value={email}
                  onChange={setEmail}
                  placeholder="voce@empresa.com.br"
                  type="email"
                  required
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-white/80">Senha</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        className="text-xs text-white/60 transition-colors hover:text-white"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="group relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                      <Lock className="h-4 w-4" />
                    </span>
                    <Input
                      type={showPass ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••••"
                      required
                      minLength={6}
                      className="h-11 border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {mode === "cadastro" && senha.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i < strength.score ? strength.color : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-white/50">
                        Força da senha:{" "}
                        <span className="font-medium text-white/80">{strength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                {mode === "login" ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                    <Checkbox className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-[oklch(0.2_0.05_260)]" />
                    Manter conectado por 30 dias
                  </label>
                ) : (
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-white/70">
                    <Checkbox
                      required
                      className="mt-0.5 border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-[oklch(0.2_0.05_260)]"
                    />
                    <span>
                      Concordo com os{" "}
                      <a className="underline underline-offset-2 hover:text-white">Termos de uso</a>{" "}
                      e a{" "}
                      <a className="underline underline-offset-2 hover:text-white">
                        Política de Privacidade
                      </a>
                      .
                    </span>
                  </label>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="group relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-white to-white/90 text-[oklch(0.2_0.05_260)] shadow-xl shadow-black/30 transition-all hover:shadow-2xl hover:shadow-white/10"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Processando...
                      </>
                    ) : (
                      <>
                        {mode === "login" ? "Entrar agora" : "Criar conta"}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </span>
                </Button>

                {mode === "login" && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <Fingerprint className="h-4 w-4" />
                    Entrar com biometria / passkey
                  </button>
                )}
              </form>

              <p className="mt-6 text-center text-xs text-white/50">
                {mode === "login" ? (
                  <>
                    Ainda não tem conta?{" "}
                    <button
                      onClick={() => setMode("cadastro")}
                      className="font-medium text-white underline-offset-2 hover:underline"
                    >
                      Cadastre-se grátis
                    </button>
                  </>
                ) : (
                  <>
                    Já possui conta?{" "}
                    <button
                      onClick={() => setMode("login")}
                      className="font-medium text-white underline-offset-2 hover:underline"
                    >
                      Entrar
                    </button>
                  </>
                )}
              </p>
            </div>

            <p className="mt-6 text-center text-[11px] text-white/40">
              Protegido por reCAPTCHA · <Link to="/" className="hover:text-white/70">Voltar ao início</Link>
            </p>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  required?: boolean;
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
          className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20"
        />
      </div>
    </div>
  );
}

function SocialBtn({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white/90 transition-all hover:border-white/25 hover:bg-white/[0.08]"
    >
      {icon}
      {label}
    </button>
  );
}

function passwordStrength(p: string) {
  let score = 0;
  if (p.length >= 6) score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  const map = [
    { label: "Muito fraca", color: "bg-red-400" },
    { label: "Fraca", color: "bg-orange-400" },
    { label: "Razoável", color: "bg-yellow-400" },
    { label: "Boa", color: "bg-lime-400" },
    { label: "Excelente", color: "bg-emerald-400" },
  ];
  return { score, ...map[score] };
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.84 3.5 14.66 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.48 0 9.1-3.85 9.1-9.27 0-.62-.07-1.1-.15-1.53H12z"
      />
    </svg>
  );
}

function GovBrIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" fill="#1351B4" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="#FFCD07"
        fontSize="7"
        fontWeight="800"
        fontFamily="Arial"
      >
        gov
      </text>
    </svg>
  );
}
