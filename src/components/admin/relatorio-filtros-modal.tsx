import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import {
  X, FileSpreadsheet, FileType, FileText, Calendar, Filter, CheckCircle2, Mail,
  Users, DollarSign, FileCheck2, Ticket, TrendingUp, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadRelatorio,
  gerarRelatorio,
  type RelatorioKey,
} from "@/lib/admin-relatorios-api";

export type { RelatorioKey };

const META: Record<RelatorioKey, { icon: any; titulo: string; desc: string; tom: string }> = {
  clientes: { icon: Users, titulo: "Base de Clientes", desc: "Lista completa com status, MRR e responsável", tom: "blue" },
  financeiro: { icon: DollarSign, titulo: "Financeiro Mensal", desc: "Recebimentos, inadimplência, renovações", tom: "emerald" },
  sicaf: { icon: FileCheck2, titulo: "Gestão SICAF", desc: "Níveis I a VI, vencimentos e pendências", tom: "amber" },
  suporte: { icon: Ticket, titulo: "Suporte e SLA", desc: "Tickets resolvidos, tempo médio, NPS", tom: "violet" },
  googleads: { icon: TrendingUp, titulo: "Google Ads", desc: "Palavras, ROAS, CPA, atribuição", tom: "rose" },
};

const tomCls: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
  rose: "bg-rose-500/10 text-rose-600",
};

const COLUNAS: Record<RelatorioKey, string[]> = {
  clientes: ["Razão social", "CNPJ", "Plano", "MRR", "Status SICAF", "Responsável", "Última interação", "Tags"],
  financeiro: ["Cliente", "Fatura", "Vencimento", "Pago em", "Valor", "Forma de pagamento", "Status", "Juros/Multa"],
  sicaf: ["Empresa", "CNPJ", "Nível", "Status", "Validade", "Dias restantes", "Pendências", "Responsável"],
  suporte: ["Ticket", "Cliente", "Assunto", "Categoria", "Aberto em", "Resolvido em", "Tempo", "Avaliação"],
  googleads: ["Campanha", "Palavra-chave", "Impressões", "Cliques", "CTR", "CPC", "Conversões", "ROAS"],
};

interface Props {
  relatorio: RelatorioKey | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGerado?: () => void;
}

export function RelatorioFiltrosModal({ relatorio, open, onOpenChange, onGerado }: Props) {
  const [periodo, setPeriodo] = useState("30d");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [formato, setFormato] = useState<"xlsx" | "pdf" | "csv">("xlsx");
  const [colunas, setColunas] = useState<Record<string, boolean>>({});
  const [agendado, setAgendado] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [frequencia, setFrequencia] = useState("semanal");
  const [gerando, setGerando] = useState(false);

  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => setFiltros((p) => ({ ...p, [k]: v }));

  if (!relatorio) return null;
  const meta = META[relatorio];
  const Icon = meta.icon;
  const cols = COLUNAS[relatorio];

  const gerar = async () => {
    if (!relatorio) return;
    const colunasAtivas = cols.filter((c) => colunas[c] !== false);
    setGerando(true);
    const res = await gerarRelatorio({
      tipo: relatorio,
      periodo,
      dataIni: periodo === "custom" ? dataIni : undefined,
      dataFim: periodo === "custom" ? dataFim : undefined,
      formato,
      colunas: colunasAtivas,
      filtros,
      agendado,
      frequencia,
      emails: emailDestino,
    });
    setGerando(false);

    if (!res.ok) {
      toast.error(res.error || "Erro ao gerar relatório");
      return;
    }

    if (res.headers?.length && res.rows) {
      downloadRelatorio(res);
    }

    const colCount = colunasAtivas.length || cols.length;
    toast.success(`Relatório "${meta.titulo}" gerado`, {
      description: `${res.total ?? 0} linhas · ${formato.toUpperCase()} · ${colCount} colunas${agendado ? " · agendamento salvo" : ""}.`,
    });
    if (res.agendamentoErro) {
      toast.warning("Agendamento não salvo", { description: res.agendamentoErro });
    }
    onGerado?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Filtros — {meta.titulo}</DialogTitle>

        <div className="flex items-start justify-between border-b bg-gradient-to-br from-muted/30 to-background px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tomCls[meta.tom]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{meta.titulo}</h2>
              <p className="text-xs text-muted-foreground">{meta.desc}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-[68vh]">
          <div className="space-y-6 p-6">
            {/* Período */}
            <Section icon={Calendar} titulo="Período">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Intervalo">
                  <Select value={periodo} onValueChange={setPeriodo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="mes">Mês atual</SelectItem>
                      <SelectItem value="trimestre">Trimestre atual</SelectItem>
                      <SelectItem value="ano">Ano atual</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {periodo === "custom" && (
                  <>
                    <Field label="De"><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></Field>
                    <Field label="Até"><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></Field>
                  </>
                )}
              </div>
            </Section>

            {/* Filtros específicos por relatório */}
            <Section icon={Filter} titulo="Filtros específicos">
              {relatorio === "clientes" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Plano">
                    <Select value={filtros.plano ?? "todos"} onValueChange={(v) => setF("plano", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os planos</SelectItem>
                        <SelectItem value="essencial">Essencial</SelectItem>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="corporativo">Corporativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={filtros.status ?? "todos"} onValueChange={(v) => setF("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ativo">Ativos</SelectItem>
                        <SelectItem value="inadimplente">Inadimplentes</SelectItem>
                        <SelectItem value="cancelado">Cancelados</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="MRR mínimo (R$)">
                    <Input
                      type="number"
                      placeholder="0"
                      value={filtros.mrrMin ?? ""}
                      onChange={(e) => setF("mrrMin", e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {relatorio === "financeiro" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Status do pagamento">
                    <Select value={filtros.statusPg ?? "todos"} onValueChange={(v) => setF("statusPg", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="estorno">Estornado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Forma de pagamento">
                    <Select value={filtros.forma ?? "todas"} onValueChange={(v) => setF("forma", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Valor mínimo (R$)">
                    <Input
                      type="number"
                      placeholder="0"
                      value={filtros.valorMin ?? ""}
                      onChange={(e) => setF("valorMin", e.target.value)}
                    />
                  </Field>
                  <Field label="Valor máximo (R$)">
                    <Input
                      type="number"
                      placeholder="100000"
                      value={filtros.valorMax ?? ""}
                      onChange={(e) => setF("valorMax", e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {relatorio === "sicaf" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nível">
                    <Select value={filtros.nivel ?? "todos"} onValueChange={(v) => setF("nivel", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os níveis</SelectItem>
                        {["I", "II", "III", "IV", "V", "VI"].map(n => <SelectItem key={n} value={n}>Nível {n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Situação">
                    <Select value={filtros.sit ?? "todas"} onValueChange={(v) => setF("sit", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="ok">Regular</SelectItem>
                        <SelectItem value="vencendo">Vencendo (30 dias)</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Janela de vencimento (dias)"><Input type="number" defaultValue={30} /></Field>
                  <Field label="UF"><Input placeholder="Todas" /></Field>
                </div>
              )}

              {relatorio === "suporte" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <Select value={filtros.stTk ?? "todos"} onValueChange={(v) => setF("stTk", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="aberto">Abertos</SelectItem>
                        <SelectItem value="andamento">Em andamento</SelectItem>
                        <SelectItem value="resolvido">Resolvidos</SelectItem>
                        <SelectItem value="fechado">Fechados</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Categoria">
                    <Select value={filtros.cat ?? "todas"} onValueChange={(v) => setF("cat", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="sicaf">SICAF</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="documentos">Documentos</SelectItem>
                        <SelectItem value="duvida">Dúvida geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}

              {relatorio === "googleads" && (
                <p className="text-xs text-muted-foreground">
                  Dados de palavras-chave com pagamentos validados no período selecionado (tracking Google Ads + taxas SICAF / Gerencianet).
                </p>
              )}
            </Section>

            {/* Colunas */}
            <Section icon={CheckCircle2} titulo="Colunas a incluir" hint="Vazio = todas as colunas">
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {cols.map((c) => {
                  const on = colunas[c] !== false;
                  return (
                    <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition ${on ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
                      <Switch checked={on} onCheckedChange={(v) => setColunas((p) => ({ ...p, [c]: v }))} />
                      <span>{c}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            {/* Formato */}
            <Section icon={FileSpreadsheet} titulo="Formato de saída">
              <div className="grid gap-3 sm:grid-cols-3">
                <FormatoCard atual={formato} v="xlsx" set={setFormato} icon={FileSpreadsheet} label="Excel" desc=".xlsx · planilha formatada" tom="emerald" />
                <FormatoCard atual={formato} v="pdf" set={setFormato} icon={FileType} label="PDF" desc="Para impressão / envio" tom="rose" />
                <FormatoCard atual={formato} v="csv" set={setFormato} icon={FileText} label="CSV" desc="Para integrar com BI" tom="blue" />
              </div>
            </Section>

            {/* Agendamento */}
            <Section icon={Mail} titulo="Agendamento por e-mail">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Enviar automaticamente</p>
                  <p className="text-xs text-muted-foreground">Receba este relatório no e-mail na frequência escolhida.</p>
                </div>
                <Switch checked={agendado} onCheckedChange={setAgendado} />
              </div>
              {agendado && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="E-mail(s) de destino" hint="Separe múltiplos por vírgula.">
                    <Input value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} placeholder="financeiro@cadbrasil.com.br" />
                  </Field>
                  <Field label="Frequência">
                    <Select value={frequencia} onValueChange={setFrequencia}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diario">Diário (06h)</SelectItem>
                        <SelectItem value="semanal">Semanal (seg 08h)</SelectItem>
                        <SelectItem value="mensal">Mensal (dia 1, 08h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
            </Section>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">
                Dica: ative <span className="font-medium text-foreground">Agendamento</span> para receber este relatório por e-mail sem precisar gerar manualmente.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
          <Badge variant="outline" className="text-[10px]">
            Saída: {formato.toUpperCase()} · {agendado ? frequencia : "sob demanda"}
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gerando}>
              Cancelar
            </Button>
            <Button onClick={() => void gerar()} disabled={gerando}>
              {gerando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…
                </>
              ) : (
                "Gerar relatório"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon: I, titulo, hint, children }: { icon: any; titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <I className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FormatoCard({
  atual, v, set, icon: I, label, desc, tom,
}: { atual: string; v: "xlsx" | "pdf" | "csv"; set: (v: "xlsx" | "pdf" | "csv") => void; icon: any; label: string; desc: string; tom: string }) {
  const sel = atual === v;
  return (
    <button
      onClick={() => set(v)}
      className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition ${sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tomCls[tom]}`}>
        <I className="h-5 w-5" />
      </div>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      {sel && <Badge className="mt-2 text-[10px]">Selecionado</Badge>}
    </button>
  );
}
