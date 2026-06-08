import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
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
  AlertTriangle,
  RefreshCw,
  Calendar,
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
import { PagamentoSicafModal } from "@/components/pagamento-sicaf-modal";

const searchSchema = z.object({
  cnpj: z.string().optional(),
});

export const Route = createFileRoute("/sicaf")({
  validateSearch: searchSchema,
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
  tempoMin: number;
}

const passosBase: Passo[] = [
  {
    n: 1,
    titulo: "Pagamento da taxa CADBRASIL",
    descricao: "Confirme o pagamento para liberar a atualização dos seus níveis.",
    tempoMin: 2,
  },
  {
    n: 2,
    titulo: "Verificar certificado digital",
    descricao: "Vamos checar se seu certificado e-CNPJ A1 ou A3 está conectado.",
    tempoMin: 3,
  },
  {
    n: 3,
    titulo: "Documentação da empresa",
    descricao: "Envie os documentos básicos que vamos usar para o cadastro.",
    tempoMin: 4,
  },
  {
    n: 4,
    titulo: "Conectar ao Compras.gov.br",
    descricao: "Vamos instalar o Assistente CADBRASIL para automatizar o acesso.",
    tempoMin: 3,
  },
  {
    n: 5,
    titulo: "Atualizar Nível III — Receita Federal",
    descricao: "Encontramos documentos que precisam ser atualizados.",
    tempoMin: 4,
  },
  {
    n: 6,
    titulo: "Atualizar Nível IV — Qualificação técnica",
    descricao: "Envie ou confirme os documentos da sua atividade.",
    tempoMin: 5,
  },
  {
    n: 7,
    titulo: "Validar e enviar",
    descricao: "Confirmação final — você pronto para licitar.",
    tempoMin: 1,
  },
];

// ============================================================
// Empresa em processo (mock — viria de query param / contexto)
// ============================================================
// ============================================================
// Empresas em processo (mock — viria de query param / contexto)
// ============================================================
type EstadoSicaf = "novo" | "vencido" | "completo";

type ClienteEmProcesso = {
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  responsavel: string;
  ramoAtividade: string;
  estado: EstadoSicaf;
  validade?: string;
  vencidoEm?: string;
  niveis?: number[];
};

const clientes: Record<string, ClienteEmProcesso> = {
  "34.567.890/0001-22": {
    nome: "Nova Filial Brasília LTDA",
    cnpj: "34.567.890/0001-22",
    endereco: "SHS Qd. 6, Bloco C - Asa Sul",
    cidade: "Brasília",
    uf: "DF",
    telefone: "(61) 3456-7890",
    email: "filial@novabrasilia.com.br",
    responsavel: "Ana Souza",
    ramoAtividade: "Prestação de Serviços Administrativos",
    estado: "novo",
  },
  "23.456.789/0001-11": {
    nome: "JR Construtora EIRELI",
    cnpj: "23.456.789/0001-11",
    endereco: "Av. das Américas, 5000 - Bloco 2",
    cidade: "Rio de Janeiro",
    uf: "RJ",
    telefone: "(21) 3456-7890",
    email: "obras@jrconstrutora.com.br",
    responsavel: "Pedro Costa",
    ramoAtividade: "Construção Civil",
    estado: "vencido",
    vencidoEm: "14/10/2025",
    niveis: [1, 2, 3, 4, 5, 6],
  },
  "45.678.901/0001-33": {
    nome: "Teste SICAF 100% LTDA",
    cnpj: "45.678.901/0001-33",
    endereco: "Av. Teste, 100 - Centro",
    cidade: "Curitiba",
    uf: "PR",
    telefone: "(41) 9999-8888",
    email: "teste@sicaf100.com.br",
    responsavel: "Lucas Teste",
    ramoAtividade: "Tecnologia da Informação",
    estado: "completo",
    validade: "10/09/2026",
    niveis: [1, 2, 3, 4, 5, 6],
  },
};

const clienteDefault = clientes["45.678.901/0001-33"];

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
// Modal: Documentação da empresa
// ============================================================
function DocumentacaoDialog({
  open,
  onOpenChange,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
}) {
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!open) {
      setArquivos({});
      setEnviando(false);
      setEnviado(false);
    }
  }, [open]);

  const obrigatoriosOk = documentosNecessarios
    .filter((d) => d.obrigatorio)
    .every((d) => arquivos[d.id]);

  const enviar = () => {
    setEnviando(true);
    setTimeout(() => {
      setEnviando(false);
      setEnviado(true);
      setTimeout(() => {
        onConcluido();
        onOpenChange(false);
      }, 1100);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Documentação da empresa</DialogTitle>
          <DialogDescription className="text-center">
            Envie os documentos abaixo. Aceitamos PDF, JPG ou PNG até 10MB cada.
          </DialogDescription>
        </DialogHeader>

        {!enviado && !enviando && (
          <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto pr-1">
            {documentosNecessarios.map((doc) => {
              const arquivo = arquivos[doc.id];
              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border p-3 transition ${
                    arquivo ? "border-success/40 bg-success/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{doc.label}</p>
                        {doc.obrigatorio && (
                          <span className="text-[10px] font-semibold uppercase text-danger">
                            obrigatório
                          </span>
                        )}
                      </div>
                      {arquivo ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {arquivo.name} · {(arquivo.size / 1024).toFixed(0)} KB
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Nenhum arquivo enviado</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {arquivo ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-danger hover:text-danger"
                          onClick={() => setArquivos((a) => ({ ...a, [doc.id]: null }))}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </Button>
                      ) : (
                        <label
                          htmlFor={`doc-${doc.id}`}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:brightness-95"
                        >
                          <Upload className="h-3.5 w-3.5" /> Enviar
                          <input
                            id={`doc-${doc.id}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) =>
                              setArquivos((a) => ({ ...a, [doc.id]: e.target.files?.[0] ?? null }))
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {enviando && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Enviando documentos…</p>
          </div>
        )}

        {enviado && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Documentos recebidos!</p>
            <p className="text-center text-xs text-muted-foreground">
              Você já pode conectar ao Compras.gov.br.
            </p>
          </div>
        )}

        {!enviando && !enviado && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={!obrigatoriosOk} className="gap-2">
              <Send className="h-4 w-4" />
              Enviar documentos
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
  const { cnpj } = Route.useSearch();
  const cliente = (cnpj && clientes[cnpj]) || clienteDefault;
  const total = passosBase.length;

  // Vencido: começa com todas etapas concluídas até clicar em "Renovar"
  const [renovando, setRenovando] = useState(false);
  const [renovacaoModal, setRenovacaoModal] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(
    cliente.estado === "vencido" ? total + 1 : 1,
  );
  const [modalAberto, setModalAberto] = useState<number | null>(null);
  const [pagamentoPago, setPagamentoPago] = useState(false);
  const [pagamentoModal, setPagamentoModal] = useState(false);

  // Resetar estado quando trocar de empresa via search param
  useEffect(() => {
    setRenovando(false);
    setPagamentoPago(false);
    setEtapaAtual(cliente.estado === "vencido" || cliente.estado === "completo" ? total + 1 : 1);
  }, [cliente.cnpj, cliente.estado, total]);

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

  const iniciarRenovacao = () => {
    setRenovando(true);
    setPagamentoPago(false);
    setEtapaAtual(1);
    setRenovacaoModal(false);
  };



  const tudoConcluido = etapaAtual > total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Atualizar SICAF"
        subtitle="Não se preocupe — vamos fazer juntos, um passo de cada vez."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Timeline lateral */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Etapas do processo</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {Math.min(concluidas, total)}/{total}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="relative">
                {passosBase.map((p, i) => {
                  const status = statusDe(p.n);
                  const isLast = i === passosBase.length - 1;
                  return (
                    <li key={p.n} className="relative pl-9 pb-5 last:pb-0">
                      {!isLast && (
                        <span
                          className={`absolute left-[14px] top-7 bottom-0 w-0.5 ${
                            status === "done" ? "bg-success" : "bg-border"
                          }`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (status === "pending") return;
                        if (p.n === 1) setPagamentoModal(true);
                          else setModalAberto(p.n);
                        }}
                        disabled={status === "pending"}
                        className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${
                          status === "done"
                            ? "bg-success text-success-foreground hover:scale-110"
                            : status === "current"
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse"
                            : "bg-muted text-muted-foreground"
                        }`}
                        aria-label={`Etapa ${p.n}: ${p.titulo}`}
                      >
                        {status === "done" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : status === "pending" ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          p.n
                        )}
                      </button>
                      <div className={status === "pending" ? "opacity-60" : ""}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                          status === "done" ? "text-success" :
                          status === "current" ? "text-primary" :
                          "text-muted-foreground"
                        }`}>
                          {status === "done" ? "Concluída" : status === "current" ? "Em andamento" : `Etapa ${p.n}`}
                        </p>
                        <p className="text-xs font-semibold leading-tight mt-0.5">{p.titulo}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold text-primary">{percentual}%</span>
                </div>
                <Progress value={percentual} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Conteúdo principal */}
        <div>


      {/* Empresa em processo */}
      <Card className="mt-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-soft">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Processo em andamento para
              </p>
              <p className="mt-0.5 text-lg font-bold leading-tight">{cliente.nome}</p>
              <p className="text-xs text-muted-foreground">CNPJ {cliente.cnpj}</p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    {cliente.endereco} — {cliente.cidade}/{cliente.uf}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{cliente.responsavel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{cliente.telefone}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
              <Link to="/empresas">Trocar</Link>
            </Button>
          </div>
        </CardContent>
      </Card>


      {cliente.estado === "vencido" && !renovando && tudoConcluido ? (
        <Card className="mt-6 border-danger/40 bg-gradient-to-br from-danger/10 via-danger/5 to-transparent shadow-soft overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger-foreground">
                    SICAF Vencido
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Venceu em {cliente.vencidoEm}
                  </span>
                </div>
                <p className="mt-2 font-semibold">
                  Todos os níveis foram validados, mas o cadastro venceu.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sua empresa está temporariamente fora das licitações. Renove agora para reativar o SICAF — nós fazemos a atualização para você.
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2 shadow-lift"
                onClick={() => setRenovacaoModal(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Renovar SICAF agora
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !tudoConcluido ? (
        <Card className="mt-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div className="text-sm">
              <p className="font-semibold">
                {renovando
                  ? "Renovação do SICAF em andamento — vamos juntos atualizar tudo."
                  : "Sua empresa ainda não possui SICAF ativo. Vamos cadastrar agora?"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Leva cerca de 5 minutos. Comece pela próxima etapa em destaque abaixo.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-success/40 bg-gradient-to-br from-success/10 via-success/5 to-transparent shadow-lift overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success-foreground">
                    100% concluído
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Pronto para licitar
                  </span>
                </div>
                <p className="mt-2 font-semibold">
                  {renovando
                    ? "SICAF renovado com sucesso! 🎉"
                    : "Parabéns! Seu SICAF foi atualizado com sucesso 🎉"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agora abra o Assistente para enviar a Situação do Fornecedor e manter tudo monitorado.
                </p>
              </div>
              <Button asChild size="lg" className="gap-2 shadow-lift">
                <Link to="/assistente" search={{ cnpj: cliente.cnpj }}>
                  <Bot className="h-4 w-4" />
                  Atualizar meu SICAF agora
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
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
                      <Button size="sm" onClick={() => p.n === 1 ? setPagamentoModal(true) : setModalAberto(p.n)}>
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
        </div>
      </div>

      {/* Modais */}
      <CertificadoDialog
        open={modalAberto === 2}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
      />
      <DocumentacaoDialog
        open={modalAberto === 3}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
      />
      <AssistenteDialog
        open={modalAberto === 4}
        onOpenChange={(v) => !v && setModalAberto(null)}
        onConcluido={concluirEtapa}
      />
      <AssistenteRodandoDialog
        open={modalAberto === 5}
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
        open={modalAberto === 6}
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
        open={modalAberto === 7}
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
          {cliente.estado === "vencido" && !renovando ? (
            <button
              onClick={() => setRenovacaoModal(true)}
              className="flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground shadow-lift hover:brightness-110 transition"
            >
              <AlertTriangle className="h-4 w-4" />
              SICAF Vencido · Renovar
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-medium text-success-foreground shadow-lift">
              <Send className="h-4 w-4" />
              SICAF ativo
            </div>
          )}
        </div>
      )}

      {/* Modal: Confirmar renovação */}
      <Dialog open={renovacaoModal} onOpenChange={setRenovacaoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RefreshCw className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl">Renovar SICAF</DialogTitle>
            <DialogDescription className="text-center">
              Vamos reativar o SICAF de <span className="font-semibold text-foreground">{cliente.nome}</span>.
              O processo é idêntico ao cadastro inicial — pagamento da taxa, verificação dos documentos e atualização automática dos níveis.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vencido em</span>
              <span className="font-semibold">{cliente.vencidoEm}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxa de renovação</span>
              <span className="font-semibold">R$ 985,00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tempo estimado</span>
              <span className="font-semibold">Até 24h</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRenovacaoModal(false)}>
              Cancelar
            </Button>
            <Button onClick={iniciarRenovacao} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Iniciar renovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PagamentoSicafModal
        open={pagamentoModal && !pagamentoPago}
        onOpenChange={setPagamentoModal}
        empresa={{ nome: cliente.nome, cnpj: cliente.cnpj }}
        onPago={() => { setPagamentoPago(true); concluirEtapa(); }}
      />
    </div>
  );
}
