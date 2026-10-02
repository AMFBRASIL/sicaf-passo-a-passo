import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Barcode,
  CalendarCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Landmark,
  Loader2,
  Lock,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoletoGeradoPanel } from "@/components/sicaf/BoletoGeradoPanel";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";
import {
  PagamentoServicoModal,
  type PagamentoServicoInfo,
} from "@/components/pagamento-servico-modal";
import {
  MODULOS_INFO,
  dataModuloFmt,
  fetchModuloAssinatura,
  gerarMensalidadeModulo,
  valorModuloFmt,
  verificarPagamentoModulo,
  type ModuloAssinatura,
  type ModuloPagamento,
  type ModuloPago,
} from "@/lib/modulos-api";
import { cn } from "@/lib/utils";

type EmpresaInfo = { clienteId: number; nome: string; documento: string };

/**
 * Libera o conteúdo do módulo somente com a mensalidade em dia (ou para a equipe CADBRASIL).
 * Sem assinatura ativa, mostra a contratação com PIX/boleto e o histórico de mensalidades.
 */
export function ModuloGate({
  modulo,
  empresa,
  children,
}: {
  modulo: ModuloPago;
  empresa: EmpresaInfo;
  children: ReactNode;
}) {
  const [assinatura, setAssinatura] = useState<ModuloAssinatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const res = await fetchModuloAssinatura(modulo, empresa.clienteId);
    if (!res.ok) setErro(res.error);
    else {
      setErro(null);
      setAssinatura(res);
    }
    setLoading(false);
  }, [modulo, empresa.clienteId]);

  useEffect(() => {
    setLoading(true);
    void carregar();
  }, [carregar]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Verificando a assinatura do
        módulo...
      </div>
    );
  }

  if (erro || !assinatura) {
    return (
      <Card className="border-danger/30">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-danger" />
          <p className="font-semibold">{erro || "Não foi possível verificar a assinatura."}</p>
          <Button variant="outline" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!assinatura.ativo && !assinatura.acessoEquipe) {
    return <ModuloPaywall assinatura={assinatura} empresa={empresa} onAtualizar={carregar} />;
  }

  return (
    <div className="space-y-6">
      <ModuloAssinaturaBarra assinatura={assinatura} empresa={empresa} onAtualizar={carregar} />
      {children}
    </div>
  );
}

function ModuloPaywall({
  assinatura,
  empresa,
  onAtualizar,
}: {
  assinatura: ModuloAssinatura;
  empresa: EmpresaInfo;
  onAtualizar: () => Promise<void>;
}) {
  const info = MODULOS_INFO[assinatura.modulo];
  const expirou = Boolean(assinatura.validoAte);
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/30 shadow-soft">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4 bg-gradient-to-br from-primary/10 via-background to-background p-6">
            <Badge className="gap-1">
              <Lock className="h-3 w-3" /> Módulo por assinatura mensal
            </Badge>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{info.nome}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{info.resumo}</p>
            </div>
            {expirou && (
              <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground" />A assinatura
                venceu em {dataModuloFmt(assinatura.validoAte)}. Pague a mensalidade para voltar a
                usar o módulo — seus dados continuam salvos.
              </p>
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {info.beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t p-6 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mensalidade
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              {valorModuloFmt(assinatura.valor)}
              <span className="text-base font-medium text-muted-foreground">/mês</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Empresa: <strong className="text-foreground">{empresa.nome}</strong>
            </p>
            <div className="mt-4">
              <CobrancaMensalidade assinatura={assinatura} empresa={empresa} onPago={onAtualizar} />
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Acesso liberado assim que o pagamento é confirmado: PIX na hora; boleto em até 3 dias
              úteis. Cada mensalidade libera 30 dias de uso. Sem fidelidade.
            </p>
          </div>
        </div>
      </Card>

      {assinatura.historico.length > 0 && (
        <HistoricoMensalidades
          assinatura={assinatura}
          empresa={empresa}
          onAtualizar={onAtualizar}
        />
      )}
    </div>
  );
}

function ModuloAssinaturaBarra({
  assinatura,
  empresa,
  onAtualizar,
}: {
  assinatura: ModuloAssinatura;
  empresa: EmpresaInfo;
  onAtualizar: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const vencendo = assinatura.ativo && assinatura.podeRenovar;
  const somenteEquipe = !assinatura.ativo && assinatura.acessoEquipe;

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5",
          vencendo
            ? "border-warning/40 bg-warning/10"
            : somenteEquipe
              ? "border-border bg-muted/40"
              : "border-success/30 bg-success/5",
        )}
      >
        <div className="flex items-center gap-2.5 text-sm">
          {somenteEquipe ? (
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          ) : vencendo ? (
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
          ) : (
            <CalendarCheck className="h-4 w-4 text-success" />
          )}
          <span>
            {somenteEquipe ? (
              <>
                <strong>Acesso da equipe CADBRASIL</strong> — esta empresa não tem a mensalidade
                ativa.
              </>
            ) : (
              <>
                <strong>Plano mensal ativo</strong> até {dataModuloFmt(assinatura.validoAte)}
                {assinatura.diasRestantes != null && (
                  <span className="text-muted-foreground">
                    {" "}
                    (
                    {assinatura.diasRestantes === 0
                      ? "vence hoje"
                      : `${assinatura.diasRestantes} dia(s)`}
                    )
                  </span>
                )}
              </>
            )}
          </span>
        </div>
        <Button
          size="sm"
          variant={vencendo ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Receipt className="h-3.5 w-3.5" />
          {vencendo ? "Renovar mensalidade" : "Mensalidades e boletos"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{MODULOS_INFO[assinatura.modulo].nome}</DialogTitle>
            <DialogDescription>
              Mensalidade de {valorModuloFmt(assinatura.valor)} · {empresa.nome}
            </DialogDescription>
          </DialogHeader>
          <MensalidadesConteudo
            assinatura={assinatura}
            empresa={empresa}
            onAtualizar={onAtualizar}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function MensalidadesConteudo({
  assinatura,
  empresa,
  onAtualizar,
}: {
  assinatura: ModuloAssinatura;
  empresa: EmpresaInfo;
  onAtualizar: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {assinatura.ativo && (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
          <CalendarCheck className="h-4 w-4 text-success" />
          Plano ativo até <strong>{dataModuloFmt(assinatura.validoAte)}</strong>
        </p>
      )}
      {assinatura.podeRenovar ? (
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-semibold">
            {assinatura.ativo ? "Pagar a próxima mensalidade" : "Pagar a mensalidade"}
          </p>
          <CobrancaMensalidade assinatura={assinatura} empresa={empresa} onPago={onAtualizar} />
        </div>
      ) : (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          A próxima mensalidade fica disponível para pagamento 7 dias antes do vencimento (
          {dataModuloFmt(assinatura.validoAte)}).
        </p>
      )}
      <HistoricoMensalidades
        assinatura={assinatura}
        empresa={empresa}
        onAtualizar={onAtualizar}
        semCard
      />
    </div>
  );
}

/** Mensalidades e boletos de um módulo (usado fora da página do módulo, ex.: Pagamentos). */
export function ModuloMensalidadesDialog({
  open,
  onOpenChange,
  modulo,
  empresa,
  onAtualizado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modulo: ModuloPago | null;
  empresa: EmpresaInfo | null;
  onAtualizado?: () => void;
}) {
  const [assinatura, setAssinatura] = useState<ModuloAssinatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!modulo || !empresa) return;
    const res = await fetchModuloAssinatura(modulo, empresa.clienteId);
    if (!res.ok) setErro(res.error);
    else {
      setErro(null);
      setAssinatura(res);
    }
  }, [modulo, empresa]);

  useEffect(() => {
    if (!open) return;
    setAssinatura(null);
    setErro(null);
    void carregar();
  }, [open, carregar]);

  const atualizar = async () => {
    await carregar();
    onAtualizado?.();
  };

  const info = modulo ? MODULOS_INFO[modulo] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{info?.nome}</DialogTitle>
          <DialogDescription>
            {assinatura ? `Mensalidade de ${valorModuloFmt(assinatura.valor)} · ` : ""}
            {empresa?.nome}
          </DialogDescription>
        </DialogHeader>
        {erro ? (
          <p className="text-sm text-danger">{erro}</p>
        ) : !assinatura || !empresa ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando mensalidades...
          </div>
        ) : (
          <>
            {!assinatura.ativo && info && (
              <p className="text-sm text-muted-foreground">{info.resumo}</p>
            )}
            <MensalidadesConteudo
              assinatura={assinatura}
              empresa={empresa}
              onAtualizar={atualizar}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CobrancaMensalidade({
  assinatura,
  empresa,
  onPago,
}: {
  assinatura: ModuloAssinatura;
  empresa: EmpresaInfo;
  onPago: () => Promise<void>;
}) {
  const [pagamento, setPagamento] = useState<ModuloPagamento | null>(assinatura.pagamentoAberto);
  const [verificando, setVerificando] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => setPagamento(assinatura.pagamentoAberto), [assinatura.pagamentoAberto]);

  const info = MODULOS_INFO[assinatura.modulo];
  const infoPagamento: PagamentoServicoInfo = {
    titulo: `Pagamento do módulo ${assinatura.nome}`,
    descricao: `Para liberar o ${info.nome} é necessário confirmar o pagamento da mensalidade.`,
    etapaTitulo: "Confirme o plano mensal",
    etapaSubtitulo: info.resumo,
    plano: {
      titulo: `${assinatura.nome} · Plano mensal`,
      descricao: "Cada mensalidade libera 30 dias de uso. Sem fidelidade.",
      prazo: "Liberado após a confirmação do pagamento",
      badge: "Mensal",
      icon: assinatura.modulo === "pncp" ? Globe : Landmark,
      itens: info.beneficios,
    },
    valor: assinatura.valor,
    recorrencia: "mensal",
    aviso: {
      titulo: "Mensalidade do módulo",
      texto:
        "Pagamento via Gerencianet/Efí. A próxima mensalidade fica disponível 7 dias antes do vencimento, aqui e na tela de Pagamentos.",
    },
    liberacao: "PIX libera o módulo na hora; boleto, assim que for compensado (até 3 dias úteis).",
  };

  const verificar = async () => {
    if (!pagamento) return;
    setVerificando(true);
    const pago = await verificarPagamentoModulo(pagamento.id).catch(() => false);
    setVerificando(false);
    if (pago) {
      toast.success("Pagamento confirmado! Módulo liberado.");
      await onPago();
    } else {
      toast.info(
        "Pagamento ainda não identificado. Boletos podem levar até 3 dias úteis para compensar.",
      );
    }
  };

  return (
    <div className="space-y-3">
      <Button className="h-11 w-full gap-2" onClick={() => setModalOpen(true)}>
        <Barcode className="h-4 w-4" />
        {pagamento ? "Nova cobrança (PIX ou boleto)" : "Pagar mensalidade (PIX ou boleto)"}
      </Button>

      {pagamento?.tipo === "boleto" && pagamento.barcode && (
        <BoletoGeradoPanel
          compact
          documento={empresa.documento}
          boletoData={{
            barcode: pagamento.barcode,
            link: pagamento.link,
            pdf: pagamento.pdf,
            valor: pagamento.valor,
            vencimento: pagamento.vencimento || "",
            protocolo: pagamento.protocolo,
          }}
        />
      )}

      {pagamento?.tipo === "pix" && pagamento.qrcodeText && (
        <Button variant="secondary" className="w-full gap-2" onClick={() => setPixOpen(true)}>
          <QrCode className="h-4 w-4" /> Ver QR Code do PIX gerado
        </Button>
      )}

      {pagamento && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5"
          disabled={verificando}
          onClick={() => void verificar()}
        >
          {verificando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Já paguei — verificar pagamento
        </Button>
      )}

      <PixPaymentModal
        open={pixOpen}
        onOpenChange={setPixOpen}
        client={empresa.nome}
        documento={empresa.documento}
        pixData={
          pagamento?.tipo === "pix"
            ? {
                qrcodeText: pagamento.qrcodeText,
                qrcodeImage: pagamento.qrcodeImage,
                valor: pagamento.valor,
                protocolo: pagamento.protocolo,
                txid: pagamento.txid,
                pagamentoId: pagamento.id,
              }
            : null
        }
        onPaymentConfirmed={() => {
          setPixOpen(false);
          toast.success("Pagamento confirmado! Módulo liberado.");
          void onPago();
        }}
      />

      <PagamentoServicoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        empresa={{ nome: empresa.nome, cnpj: empresa.documento }}
        info={infoPagamento}
        gerar={(forma) => gerarMensalidadeModulo(assinatura.modulo, empresa.clienteId, forma)}
        onGerado={(p) =>
          setPagamento({ ...p, status: "gerado", descricao: null, dataPagamento: null })
        }
        onPago={() => {
          toast.success("Pagamento confirmado! Módulo liberado.");
          void onPago();
        }}
      />
    </div>
  );
}

const STATUS_MENSALIDADE: Record<ModuloPagamento["status"], { label: string; cls: string }> = {
  pago: { label: "Pago", cls: "bg-success/10 text-success border-success/20" },
  aguardando: {
    label: "Em aberto",
    cls: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  gerado: { label: "Em aberto", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
  expirado: { label: "Vencido", cls: "bg-muted text-muted-foreground border-border" },
};

function HistoricoMensalidades({
  assinatura,
  empresa,
  onAtualizar,
  semCard,
}: {
  assinatura: ModuloAssinatura;
  empresa: EmpresaInfo;
  onAtualizar: () => Promise<void>;
  semCard?: boolean;
}) {
  const [verificando, setVerificando] = useState<number | null>(null);
  const [pix, setPix] = useState<ModuloPagamento | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  const verificar = async (p: ModuloPagamento) => {
    setVerificando(p.id);
    const pago = await verificarPagamentoModulo(p.id).catch(() => false);
    setVerificando(null);
    if (pago) {
      toast.success("Pagamento confirmado!");
      await onAtualizar();
    } else toast.info("Pagamento ainda não identificado.");
  };

  const lista = (
    <>
      {assinatura.historico.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma mensalidade gerada ainda.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {assinatura.historico.map((p) => {
            const vencido = p.status !== "pago" && Boolean(p.vencimento && p.vencimento < hoje);
            const st = vencido ? STATUS_MENSALIDADE.expirado : STATUS_MENSALIDADE[p.status];
            const aberto = p.status !== "pago" && !vencido;
            const boletoUrl = p.pdf || p.link;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("border", st.cls)}>
                      {st.label}
                    </Badge>
                    <span className="text-xs uppercase text-muted-foreground">
                      {p.tipo === "pix" ? "PIX" : "Boleto"}
                    </span>
                    <span className="text-sm font-semibold">{valorModuloFmt(p.valor)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.descricao || p.protocolo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.status === "pago"
                      ? `Pago em ${dataModuloFmt(p.dataPagamento)}`
                      : `Vencimento ${dataModuloFmt(p.vencimento)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.tipo === "boleto" && boletoUrl && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                      <a href={boletoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Boleto
                      </a>
                    </Button>
                  )}
                  {aberto && p.tipo === "boleto" && p.barcode && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      onClick={() => {
                        void navigator.clipboard.writeText(p.barcode);
                        toast.success("Linha digitável copiada");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar código
                    </Button>
                  )}
                  {aberto && p.tipo === "pix" && p.qrcodeText && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      onClick={() => setPix(p)}
                    >
                      <QrCode className="h-3.5 w-3.5" /> QR Code
                    </Button>
                  )}
                  {aberto && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1"
                      disabled={verificando === p.id}
                      onClick={() => void verificar(p)}
                    >
                      {verificando === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Verificar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <PixPaymentModal
        open={!!pix}
        onOpenChange={(v) => !v && setPix(null)}
        client={empresa.nome}
        documento={empresa.documento}
        pixData={
          pix
            ? {
                qrcodeText: pix.qrcodeText,
                qrcodeImage: pix.qrcodeImage,
                valor: pix.valor,
                protocolo: pix.protocolo,
                txid: pix.txid,
                pagamentoId: pix.id,
              }
            : null
        }
        onPaymentConfirmed={() => {
          setPix(null);
          toast.success("Pagamento confirmado!");
          void onAtualizar();
        }}
      />
    </>
  );

  if (semCard) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-primary" /> Meus boletos do módulo
        </p>
        {lista}
      </div>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-primary" /> Meus boletos do módulo
        </CardTitle>
      </CardHeader>
      <CardContent>{lista}</CardContent>
    </Card>
  );
}
