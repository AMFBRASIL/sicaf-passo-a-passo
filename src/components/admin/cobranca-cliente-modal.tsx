import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  HandCoins,
  Phone,
  Mail,
  MessageSquare,
  Send,
  History,
  QrCode,
  Copy,
  CheckCircle2,
  CalendarClock,
  Loader2,
  ExternalLink,
  X,
  Clock,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import {
  enviarCobrancaCliente,
  fetchCobrancaHistorico,
  formatBRL,
  type ClienteCobrancaPendente,
  type CobrancaHistoricoItem,
  type SeveridadeCobranca,
} from "@/lib/cobranca-api";
import { validarPagamentoAdmin } from "@/lib/admin-clientes-api";
import { buildWhatsAppSuporteUrl } from "@/lib/whatsapp-suporte";

const sevBadge: Record<SeveridadeCobranca, { label: string; cls: string }> = {
  leve: { label: "Leve", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  media: { label: "Atenção", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  critica: { label: "Crítico", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

export function CobrancaClienteModal({
  cliente,
  open,
  onClose,
  onAtualizado,
}: {
  cliente: ClienteCobrancaPendente | null;
  open?: boolean;
  onClose: () => void;
  onAtualizado?: () => void;
}) {
  const [mensagem, setMensagem] = useState("");
  const [historico, setHistorico] = useState<CobrancaHistoricoItem[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [validando, setValidando] = useState(false);
  const isOpen = open ?? !!cliente;

  useEffect(() => {
    if (!cliente || !isOpen) {
      setHistorico([]);
      return;
    }
    let cancelled = false;
    setLoadingHist(true);
    void fetchCobrancaHistorico(cliente.clienteId).then((res) => {
      if (cancelled) return;
      setLoadingHist(false);
      if (res.ok) setHistorico(res.historico || []);
    });
    return () => {
      cancelled = true;
    };
  }, [cliente?.clienteId, isOpen]);

  if (!cliente) return null;

  const sev = (cliente.severidade || "leve") as SeveridadeCobranca;
  const payLink = cliente.payLink || "";
  const whatsappUrl = buildWhatsAppSuporteUrl(
    [
      `Olá! Aqui é a equipe CADBRASIL.`,
      `Identificamos pendência de pagamento (${cliente.descricao}) para ${cliente.company}.`,
      `Valor: ${formatBRL(cliente.valor)}.`,
      payLink ? `Link para pagamento: ${payLink}` : "",
      `Podemos ajudar na regularização?`,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const enviarEmail = async () => {
    if (!cliente.email) {
      toast.error("Cliente sem e-mail cadastrado");
      return;
    }
    setEnviando(true);
    const res = await enviarCobrancaCliente({
      clienteId: cliente.clienteId,
      taxaId: cliente.taxaId,
      pagamentoId: cliente.pagamentoId,
    });
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao enviar cobrança");
      return;
    }
    toast.success(res.message || "E-mail de cobrança enviado");
    onAtualizado?.();
    const hist = await fetchCobrancaHistorico(cliente.clienteId);
    if (hist.ok) setHistorico(hist.historico || []);
  };

  const marcarPago = async () => {
    if (!cliente.pagamentoId) {
      toast.error("Nenhum pagamento vinculado para validar — use o link público ou conciliação");
      return;
    }
    setValidando(true);
    const res = await validarPagamentoAdmin(cliente.pagamentoId);
    setValidando(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao validar pagamento");
      return;
    }
    toast.success(res.message || "Pagamento validado");
    onAtualizado?.();
    onClose();
  };

  const copyLink = () => {
    if (!payLink) {
      toast.error("Link de pagamento indisponível");
      return;
    }
    void navigator.clipboard.writeText(payLink);
    toast.success("Link copiado");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 sm:rounded-2xl border-0 max-h-[92vh] flex flex-col">
        <div className="border-b bg-gradient-to-r from-rose-50 via-white to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-12 w-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 ring-1 ring-rose-200">
                <HandCoins className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 truncate">{cliente.company}</h2>
                  <Badge variant="outline" className={sevBadge[sev].cls}>
                    {sevBadge[sev].label}
                  </Badge>
                  {cliente.status === "Vencido" && (
                    <Badge variant="outline" className="text-rose-700 border-rose-200">
                      Vencido
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  CNPJ {cliente.cnpj} {cliente.cidade ? `· ${cliente.cidade}` : ""}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 flex-wrap">
                  {cliente.telefone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {cliente.telefone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {cliente.email || "Sem e-mail"}
                  </span>
                  {cliente.foiCobrado && (
                    <span className="flex items-center gap-1">
                      <History className="h-3 w-3" />
                      Última cobrança: {cliente.ultimaCobrancaFormatada}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Resumo label="Valor em aberto" value={formatBRL(cliente.valor)} tone="rose" icon={DollarSign} />
            <Resumo label="Dias pendente" value={`${cliente.diasPendente} dias`} tone="amber" icon={Clock} />
            <Resumo label="Cobranças enviadas" value={String(cliente.totalCobrancas)} tone="slate" icon={MessageSquare} />
            <Resumo
              label="Vencimento"
              value={cliente.vencimentoFormatado || cliente.pendenteDesdeFormatado || "—"}
              tone="slate"
              icon={CalendarClock}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="cobrar" className="w-full">
            <div className="px-6 pt-4">
              <TabsList>
                <TabsTrigger value="cobrar">Cobrar agora</TabsTrigger>
                <TabsTrigger value="link">Link de pagamento</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="cobrar" className="px-6 py-5 grid lg:grid-cols-3 gap-4">
              <Card className="p-4 lg:col-span-2">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4 text-rose-600" /> Disparar cobrança
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  O e-mail inclui links de acesso ao portal, página de pagamentos e WhatsApp CADBRASIL.
                </p>
                <Textarea
                  rows={5}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder={`Olá ${cliente.responsavel || "cliente"}, identificamos que o pagamento referente a ${cliente.descricao} (${formatBRL(cliente.valor)}) está pendente há ${cliente.diasPendente} dias.`}
                  className="mb-3"
                />
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                  <Button
                    onClick={() => void enviarEmail()}
                    disabled={!cliente.email || enviando}
                    variant="outline"
                    className="gap-1.5"
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    E-mail de cobrança
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Ações rápidas
                </h3>
                <Button
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 mb-2"
                  disabled={!cliente.pagamentoId || validando}
                  onClick={() => void marcarPago()}
                >
                  {validando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Marcar como pago
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Valida o pagamento vinculado à taxa (quando existir registro em pagamentos).
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="link" className="px-6 py-5">
              <Card className="p-4 max-w-2xl">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-rose-600" /> Link público de pagamento
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Compartilhe com o cliente — página pública com todas as guias pendentes (PIX, boleto, etc.).
                </p>
                {payLink ? (
                  <>
                    <div className="rounded-lg border bg-slate-50 p-3 text-xs font-mono break-all">{payLink}</div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
                        <Copy className="h-3.5 w-3.5" /> Copiar link
                      </Button>
                      <Button size="sm" className="gap-1.5" asChild>
                        <a href={payLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir página
                        </a>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Código: <strong>{cliente.payCode}</strong> · Forma: {cliente.formaPagamento}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Link indisponível para este registro.</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="historico" className="px-6 py-5 space-y-2">
              {loadingHist ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                </div>
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma cobrança registrada ainda.</p>
              ) : (
                historico.map((e) => (
                  <div key={e.id} className="flex gap-3 rounded-lg border p-3 bg-white">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{e.descricao}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{e.enviadoEmFormatado}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {e.enviadoPor} · {e.canal}
                        {!e.sucesso && e.erro ? ` · ${e.erro}` : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t bg-slate-50/60 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {cliente.responsavel || "—"} · {cliente.descricao}
          </span>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "rose" | "amber" | "slate";
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-white text-slate-700 border-slate-200",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
