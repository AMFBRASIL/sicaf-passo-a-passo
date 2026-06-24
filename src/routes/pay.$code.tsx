import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Receipt,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CalendarClock,
  Lock,
  QrCode,
  FileText,
  Mail,
  Phone,
  HelpCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchPublicPayPage, type PublicPayGuia, type PublicPayPage } from "@/lib/public-pay-api";
import { buildWhatsAppSuporteUrl } from "@/lib/whatsapp-suporte";

export const Route = createFileRoute("/pay/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Pagamento ${params.code?.toUpperCase()} — CADBRASIL` },
      {
        name: "description",
        content: "Acesso seguro às suas guias de pagamento CADBRASIL. Boleto, PIX e mais.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PayPageRoute,
});

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusBadge(s: PublicPayGuia["status"]) {
  if (s === "pago")
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Pago
      </Badge>
    );
  if (s === "vencido")
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100 border border-red-200">
        <AlertTriangle className="h-3 w-3" /> Vencido
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">
      <Clock className="h-3 w-3" /> Pendente
    </Badge>
  );
}

function PayPageRoute() {
  const { code } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cobranca, setCobranca] = useState<PublicPayPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    void fetchPublicPayPage(code).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.guias) {
        setErro(res.error || "Link inválido ou expirado");
        setCobranca(null);
        return;
      }
      setCobranca(res as PublicPayPage);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando pagamento...
        </div>
      </div>
    );
  }

  if (erro || !cobranca) {
    return <LinkInvalido mensagem={erro || undefined} />;
  }

  return <PayPage cobranca={cobranca} />;
}

function PayPage({ cobranca }: { cobranca: PublicPayPage }) {
  const guiasAbertas = cobranca.guias.filter((g) => g.status !== "pago");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  useEffect(() => {
    const focus = cobranca.focusGuiaId;
    const abertas = cobranca.guias.filter((g) => g.status !== "pago").map((g) => g.id);
    setSelecionadas(focus && abertas.includes(focus) ? [focus] : abertas);
  }, [cobranca.focusGuiaId, cobranca.guias]);

  const [metodo, setMetodo] = useState<"pix" | "boleto">(() => {
    if (cobranca.pagamento.pixCopiaCola) return "pix";
    if (cobranca.pagamento.linhaDigitavel || cobranca.pagamento.linkPdf) return "boleto";
    return "pix";
  });

  const guiasSelecionadas = useMemo(
    () => cobranca.guias.filter((g) => selecionadas.includes(g.id)),
    [cobranca.guias, selecionadas],
  );

  const total = guiasSelecionadas.reduce((acc, g) => acc + g.valor, 0);

  const pixAtivo =
    guiasSelecionadas.find((g) => g.pixCopiaCola)?.pixCopiaCola ||
    cobranca.pagamento.pixCopiaCola;
  const pixQr =
    guiasSelecionadas.find((g) => g.pixQrImage)?.pixQrImage || cobranca.pagamento.pixQrImage;
  const linhaDigitavel =
    guiasSelecionadas.find((g) => g.linhaDigitavel)?.linhaDigitavel ||
    cobranca.pagamento.linhaDigitavel;
  const linkPdf =
    guiasSelecionadas.find((g) => g.linkPdf)?.linkPdf || cobranca.pagamento.linkPdf;
  const linkBoleto =
    guiasSelecionadas.find((g) => g.linkBoleto)?.linkBoleto || cobranca.pagamento.linkBoleto;

  const toggleGuia = (id: string) => {
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const copy = (txt: string, label: string) => {
    void navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado!`);
  };

  const diasRestantes = Math.max(
    0,
    Math.ceil((new Date(cobranca.expiraEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  const whatsappUrl = buildWhatsAppSuporteUrl(
    `Olá! Estou na página de pagamento CADBRASIL (${cobranca.codigo}) e preciso de ajuda para regularizar ${cobranca.empresa.razao}.`,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-slate-900">
                CADBRASIL <span className="text-slate-400">360</span>
              </p>
              <p className="text-[11px] text-slate-500">Portal seguro de pagamento</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <Lock className="h-3.5 w-3.5" />
            Conexão criptografada · SSL
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Cobrança #{cobranca.codigo}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Olá, {cobranca.cliente.nomeMascarado.split(" ")[0]}. Você tem guias em aberto.
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Selecione as guias que deseja pagar e escolha PIX ou boleto.
            </p>
          </div>
          <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
            <CalendarClock className="h-3.5 w-3.5" />
            Link válido por mais {diasRestantes} dias
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  Empresa vinculada
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{cobranca.empresa.razao}</p>
                    <p className="text-xs text-slate-500">CNPJ {cobranca.empresa.cnpj}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Responsável</p>
                    <p className="text-sm font-medium text-slate-700">{cobranca.cliente.nomeMascarado}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Receipt className="h-4 w-4 text-slate-500" />
                  Guias de pagamento ({cobranca.guias.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                  {cobranca.guias.map((g) => {
                    const checked = selecionadas.includes(g.id);
                    const disabled = g.status === "pago";
                    return (
                      <label
                        key={g.id}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 ${disabled ? "opacity-60" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleGuia(g.id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{g.tipo}</span>
                            <span className="text-xs text-slate-500">· {g.descricao}</span>
                            {statusBadge(g.status)}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Competência {g.competencia} · Vencimento {g.vencimento}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{fmtBRL(g.valor)}</p>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Forma de pagamento</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs value={metodo} onValueChange={(v) => setMetodo(v as "pix" | "boleto")}>
                  <TabsList>
                    <TabsTrigger value="pix" className="gap-2" disabled={!pixAtivo}>
                      <QrCode className="h-4 w-4" /> PIX
                    </TabsTrigger>
                    <TabsTrigger
                      value="boleto"
                      className="gap-2"
                      disabled={!linhaDigitavel && !linkPdf && !linkBoleto}
                    >
                      <FileText className="h-4 w-4" /> Boleto
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pix" className="mt-4">
                    {pixAtivo ? (
                      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                        {pixQr ? (
                          <div className="flex items-center justify-center rounded-md border border-slate-200 bg-white p-4">
                            <img src={pixQr} alt="QR Code PIX" className="h-40 w-40 object-contain" />
                          </div>
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                            Use o PIX Copia e Cola
                          </div>
                        )}
                        <div className="space-y-3">
                          <p className="text-sm text-slate-600">
                            Escaneie o QR Code no app do seu banco ou use o PIX Copia e Cola abaixo.
                          </p>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <p className="break-all font-mono text-[11px] leading-relaxed text-slate-700">
                              {pixAtivo}
                            </p>
                          </div>
                          <Button onClick={() => copy(pixAtivo, "PIX Copia e Cola")} className="w-full sm:w-auto">
                            <Copy className="mr-2 h-4 w-4" /> Copiar PIX
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 py-4">
                        PIX ainda não gerado para esta cobrança. Entre em contato com a equipe CADBRASIL.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="boleto" className="mt-4 space-y-3">
                    {linhaDigitavel ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Linha digitável
                        </p>
                        <p className="mt-1 font-mono text-sm text-slate-800">{linhaDigitavel}</p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {linhaDigitavel && (
                        <Button onClick={() => copy(linhaDigitavel, "Linha digitável")}>
                          <Copy className="mr-2 h-4 w-4" /> Copiar código
                        </Button>
                      )}
                      {(linkPdf || linkBoleto) && (
                        <Button variant="outline" asChild>
                          <a href={linkPdf || linkBoleto || "#"} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" /> Baixar boleto
                          </a>
                        </Button>
                      )}
                    </div>
                    {!linhaDigitavel && !linkPdf && !linkBoleto && (
                      <p className="text-sm text-slate-500">Boleto ainda não disponível para esta cobrança.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card className="border-slate-200 shadow-sm lg:sticky lg:top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Resumo do pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  {guiasSelecionadas.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {g.tipo} · {g.competencia}
                      </span>
                      <span className="font-medium tabular-nums text-slate-900">{fmtBRL(g.valor)}</span>
                    </div>
                  ))}
                  {guiasSelecionadas.length === 0 && (
                    <p className="text-sm text-slate-500">Nenhuma guia selecionada.</p>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total selecionado</span>
                  <span className="text-xl font-bold tabular-nums text-slate-900">{fmtBRL(total)}</span>
                </div>
                {cobranca.resumo.qtdVencidas > 0 && (
                  <p className="text-xs text-rose-600">
                    {cobranca.resumo.qtdVencidas} guia(s) vencida(s) — regularize o quanto antes.
                  </p>
                )}
                <p className="text-center text-[11px] text-slate-500">
                  Ambiente seguro · Dados protegidos por criptografia
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/60 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <HelpCircle className="h-4 w-4 text-slate-500" /> Precisa de ajuda?
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900"
                >
                  <Phone className="h-4 w-4" /> WhatsApp (11) 2122-0202
                </a>
                <a
                  href="mailto:financeiro@cadbrasil.com"
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  <Mail className="h-4 w-4" /> financeiro@cadbrasil.com
                </a>
              </CardContent>
            </Card>
          </aside>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} CADBRASIL 360 · Sistema operacional para fornecedores do governo
        </footer>
      </main>
    </div>
  );
}

function LinkInvalido({ mensagem }: { mensagem?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="max-w-md border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Link inválido ou expirado</h1>
          <p className="text-sm text-slate-600">
            {mensagem ||
              "Este link de pagamento não existe, já foi quitado ou não está mais disponível."}
          </p>
          <p className="text-xs text-slate-500 pt-2">
            Entre em contato com a equipe CADBRASIL pelo WhatsApp (11) 2122-0202.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
