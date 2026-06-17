import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientOnly } from "@/components/client-only";
import { toast } from "sonner";
import { redefinirSenhaComToken } from "@/lib/auth-api";

type RecuperarSearch = {
  token?: string;
};

export const Route = createFileRoute("/auth/recuperar-senha")({
  validateSearch: (search: Record<string, unknown>): RecuperarSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Redefinir senha — Portal CADBRASIL" },
      { name: "description", content: "Defina uma nova senha para sua conta CADBRASIL." },
    ],
  }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#0f1729] text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      }
    >
      <RecuperarSenhaContent />
    </ClientOnly>
  );
}

function RecuperarSenhaContent() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      toast.error("Link inválido. Solicite uma nova redefinição de senha.");
      return;
    }

    if (novaSenha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    const result = await redefinirSenhaComToken({ token, novaSenha, confirmarSenha });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || "Não foi possível redefinir a senha");
      return;
    }

    toast.success(result.message || "Senha redefinida com sucesso!");
    void navigate({ to: "/auth" });
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0f1729] p-5 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-blue-600/40 blur-[120px]" />
        <div className="absolute -bottom-40 -right-24 h-[600px] w-[600px] rounded-full bg-cyan-500/25 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
            <ShieldCheck className="h-5 w-5 text-[oklch(0.3_0.15_260)]" />
          </div>
          <span className="font-bold tracking-tight">CADBRASIL</span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Nova senha</h1>
          <p className="mt-1 text-sm text-white/60">
            {token
              ? "Digite e confirme sua nova senha para concluir a recuperação."
              : "Este link é inválido ou expirou. Solicite uma nova redefinição na tela de login."}
          </p>

          {token ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/80">Nova senha</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    type={showPass ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-11 border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/80">Confirmar senha</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    type={showPass ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-white to-white/90 text-[oklch(0.2_0.05_260)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Redefinir senha
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="mt-6">
              <Button asChild className="h-11 w-full rounded-xl">
                <Link to="/esqueci-senha">Solicitar novo link</Link>
              </Button>
            </div>
          )}

          {token && (
            <p className="mt-6 text-center text-[11px] text-white/40">
              <Link to="/auth" className="hover:text-white/70">
                Voltar ao login
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
