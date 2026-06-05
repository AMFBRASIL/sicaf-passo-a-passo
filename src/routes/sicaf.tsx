import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bot,
  ArrowRight,
  CheckCircle2,
  Lock,
  FileCheck,
  ShieldCheck,
  Upload,
  KeyRound,
  Download,
  Loader2,
  Search,
  Zap,
  FileText,
  Sparkles,
  Send,
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/sicaf")({
  head: () => ({
    meta: [
      { title: "Atualizar SICAF — CADBRASIL" },
      { name: "description", content: "Atualize seu SICAF passo a passo com o assistente CADBRASIL." },
    ],
  }),
  component: SicafPage,
});

type PassoStatus = "done" | "current" | "pending";

interface Passo {
  n: number;
  titulo: string;
  descricao: string;
}

const passosBase: Passo[] = [
  {
    n: 1,
    titulo: "Verificar certificado digital",
    descricao: "Vamos checar se seu certificado e-CNPJ A1 ou A3 está conectado.",
  },
  {
    n: 2,
    titulo: "Documentação da empresa",
    descricao: "Envie os documentos básicos que vamos usar para o cadastro.",
  },
  {
    n: 3,
    titulo: "Conectar ao Compras.gov.br",
    descricao: "Vamos instalar o Assistente CADBRASIL para automatizar o acesso.",
  },
  {
    n: 4,
    titulo: "Atualizar Nível III — Receita Federal",
    descricao: "Encontramos documentos que precisam ser atualizados.",
  },
  {
    n: 5,
    titulo: "Atualizar Nível IV — Qualificação técnica",
    descricao: "Envie ou confirme os documentos da sua atividade.",
  },
  {
    n: 6,
    titulo: "Validar e enviar",
    descricao: "Confirmação final — você pronto para licitar.",
  },
];

// ============================================================
// Empresa em processo (mock — viria de query param / contexto)
// ============================================================
const empresaEmProcesso = {
  nome: "Nova Filial Brasília LTDA",
  cnpj: "34.567.890/0001-22",
  endereco: "SHS Qd. 6, Bloco C - Asa Sul",
  cidade: "Brasília",
  uf: "DF",
  telefone: "(61) 3456-7890",
  email: "filial@novabrasilia.com.br",
  responsavel: "Ana Souza",
  ramoAtividade: "Prestação de Serviços Administrativos",
};

// ============================================================
// Documentos exigidos
// ============================================================
const documentosNecessarios = [
  { id: "contrato_social", label: "Contrato Social (última alteração)", obrigatorio: true },
  { id: "cnpj_card", label: "Cartão CNPJ atualizado", obrigatorio: true },
  { id: "rg_socio", label: "RG e CPF do(s) sócio(s)", obrigatorio: true },
  { id: "comprovante_endereco", label: "Comprovante de endereço da empresa", obrigatorio: true },
  { id: "procuracao", label: "Procuração (se aplicável)", obrigatorio: false },
];

// ============================================================
// Modal 1: Certificado Digital
// ============================================================
function CertificadoDialog({
  open,
  onOpenChange,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<"form" | "validando" | "ok">("form");

  useEffect(() => {
    if (!open) {
      setArquivo(null);
      setSenha("");
      setEstado("form");
    }
  }, [open]);

  const podeValidar = arquivo && senha.length >= 4 && estado === "form";

  const validar = () => {
    setEstado("validando");
    setTimeout(() => {
      setEstado("ok");
      setTimeout(() => {
        onConcluido();
        onOpenChange(false);
      }, 1100);
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Validar certificado digital</DialogTitle>
          <DialogDescription className="text-center">
            Envie seu certificado e-CNPJ A1 (.pfx) e informe a senha — usamos apenas para esta validação.
          </DialogDescription>
        </DialogHeader>

        {estado === "form" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Arquivo do certificado (.pfx)</Label>
              <label
                htmlFor="cert-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-primary/5"
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">
                  {arquivo ? arquivo.name : "Clique para selecionar o arquivo"}
                </span>
                <span className="text-xs text-muted-foreground">Formato .pfx ou .p12 · até 5 MB</span>
                <input
                  id="cert-file"
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cert-senha">Senha do certificado</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cert-senha"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sua senha não fica armazenada — usamos apenas durante a validação.
              </p>
            </div>
          </div>
        )}

        {estado === "validando" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Validando seu certificado…</p>
            <p className="text-xs text-muted-foreground">Conferindo cadeia de certificação e validade</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Certificado válido!</p>
            <p className="text-center text-xs text-muted-foreground">
              e-CNPJ A1 — válido até 12/03/2027
            </p>
          </div>
        )}

        {estado === "form" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={validar} disabled={!podeValidar} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Validar certificado
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal 2: Conectar ao Compras (instalar assistente)
// ============================================================
function AssistenteDialog({
  open,
  onOpenChange,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
}) {
  const [estado, setEstado] = useState<"checando" | "nao-instalado" | "instalando" | "ok">(
    "checando",
  );
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    if (!open) {
      setEstado("checando");
      setProgresso(0);
      return;
    }
    const t = setTimeout(() => setEstado("nao-instalado"), 1500);
    return () => clearTimeout(t);
  }, [open]);

  const instalar = () => {
    setEstado("instalando");
    setProgresso(0);
    const id = setInterval(() => {
      setProgresso((p) => {
        if (p >= 100) {
          clearInterval(id);
          setTimeout(() => {
            setEstado("ok");
            setTimeout(() => {
              onConcluido();
              onOpenChange(false);
            }, 1100);
          }, 400);
          return 100;
        }
        return p + 7;
      });
    }, 180);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Conectar ao Compras.gov.br</DialogTitle>
          <DialogDescription className="text-center">
            Precisamos do Assistente CADBRASIL instalado no seu navegador para automatizar o acesso.
          </DialogDescription>
        </DialogHeader>

        {estado === "checando" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Verificando se o assistente está instalado…</p>
          </div>
        )}

        {estado === "nao-instalado" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <Search className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
                <div className="text-sm">
                  <p className="font-semibold">Assistente CADBRASIL não encontrado</p>
                  <p className="mt-1 text-muted-foreground">
                    Vamos instalar agora — leva menos de 1 minuto e funciona em segundo plano.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                O que o assistente faz
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Acessa o Compras.gov.br com seu certificado
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Atualiza Níveis III e IV automaticamente
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Monitora vencimentos 24h por dia
                </li>
              </ul>
            </div>
          </div>
        )}

        {estado === "instalando" && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center gap-2">
              <Download className="h-10 w-10 animate-pulse text-primary" />
              <p className="text-sm font-medium">Instalando Assistente CADBRASIL…</p>
            </div>
            <Progress value={progresso} className="h-2" />
            <p className="text-center text-xs text-muted-foreground">{progresso}% concluído</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Assistente instalado!</p>
            <p className="text-center text-xs text-muted-foreground">
              Conectado ao Compras.gov.br com sucesso.
            </p>
          </div>
        )}

        {estado === "nao-instalado" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Agora não
            </Button>
            <Button onClick={instalar} className="gap-2">
              <Download className="h-4 w-4" />
              Instalar assistente
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal 3+: Atualizar Nível (assistente executando)
// ============================================================
function AssistenteRodandoDialog({
  open,
  onOpenChange,
  onConcluido,
  titulo,
  subtitulo,
  etapas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
  titulo: string;
  subtitulo: string;
  etapas: string[];
}) {
  const [iniciado, setIniciado] = useState(false);
  const [atual, setAtual] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setIniciado(false);
      setAtual(0);
      setDone(false);
    }
  }, [open]);

  useEffect(() => {
    if (!iniciado || done) return;
    if (atual >= etapas.length) {
      setDone(true);
      const t = setTimeout(() => {
        onConcluido();
        onOpenChange(false);
      }, 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setAtual((a) => a + 1), 1200);
    return () => clearTimeout(t);
  }, [iniciado, atual, done, etapas.length, onConcluido, onOpenChange]);

  const iniciar = () => setIniciado(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">{titulo}</DialogTitle>
          <DialogDescription className="text-center">{subtitulo}</DialogDescription>
        </DialogHeader>

        {!iniciado && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                O assistente vai executar:
              </p>
              <ul className="mt-2 space-y-2">
                {etapas.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Você pode acompanhar em tempo real. Não feche o navegador enquanto o assistente trabalha.
              </span>
            </div>
          </div>
        )}

        {iniciado && !done && (
          <div className="space-y-3 py-4">
            {etapas.map((e, i) => {
              const completo = i < atual;
              const ativo = i === atual;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    ativo ? "border-primary/40 bg-primary/5" : completo ? "bg-muted/40" : "opacity-60"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {completo ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : ativo ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm">{e}</p>
                </div>
              );
            })}
          </div>
        )}

        {done && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Etapa concluída!</p>
            <p className="text-center text-xs text-muted-foreground">
              Atualização confirmada no Compras.gov.br
            </p>
          </div>
        )}

        {!iniciado && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Agora não
            </Button>
            <Button onClick={iniciar} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Iniciar assistente
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Página principal
// ============================================================
function SicafPage() {
  // Cliente NOVO: nenhuma etapa concluída
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [modalAberto, setModalAberto] = useState<number | null>(null);

  const total = passosBase.length;
  const concluidas = etapaAtual - 1;
  const percentual = Math.round((concluidas / total) * 100);

  const statusDe = (n: number): PassoStatus => {
    if (n < etapaAtual) return "done";
    if (n === etapaAtual) return "current";
    return "pending";
  };

  const concluirEtapa = () => {
    setEtapaAtual((n) => Math.min(n + 1, total + 1));
  };

  const tudoConcluido = etapaAtual > total;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Atualizar SICAF"
        subtitle="Não se preocupe — vamos fazer juntos, um passo de cada vez."
      />

      {!tudoConcluido ? (
        <Card className="mt-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div className="text-sm">
              <p className="font-semibold">
                Sua empresa ainda não possui SICAF ativo. Vamos cadastrar agora?
              </p>
              <p className="mt-1 text-muted-foreground">
                Leva cerca de 5 minutos. Comece pela próxima etapa em destaque abaixo.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-success/30 bg-success/5">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="text-sm">
              <p className="font-semibold">Parabéns! Seu SICAF foi atualizado com sucesso 🎉</p>
              <p className="mt-1 text-muted-foreground">
                Sua empresa está apta a participar de licitações. Vamos monitorar tudo por você.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Progresso da atualização</CardTitle>
          <span className="text-sm font-semibold text-primary">
            {Math.min(concluidas, total)} de {total} etapas
          </span>
        </CardHeader>
        <CardContent>
          <Progress value={percentual} className="h-3" />
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {passosBase.map((p) => {
          const status = statusDe(p.n);
          return (
            <Card
              key={p.n}
              className={
                status === "current"
                  ? "border-primary/40 shadow-lift"
                  : status === "done"
                  ? "bg-muted/40"
                  : "opacity-70"
              }
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                    status === "done"
                      ? "bg-success text-success-foreground"
                      : status === "current"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status === "done" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : status === "pending" ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    p.n
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{p.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.descricao}</p>
                  {status === "current" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setModalAberto(p.n)}>
                        Resolver agora
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {status === "done" && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-dashed">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <FileCheck className="h-5 w-5 text-primary" />
          <span>
            Travou em alguma etapa?{" "}
            <Link to="/suporte" className="font-medium text-primary underline-offset-2 hover:underline">
              Fale com um especialista
            </Link>{" "}
            — respondemos em minutos.
          </span>
        </CardContent>
      </Card>

      {/* Modais */}
      <CertificadoDialog
        open={modalAberto === 1}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
      />
      <AssistenteDialog
        open={modalAberto === 2}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 3}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        titulo="Atualizar Nível III — Receita Federal"
        subtitulo="O Assistente CADBRASIL vai acessar o Compras.gov.br e atualizar os documentos federais."
        etapas={[
          "Acessando Compras.gov.br com certificado digital",
          "Consultando documentos do Nível III na Receita Federal",
          "Baixando certidões negativas atualizadas",
          "Anexando ao seu cadastro SICAF",
          "Validando atualização junto ao sistema",
        ]}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 4}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        titulo="Atualizar Nível IV — Qualificação técnica"
        subtitulo="O assistente vai consolidar e enviar seus documentos de qualificação técnica."
        etapas={[
          "Conferindo CNAEs cadastrados na Receita Federal",
          "Validando atestados e documentos técnicos",
          "Preenchendo formulário de qualificação no Compras.gov.br",
          "Confirmando envio do Nível IV",
        ]}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 5}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
        titulo="Validar e enviar"
        subtitulo="Última etapa! Confirmação final e ativação do seu SICAF."
        etapas={[
          "Revisando todos os níveis cadastrados",
          "Gerando comprovante de inscrição",
          "Confirmando ativação no SICAF",
        ]}
      />

      {tudoConcluido && (
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <div className="flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-medium text-success-foreground shadow-lift">
            <Send className="h-4 w-4" />
            SICAF ativo
          </div>
        </div>
      )}
    </div>
  );
}
