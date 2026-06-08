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
} from "lucide-react";
import { useState } from "react";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";

type AcaoKey = "contatos" | "avisos" | "contratos" | "sicaf-manual" | "relatorio" | "historico";

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
];

export function AcoesTab({ cliente }: { cliente: ClienteDetalhe }) {
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
      <AvisosModal open={aberta === "avisos"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <ContratosModal open={aberta === "contratos"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <SicafManualModal open={aberta === "sicaf-manual"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <RelatorioModal open={aberta === "relatorio"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
      <HistoricoModal open={aberta === "historico"} onOpenChange={(v) => !v && setAberta(null)} cliente={cliente} />
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

/* ---------- AVISOS EMAIL ---------- */
function AvisosModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  const templates = [
    { id: "cobranca", titulo: "Cobrança pendente", desc: "Lembrete de fatura em aberto" },
    { id: "renovacao", titulo: "Renovação SICAF", desc: "Aviso de vencimento próximo" },
    { id: "certidao", titulo: "Certidão vencida", desc: "Solicitação de envio de documento" },
    { id: "boas-vindas", titulo: "Boas-vindas", desc: "Cliente recém-cadastrado" },
  ];
  const [sel, setSel] = useState("renovacao");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-violet-500" /> Avisos por e-mail</DialogTitle>
          <DialogDescription>Selecione um template e envie para {cliente.email ?? "o cliente"}.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={`rounded-lg border p-3 text-left transition ${sel === t.id ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 ring-1 ring-violet-500/30" : "hover:bg-muted/40"}`}>
              <p className="text-sm font-semibold">{t.titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
        <Separator />
        <div className="space-y-2">
          <label className="text-xs font-medium">Mensagem adicional (opcional)</label>
          <Textarea placeholder="Escreva uma observação que será incluída no e-mail..." className="min-h-[80px]" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="gap-1.5"><Send className="h-4 w-4" /> Enviar e-mail</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- CONTRATOS ---------- */
function ContratosModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-amber-500" /> Contrato digital</DialogTitle>
          <DialogDescription>Atualize os dados do contrato vinculado a {cliente.razao}.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modelo de contrato">
            <select className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
              <option>Manutenção SICAF — Anual</option>
              <option>Manutenção SICAF Plus</option>
              <option>Consultoria avulsa</option>
            </select>
          </Field>
          <Field label="Vigência">
            <Input type="text" defaultValue="12 meses" />
          </Field>
          <Field label="Data de assinatura">
            <Input type="date" />
          </Field>
          <Field label="Valor mensal (R$)">
            <Input type="number" defaultValue={cliente.mrr || 690} />
          </Field>
          <Field label="Signatário (nome)" full>
            <Input defaultValue={cliente.responsavel} />
          </Field>
          <Field label="E-mail do signatário" full>
            <Input type="email" defaultValue={cliente.email ?? ""} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" className="gap-1.5"><Download className="h-4 w-4" /> Baixar PDF</Button>
          <Button className="gap-1.5"><Send className="h-4 w-4" /> Enviar para assinar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- SICAF MANUAL ---------- */
function SicafManualModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const processar = () => {
    setProcessando(true);
    setTimeout(() => {
      setProcessando(false);
      setConcluido(true);
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setArquivo(null); setConcluido(false); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-500" /> Atualizar SICAF manual</DialogTitle>
          <DialogDescription>Envie o PDF da Situação do Fornecedor — a IA irá atualizar os níveis de {cliente.razao} como no Assistente.</DialogDescription>
        </DialogHeader>

        {!concluido ? (
          <>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/10 p-6 cursor-pointer hover:bg-emerald-50/70 transition">
              <Upload className="h-7 w-7 text-emerald-500" />
              <p className="text-sm font-medium">{arquivo ? arquivo.name : "Clique para selecionar o PDF"}</p>
              <p className="text-xs text-muted-foreground">Apenas arquivos PDF · até 10 MB</p>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="gap-1.5" disabled={!arquivo || processando} onClick={processar}>
                {processando ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando com IA...</> : <><Sparkles className="h-4 w-4" /> Analisar com IA</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4" /> SICAF atualizado com sucesso pela IA.
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Nível I — Credenciamento: validado</li>
              <li>✓ Nível II — Habilitação Jurídica: validado</li>
              <li>✓ Nível III — Regularidade Fiscal: validado</li>
              <li>⚠ Nível IV — Regularidade Trabalhista: pendente</li>
            </ul>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RELATÓRIO ---------- */
function RelatorioModal({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (v: boolean) => void; cliente: ClienteDetalhe }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-emerald-600" /> Relatório do cliente</DialogTitle>
          <DialogDescription>Resumo completo de {cliente.razao} para impressão ou envio.</DialogDescription>
        </DialogHeader>
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Razão social" value={cliente.razao} />
            <Info label="CNPJ" value={cliente.cnpj} />
            <Info label="Responsável" value={cliente.responsavel} />
            <Info label="Cidade" value={cliente.cidade} />
            <Info label="Plano" value={cliente.plano ?? "—"} />
            <Info label="MRR" value={cliente.mrr ? `R$ ${cliente.mrr.toLocaleString("pt-BR")}` : "—"} />
            <Info label="Validade SICAF" value={cliente.validadeSicaf ?? "—"} />
            <Info label="Cliente desde" value={cliente.desde ?? "—"} />
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resumo</p>
            <p className="mt-1 text-sm">
              Cliente {cliente.sicaf === "ok" ? "com SICAF em dia" : cliente.sicaf === "pendente" ? "com pendências no SICAF" : "com SICAF vencido"}, {cliente.pagou ? "pagamentos em dia" : "inadimplente"}, {cliente.manutencao ? "com manutenção ativa" : "sem manutenção"}.
            </p>
          </div>
        </Card>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" className="gap-1.5"><Download className="h-4 w-4" /> Baixar PDF</Button>
          <Button className="gap-1.5"><Printer className="h-4 w-4" /> Imprimir</Button>
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
