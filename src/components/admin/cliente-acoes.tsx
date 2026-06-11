import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Mail,
  FileSignature,
  FileUp,
  FileText,
  Clock,
  ChevronRight,
  Phone,
  Plus,
  Send,
  Upload,
  Sparkles,
  Download,
  Printer,
  CheckCircle2,
  Edit3,
  Trash2,
  Loader2,
  StickyNote,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { readAuthToken } from "@/lib/auth-cookie";
import { apiUrl } from "@/lib/api-config";
import { toast } from "sonner";
import { NIVEIS_SICAF } from "./nivel-dots";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";
import {
  AnaliseDetalhe,
  AnaliseErroRelatorio,
  type SicafAnaliseApiResult,
} from "@/components/sicaf/SicafAnalisarProblemaModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvisosEmailModal } from "@/components/admin/avisos-email-modal";
import { ContratosModal } from "@/components/admin/contratos-modal";
import { fetchAdminClienteNotas, criarAdminClienteNota } from "@/lib/admin-clientes-api";

type AcaoKey = "contatos" | "avisos" | "contratos" | "sicaf-manual" | "relatorio" | "historico" | "notas";

const ACOES: {
  key: AcaoKey;
  titulo: string;
  desc: string;
  icon: React.ElementType;
  tone: string;
  iconBg: string;
}[] = [
  {
    key: "contatos",
    titulo: "Contatos",
    desc: "Contatos, cargos, e-mails e telefones da empresa",
    icon: Users,
    tone: "bg-blue-50 dark:bg-blue-950/20 ring-blue-200/60 dark:ring-blue-900/40",
    iconBg: "bg-blue-500 text-white",
  },
  {
    key: "avisos",
    titulo: "Avisos Email",
    desc: "Templates e envio de avisos por e-mail ao cliente",
    icon: Mail,
    tone: "bg-violet-50 dark:bg-violet-950/20 ring-violet-200/60 dark:ring-violet-900/40",
    iconBg: "bg-violet-500 text-white",
  },
  {
    key: "contratos",
    titulo: "Contratos",
    desc: "Criar ou atualizar contrato digital, data de assinatura e signatário",
    icon: FileSignature,
    tone: "bg-amber-50 dark:bg-amber-950/20 ring-amber-200/60 dark:ring-amber-900/40",
    iconBg: "bg-amber-500 text-white",
  },
  {
    key: "sicaf-manual",
    titulo: "Atualizar SICAF manual",
    desc: "Enviar PDF da Situação do Fornecedor — IA atualiza níveis como no Assistente",
    icon: FileUp,
    tone: "bg-emerald-50 dark:bg-emerald-950/20 ring-emerald-200/60 dark:ring-emerald-900/40",
    iconBg: "bg-emerald-500 text-white",
  },
  {
    key: "relatorio",
    titulo: "Relatório",
    desc: "Resumo completo, métricas e impressão para o cliente",
    icon: FileText,
    tone: "bg-emerald-50 dark:bg-emerald-950/20 ring-emerald-200/60 dark:ring-emerald-900/40",
    iconBg: "bg-emerald-600 text-white",
  },
  {
    key: "historico",
    titulo: "Histórico",
    desc: "Atividades, acessos e registros do cadastro",
    icon: Clock,
    tone: "bg-slate-100 dark:bg-slate-900/40 ring-slate-200/60 dark:ring-slate-800",
    iconBg: "bg-slate-700 text-white dark:bg-slate-600",
  },
  {
    key: "notas",
    titulo: "Notas internas",
    desc: "Anotações visíveis apenas para a equipe — salvas no banco",
    icon: StickyNote,
    tone: "bg-yellow-50 dark:bg-yellow-950/20 ring-yellow-200/60 dark:ring-yellow-900/40",
    iconBg: "bg-yellow-500 text-white",
  },
];

export function AcoesTab({ cliente, clienteId }: { cliente: ClienteDetalhe; clienteId?: number }) {
  const [aberta, setAberta] = useState<AcaoKey | null>(null);

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold">Ações</h3>
        <p className="text-xs text-muted-foreground">
          Escolha uma área para gerenciar este cliente
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ACOES.map((a) => (
          <button
            key={a.key}
            onClick={() => setAberta(a.key)}
            className={`group flex flex-col items-start gap-3 rounded-xl p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${a.tone}`}
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg shadow-sm ${a.iconBg}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{a.titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p>
            </div>
            <span className="mt-auto flex items-center gap-0.5 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
              Abrir <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>

      <ContatosModal open={aberta === "contatos"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <AvisosEmailModal
        open={aberta === "avisos"}
        onOpenChange={(v) => !v && setAberta(null)}
        cliente={cliente}
        clienteId={clienteId}
      />
      <ContratosModal
        open={aberta === "contratos"}
        onOpenChange={(v) => !v && setAberta(null)}
        cliente={cliente}
        clienteId={clienteId}
      />
      <SicafManualModal open={aberta === "sicaf-manual"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} clienteId={clienteId} />
      <RelatorioModal open={aberta === "relatorio"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <HistoricoModal open={aberta === "historico"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <NotasModal
        open={aberta === "notas"}
        onOpenChange={(v) => !v && setAberta(null)}
        cliente={cliente}
        clienteId={clienteId}
      />
    </div>
  );
}

/* ---------- CONTATOS ---------- */
function ContatosModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  const [contatos, setContatos] = useState([
    { nome: cliente.responsavel || "Responsável", cargo: "Sócio-administrador", email: cliente.email ?? "contato@empresa.com.br", telefone: cliente.telefone ?? "(61) 99999-0000", principal: true },
    { nome: "Financeiro", cargo: "Depto. Financeiro", email: "financeiro@empresa.com.br", telefone: "(61) 3333-4444", principal: false },
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" /> Contatos da empresa</DialogTitle>
          <DialogDescription>Gerencie os contatos vinculados a {cliente.razao}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {contatos.map((c, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{c.nome}</p>
                    {c.principal && <Badge className="bg-blue-500 text-white border-0 text-[10px]">Principal</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.cargo}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {c.telefone}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7"><Edit3 className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => setContatos(contatos.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button className="gap-1.5"><Plus className="h-4 w-4" /> Novo contato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- SICAF MANUAL ---------- */
function SicafManualModal({
  open,
  onOpenChange,
  cliente,
  clienteId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: ClienteDetalhe;
  clienteId?: number;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<SicafAnaliseApiResult | null>(null);

  const empresaCtx =
    clienteId != null
      ? [{ clienteId, nome: cliente.razao, cnpj: cliente.cnpj }]
      : [];

  const resetar = () => {
    setArquivo(null);
    setResultado(null);
    setProcessando(false);
  };

  const processar = async () => {
    if (!arquivo || !clienteId) {
      toast.error("Selecione um PDF válido");
      return;
    }
    if (arquivo.size > 15 * 1024 * 1024) {
      toast.error("PDF muito grande. Máximo 15 MB.");
      return;
    }

    setProcessando(true);
    setResultado(null);
    try {
      const token = readAuthToken() || "";
      const form = new FormData();
      form.append("file", arquivo, arquivo.name);
      const res = await fetch(apiUrl(`/api/clients/${clienteId}/sicaf/analisar-problema`), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const raw = await res.text();
      let data: SicafAnaliseApiResult = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        toast.error(raw?.slice(0, 200) || `Erro HTTP ${res.status}`);
        return;
      }

      if (data.ok) {
        setResultado(data);
        toast.success(data.message || "Análise concluída e cadastro atualizado");
      } else {
        setResultado({
          ...data,
          ok: false,
          cnpjIdentificado: data.cnpjIdentificado || data.cnpj,
          arquivoNome: arquivo.name,
        });
        toast.error(data.error || "Não foi possível analisar o PDF");
      }
    } catch {
      toast.error("Falha ao processar PDF");
    } finally {
      setProcessando(false);
    }
  };

  const exibirUpload = !processando && !resultado;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetar();
      }}
    >
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" /> Atualizar SICAF manual
          </DialogTitle>
          <DialogDescription>
            Envie o PDF da Situação do Fornecedor — a IA analisa, atualiza os níveis de{" "}
            <span className="font-medium text-foreground">{cliente.razao}</span> e exibe o relatório
            completo como no portal do cliente.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-5">
            {exibirUpload && (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/10 p-8 cursor-pointer hover:bg-emerald-50/70 transition">
                <Upload className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium">{arquivo ? arquivo.name : "Clique para selecionar o PDF"}</p>
                <p className="text-xs text-muted-foreground">Apenas arquivos PDF · até 15 MB</p>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0] ?? null);
                    setResultado(null);
                  }}
                />
              </label>
            )}

            {processando && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                <div className="text-center space-y-1">
                  <p className="font-semibold text-foreground">Analisando documento...</p>
                  <p className="text-sm">
                    Identificando CNPJ, níveis SICAF, pendências e atualizando o cadastro
                  </p>
                </div>
              </div>
            )}

            {resultado && !resultado.ok && !processando && (
              <AnaliseErroRelatorio
                error={resultado.error}
                cnpjIdentificado={resultado.cnpjIdentificado || resultado.cnpj}
                metodoExtracao={resultado.metodoExtracao}
                arquivoNome={resultado.arquivoNome || arquivo?.name}
                empresas={empresaCtx}
              />
            )}

            {resultado?.ok && resultado.analise && !processando && (
              <AnaliseDetalhe
                analise={resultado.analise}
                saveWarning={resultado.saveWarning}
                clientName={resultado.razaoSocial || cliente.razao}
                documentoFallback={resultado.cnpj || cliente.cnpj}
                niveisResumo={resultado.niveisResumo}
                validacao={resultado.validacao || resultado.analise.validacao}
              />
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t px-6 py-4 gap-2">
          {resultado ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setResultado(null);
                  setArquivo(null);
                }}
              >
                {resultado.ok ? "Analisar outro PDF" : "Tentar outro PDF"}
              </Button>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processando}>
                Cancelar
              </Button>
              <Button className="gap-1.5" disabled={!arquivo || processando || !clienteId} onClick={processar}>
                {processando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Analisar com IA
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RELATÓRIO ---------- */
function RelatorioModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  // Importações dinâmicas via require ao topo do arquivo já existem (NIVEIS_SICAF abaixo)
  const niveisList = NIVEIS_SICAF.map((n) => ({
    ...n,
    status: (cliente.niveis?.[n.num] ?? "nao_cadastrado") as
      | "validado"
      | "vencendo"
      | "vencido"
      | "pendente"
      | "nao_cadastrado",
  }));

  const niveisHabilitados = niveisList.filter((n) => n.status === "validado" || n.status === "vencendo").length;
  const certidoesTotal = 5;
  const certidoesVencidas = niveisList.filter((n) => n.status === "vencido").length;
  const certidoesVencendo = niveisList.filter((n) => n.status === "vencendo").length;
  const documentosTotal = 0;
  const sicafStatusLabel = cliente.sicaf === "ok" ? "Ativo" : cliente.sicaf === "pendente" ? "Pendente" : "Vencido";
  const sicafStatusTone =
    cliente.sicaf === "ok"
      ? "text-emerald-600"
      : cliente.sicaf === "pendente"
        ? "text-amber-600"
        : "text-rose-600";

  const statusBadge = (s: string) => {
    if (s === "validado") return <span className="text-xs font-medium text-emerald-600">Habilitado</span>;
    if (s === "vencendo") return <span className="text-xs font-medium text-amber-600">A Vencer</span>;
    if (s === "vencido") return <span className="text-xs font-medium text-rose-600">Vencido</span>;
    if (s === "pendente") return <span className="text-xs font-medium text-amber-600">Pendente</span>;
    return <span className="text-xs font-medium text-muted-foreground">Não cadastrado</span>;
  };

  const validadeMock = (i: number) =>
    i === 0 ? cliente.validadeSicaf ?? "07/06/2027"
    : i === 2 ? "12/06/2026"
    : i === 3 ? "07/07/2026"
    : i === 4 ? "—"
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur px-6 py-4">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" /> Relatório do Cliente
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              Resumo completo para compartilhamento com o cliente.
            </DialogDescription>
          </div>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <Printer className="h-4 w-4" /> Imprimir detalhes
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="SICAF" value={sicafStatusLabel} valueClass={sicafStatusTone} />
            <KpiCard label="Níveis SICAF" value={String(niveisHabilitados)} />
            <KpiCard label="Certidões" value={String(certidoesTotal)} />
            <KpiCard label="Documentos" value={String(documentosTotal)} />
          </div>

          {/* Bloco empresa */}
          <Card className="p-4 space-y-1.5 text-sm">
            <Linha k="Empresa" v={cliente.razao} />
            <Linha k="Documento" v={cliente.cnpj} />
            <Linha k="Responsável" v={cliente.responsavel} />
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Linha k="E-mail" v={cliente.email ?? "—"} />
              <Linha k="Telefone" v={cliente.telefone ?? "—"} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Linha k="Manutenção" v={cliente.manutencao ? "Ativa" : "Inativa"} />
              <Linha k="Validade SICAF" v={cliente.validadeSicaf ?? "—"} />
            </div>
          </Card>

          {/* KPIs secundários */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard label="Certidões vencidas" value={String(certidoesVencidas)} valueClass="text-rose-600" />
            <KpiCard label="Certidões vencendo" value={String(certidoesVencendo)} valueClass="text-amber-600" />
            <KpiCard
              label="Financeiro (taxas pagas)"
              value={`R$ ${(cliente.ltv ?? 985).toLocaleString("pt-BR")},00`}
              valueClass="text-emerald-600"
            />
          </div>

          {/* Pendências SICAF banner */}
          {cliente.pagou ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Sem taxas SICAF pendentes</p>
                <p className="text-xs text-muted-foreground">
                  Todas as solicitações deste cliente estão quitadas ou foram canceladas.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Taxas SICAF em aberto</p>
                <p className="text-xs text-muted-foreground">Existe solicitação aguardando pagamento.</p>
              </div>
            </div>
          )}

          {/* Níveis SICAF */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-semibold">Níveis SICAF</p>
            </div>
            <div className="divide-y">
              {niveisList.map((n, i) => (
                <div key={n.num} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/20">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Nível {n.roman} -</span>{" "}
                    <span className="font-medium">{n.nome}</span>
                  </p>
                  <div className="flex items-center gap-4 shrink-0">
                    {validadeMock(i) && validadeMock(i) !== "—" && (
                      <span className="text-xs text-muted-foreground">Validade: {validadeMock(i)}</span>
                    )}
                    {statusBadge(n.status)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Financeiro e Plano */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Plano contratado</p>
              <p className="text-base font-bold">{cliente.plano ?? "—"}</p>
              <div className="mt-3 space-y-1 text-sm">
                <Linha k="MRR" v={cliente.mrr ? `R$ ${cliente.mrr.toLocaleString("pt-BR")},00` : "—"} />
                <Linha k="LTV" v={cliente.ltv ? `R$ ${cliente.ltv.toLocaleString("pt-BR")},00` : "—"} />
                <Linha k="Cliente desde" v={cliente.desde ?? "—"} />
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Atendimento</p>
              <div className="space-y-1 text-sm">
                <Linha k="Último contato" v={cliente.ultimoContato} />
                <Linha k="Cidade" v={cliente.cidade} />
                <Linha k="Pagamento" v={cliente.pagou ? "Em dia" : "Em atraso"} />
                <Linha k="Status geral" v={cliente.sicaf === "ok" && cliente.pagou ? "Saudável" : "Requer atenção"} />
              </div>
            </Card>
          </div>

          {/* Resumo executivo */}
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Resumo executivo</p>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">{cliente.razao}</span> está {cliente.sicaf === "ok" ? "com SICAF em dia" : cliente.sicaf === "pendente" ? "com pendências no SICAF" : "com SICAF vencido"}
              , {cliente.pagou ? "pagamentos em dia" : "inadimplente"} e {cliente.manutencao ? "com manutenção ativa" : "sem manutenção contratada"}. Possui {niveisHabilitados} de 6 níveis habilitados, {certidoesVencendo} certidão(ões) vencendo nos próximos 30 dias e {certidoesVencidas} vencida(s).
            </p>
          </Card>
        </div>

        <DialogFooter className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" className="gap-1.5"><Download className="h-4 w-4" /> Baixar PDF</Button>
          <Button className="gap-1.5"><Send className="h-4 w-4" /> Enviar por e-mail</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </Card>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <p className="text-sm">
      <span className="font-semibold">{k}:</span> <span className="text-foreground/90">{v}</span>
    </p>
  );
}

/* ---------- NOTAS ---------- */
function NotasModal({
  open,
  onOpenChange,
  cliente,
  clienteId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: ClienteDetalhe;
  clienteId?: number;
}) {
  const [nota, setNota] = useState("");
  const [notas, setNotas] = useState<{ id: number; autor: string; data: string; texto: string }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!clienteId || !Number.isFinite(clienteId)) return;
    setCarregando(true);
    try {
      const res = await fetchAdminClienteNotas(clienteId);
      setNotas(res.ok && res.notas ? res.notas : []);
    } catch {
      toast.error("Erro ao carregar notas");
      setNotas([]);
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const salvar = async () => {
    const texto = nota.trim();
    if (!texto || !clienteId) return;
    setSalvando(true);
    try {
      const res = await criarAdminClienteNota(clienteId, texto);
      if (!res.ok || !res.nota) {
        toast.error(res.error || "Não foi possível salvar a nota");
        return;
      }
      setNotas((prev) => [res.nota!, ...prev]);
      setNota("");
      toast.success("Nota salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar nota");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-yellow-500" /> Notas internas
          </DialogTitle>
          <DialogDescription>
            Anotações visíveis apenas para a equipe — {cliente.razao}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Escreva uma nota visível apenas para a equipe..."
            className="resize-none"
            disabled={salvando}
          />
          <Button
            size="sm"
            className="gap-1.5 self-start shrink-0"
            disabled={!nota.trim() || salvando || !clienteId}
            onClick={() => void salvar()}
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
        <Separator />
        <ScrollArea className="max-h-[320px] pr-3">
          <div className="space-y-3">
            {carregando && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando notas...
              </div>
            )}
            {!carregando && notas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma nota registrada para este cliente.
              </p>
            )}
            {!carregando &&
              notas.map((n) => (
                <Card key={n.id} className="p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{n.autor}</span>
                    <span>{n.data}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{n.texto}</p>
                </Card>
              ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- HISTÓRICO ---------- */
function HistoricoModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  const eventos = [
    { quando: "Hoje, 14:22", quem: "Sistema", oque: "SICAF atualizado via IA" },
    { quando: "Ontem, 09:10", quem: "Ana (atendimento)", oque: "Ligação registrada — 7min" },
    { quando: "05/06/2026", quem: "Cliente", oque: "Acessou o portal" },
    { quando: "01/06/2026", quem: "Sistema", oque: "Fatura gerada — R$ 690,00" },
    { quando: "22/05/2026", quem: "Carlos (admin)", oque: "Cadastro atualizado" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-slate-600" /> Histórico de atividades</DialogTitle>
          <DialogDescription>Atividades, acessos e registros de {cliente.razao}.</DialogDescription>
        </DialogHeader>
        <div className="relative pl-5 space-y-3">
          <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
          {eventos.map((e, i) => (
            <div key={i} className="relative">
              <span className="absolute -left-[14px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
              <p className="text-xs text-muted-foreground">{e.quando} · <span className="font-medium text-foreground">{e.quem}</span></p>
              <p className="text-sm">{e.oque}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- helpers ---------- */
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
