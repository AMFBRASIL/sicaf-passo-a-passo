import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, ShieldCheck, Sparkles, CheckCircle2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";
import { solicitarRecuperacaoSenha } from "@/lib/auth-api";

type EsqueciSenhaSearch = {
  email?: string;
};

export const Route = createFileRoute("/esqueci-senha")({
  validateSearch: (search: Record<string, unknown>): EsqueciSenhaSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recuperar Senha — Portal CADBRASIL" },
      { name: "description", content: "Recupere o acesso à sua conta do Portal do Fornecedor CADBRASIL." },
    ],
  }),
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[oklch(0.13_0.04_255)] text-white">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      }
    >
      <EsqueciSenhaContent />
    </ClientOnly>
  );
}

function EsqueciSenhaContent() {
  const { email: emailFromSearch } = Route.useSearch();
  const [email, setEmail] = useState(emailFromSearch ?? "");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!target) {
      toast.error("Informe o e-mail da sua conta");
      return;
    }

    setLoading(true);
    const result = await solicitarRecuperacaoSenha(target);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || "Não foi possível enviar o e-mail");
      return;
    }

    setEnviado(true);
    toast.success(result.message || "Instruções enviadas! Verifique sua caixa de entrada.");
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[oklch(0.13_0.04_255)] text-white">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] animate-pulse rounded-full bg-[oklch(0.55_0.22_260)] opacity-40 blur-[120px]" />
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

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
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
                Recupere o acesso
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-fuchsia-300 bg-clip-text text-transparent">
                  à sua conta
                </span>
                <br />
                com segurança.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
                Enviaremos um link seguro para o seu e-mail. Clique no link e defina uma nova senha em segundos.
              </p>
            </div>

            <ul className="grid gap-3">
              {[
                "Link de recuperação com validade de 1 hora",
                "Criptografia AES-256 em todas as etapas",
                "Suporte especializado se precisar de ajuda",
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

        <main className="flex items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-md">
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
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

              <div className="mb-6 flex items-center gap-2 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <ShieldCheck className="h-5 w-5 text-[oklch(0.3_0.15_260)]" />
                </div>
                <span className="font-bold tracking-tight">CADBRASIL</span>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">
                  {enviado ? "Verifique seu e-mail" : "Esqueceu a senha?"}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  {enviado
                    ? "Se o e-mail estiver cadastrado, você receberá um link de recuperação em instantes."
                    : "Informe seu e-mail cadastrado e enviaremos instruções para redefinir sua senha."}
                </p>
              </div>

              {enviado ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/40">
                      <Send className="h-6 w-6 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-200">Solicitação enviada!</p>
                      <p className="mt-1 text-xs text-emerald-200/70">
                        Verifique sua caixa de entrada e a pasta de spam. O link expira em 1 hora.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      setEnviado(false);
                      setEmail("");
                    }}
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Enviar para outro e-mail
                  </Button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-white/80">E-mail cadastrado</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                        <Mail className="h-4 w-4" />
                      </span>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@empresa.com.br"
                        required
                        autoComplete="email"
                        className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="group relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-white to-white/90 text-[oklch(0.2_0.05_260)] shadow-xl shadow-black/30 transition-all hover:shadow-2xl hover:shadow-white/10"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">
                      {loading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          Enviar instruções
                          <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </span>
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] text-white/40">
              <Link to="/" className="hover:text-white/70">
                Voltar ao início
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
