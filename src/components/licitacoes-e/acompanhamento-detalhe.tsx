import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileSearch,
  FileText,
  Gavel,
  Loader2,
  MessageCircle,
  MinusCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { buildWhatsAppSuporteUrl } from "@/lib/whatsapp-suporte";
import {
  RESULTADOS,
  SITUACOES_PORTAL,
  analisarEditalAcompanhamento,
  atualizarAcompanhamento,
  calcularAptidao,
  dataHoraFmt,
  removerAcompanhamento,
  solicitarApoioAcompanhamento,
  type Acompanhamento,
  type ChecklistItem,
  type EtapaAssistente,
  type LicitacoesEPainel,
} from "@/lib/licitacoes-e-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RespPainel = ({ ok: true } & LicitacoesEPainel) | { ok: false; error: string };

const ETAPAS: {
  id: EtapaAssistente;
  titulo: string;
  icon: typeof Search;
  orientacao: string[];
}[] = [
  {
    id: "localizar",
    titulo: "Localizar a licitação",
    icon: Search,
    orientacao: [
      "Confira o número da licitação no Licitações-e, o órgão e a data limite para propostas.",
      "Abra a página pública da licitação e baixe o edital e os anexos (termo de referência, modelos).",
    ],
  },
  {
    id: "edital",
    titulo: "Edital para análise",
    icon: FileSearch,
    orientacao: [
      "Envie o PDF do edital: a leitura com IA da CADBRASIL extrai objeto, prazos, exigências de habilitação e pontos de atenção.",
      "O resultado gera automaticamente o checklist de documentos desta licitação.",
    ],
  },
  {
    id: "aptidao",
    titulo: "Conferir se está apto",
    icon: ShieldCheck,
    orientacao: [
      "A empresa está apta quando todos os documentos do checklist estão em ordem e dentro da validade.",
      "Verifique também se o objeto é compatível com o CNAE / contrato social e se há exigência de atestado técnico.",
    ],
  },
  {
    id: "checklist",
    titulo: "Checklist de documentos",
    icon: FileText,
    orientacao: [
      "Marque cada item como OK quando o documento estiver pronto, ou como “não se aplica”.",
      "Certidões vencem: confira as datas antes da sessão e novamente na habilitação.",
    ],
  },
  {
    id: "proposta",
    titulo: "Preparar a proposta",
    icon: Sparkles,
    orientacao: [
      "Siga o modelo de proposta do edital: descrição do item, marca/modelo (se exigido), preço unitário e total.",
      "Inclua validade da proposta, prazo de entrega/execução e declarações pedidas.",
      "Defina antes o seu preço mínimo (até onde pode chegar nos lances) considerando custos, impostos e frete.",
    ],
  },
  {
    id: "envio",
    titulo: "Orientação para envio",
    icon: Send,
    orientacao: [
      "Acesse o Licitações-e com a chave e a senha do representante e localize a licitação pelo número.",
      "Cadastre a proposta e os anexos exigidos dentro do período de acolhimento — depois da data limite não é possível incluir.",
      "Confira o valor digitado e guarde o comprovante/protocolo de envio.",
    ],
  },
  {
    id: "disputa",
    titulo: "Preparar-se para a disputa",
    icon: Gavel,
    orientacao: [
      "Entre na Sala de Disputa antes do horário da sessão, com internet estável.",
      "Acompanhe as mensagens do pregoeiro no chat e respeite o intervalo mínimo entre lances, se houver.",
      "Não ultrapasse o preço mínimo definido na preparação da proposta.",
    ],
  },
  {
    id: "habilitacao",
    titulo: "Organizar a habilitação",
    icon: CheckCircle2,
    orientacao: [
      "Se a empresa ficar em primeiro lugar, o pregoeiro convoca o envio da proposta ajustada e dos documentos de habilitação no prazo do edital.",
      "Deixe os arquivos do checklist prontos em PDF para enviar sem atraso.",
    ],
  },
  {
    id: "resultado",
    titulo: "Acompanhar o resultado",
    icon: Trophy,
    orientacao: [
      "Acompanhe a fase de recursos, a adjudicação e a homologação no Licitações-e.",
      "Vencendo, fique atento à convocação para assinar o contrato ou a ata de registro de preços.",
    ],
  },
];

export function AcompanhamentoDetalhe({
  open,
  onOpenChange,
  acompanhamento,
  clienteId,
  empresaNome,
  onAplicar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  acompanhamento: Acompanhamento | null;
  clienteId: number;
  empresaNome: string;
  onAplicar: (res: RespPainel, sucesso?: string) => boolean;
}) {
  const a = acompanhamento;
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [novoItem, setNovoItem] = useState("");
  const [mensagemApoio, setMensagemApoio] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const aptidao = useMemo(() => calcularAptidao(a?.checklist || []), [a?.checklist]);
  const porCategoria = useMemo(() => {
    const mapa = new Map<string, ChecklistItem[]>();
    for (const item of a?.checklist || []) {
      mapa.set(item.categoria, [...(mapa.get(item.categoria) || []), item]);
    }
    return [...mapa.entries()];
  }, [a?.checklist]);

  if (!a) return null;

  const atualizar = async (campos: Parameters<typeof atualizarAcompanhamento>[2], msg?: string) => {
    setSalvando(true);
    onAplicar(await atualizarAcompanhamento(clienteId, a.id, campos), msg);
    setSalvando(false);
  };

  const alternarEtapa = (id: EtapaAssistente, feita: boolean) => {
    const etapas = feita ? [...new Set([...a.etapas, id])] : a.etapas.filter((e) => e !== id);
    void atualizar({ etapas });
  };

  const mudarItem = (itemId: string, status: ChecklistItem["status"]) => {
    void atualizar({
      checklist: a.checklist.map((i) => (i.id === itemId ? { ...i, status } : i)),
    });
  };

  const adicionarItem = () => {
    const texto = novoItem.trim();
    if (!texto) return;
    void atualizar({
      checklist: [
        ...a.checklist,
        { id: `manual-${Date.now()}`, categoria: "Outros", item: texto, status: "pendente" },
      ],
    });
    setNovoItem("");
  };

  const analisar = async (arquivo: File) => {
    setAnalisando(true);
    onAplicar(
      await analisarEditalAcompanhamento(clienteId, a.id, arquivo),
      "Edital analisado! O checklist foi montado com as exigências do edital.",
    );
    setAnalisando(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pedirApoio = async () => {
    const texto = mensagemApoio.trim();
    const ok = onAplicar(
      await solicitarApoioAcompanhamento(clienteId, a.id, texto || undefined),
      "Pedido de apoio registrado",
    );
    if (!ok) return;
    window.open(
      buildWhatsAppSuporteUrl(
        `Olá! Preciso de apoio no Assistente Licitações-e para a empresa ${empresaNome}. Licitação ${a.numeroLicitacao || ""} — ${a.orgao || ""}. ${texto}`.trim(),
      ),
      "_blank",
      "noopener,noreferrer",
    );
    setMensagemApoio("");
  };

  const remover = async () => {
    if (!window.confirm("Remover esta licitação do acompanhamento?")) return;
    if (onAplicar(await removerAcompanhamento(clienteId, a.id), "Licitação removida")) {
      onOpenChange(false);
    }
  };

  const idxSituacao = SITUACOES_PORTAL.findIndex((s) => s.id === a.situacaoPortal);
  const concluidas = ETAPAS.filter((e) => a.etapas.includes(e.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              Licitações-e {a.numeroLicitacao ? `nº ${a.numeroLicitacao}` : ""}
            </Badge>
            {a.modalidade && <Badge variant="secondary">{a.modalidade}</Badge>}
            {a.uf && <Badge variant="secondary">{a.uf}</Badge>}
          </div>
          <DialogTitle className="mt-1 text-lg leading-snug">
            {a.orgao || "Órgão não informado"}
          </DialogTitle>
          <DialogDescription className="line-clamp-3">{a.objeto || "—"}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> Disputa / limite de propostas:{" "}
              <strong className="text-foreground">{dataHoraFmt(a.dataDisputa)}</strong>
            </span>
            {a.link && (
              <Button asChild size="sm" variant="outline" className="h-7 gap-1.5">
                <a href={a.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir no Licitações-e
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Situação no Licitações-e
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {SITUACOES_PORTAL.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={salvando}
                  title={s.descricao}
                  onClick={() => void atualizar({ situacaoPortal: s.id })}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition",
                    i < idxSituacao && "border-success/30 bg-success/10 text-success",
                    i === idxSituacao && "border-primary bg-primary text-primary-foreground shadow",
                    i > idxSituacao && "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {SITUACOES_PORTAL[idxSituacao]?.descricao}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div
              className={cn(
                "rounded-xl border p-4",
                aptidao.apto ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Aptidão para participar</p>
                <Badge
                  className={cn(
                    "text-white",
                    aptidao.apto ? "bg-success hover:bg-success" : "bg-warning hover:bg-warning",
                  )}
                >
                  {aptidao.apto ? "Apta" : `${aptidao.pendentes} pendência(s)`}
                </Badge>
              </div>
              <Progress value={aptidao.pct} className="mt-3 h-2" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {aptidao.ok} de {aptidao.total} documentos em ordem
                {a.analiseEm ? " · checklist gerado pelo edital" : " · checklist padrão"}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Etapas do assistente</p>
                <span className="text-xs font-semibold text-primary">
                  {concluidas}/{ETAPAS.length}
                </span>
              </div>
              <Progress value={(concluidas / ETAPAS.length) * 100} className="mt-3 h-2" />
              {a.resultado && (
                <p className="mt-1.5 text-xs font-medium">
                  Resultado: {RESULTADOS.find((r) => r.id === a.resultado)?.label}
                </p>
              )}
            </div>
          </section>

          {a.observacaoCadbrasil && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Mensagem da equipe CADBRASIL</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {a.observacaoCadbrasil}
                </p>
              </div>
            </div>
          )}

          <Accordion type="single" collapsible defaultValue={proximaEtapa(a)}>
            {ETAPAS.map((etapa, i) => {
              const feita = a.etapas.includes(etapa.id);
              const Icon = etapa.icon;
              return (
                <AccordionItem key={etapa.id} value={etapa.id}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <span className="flex items-center gap-3 text-left">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          feita ? "bg-success text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {feita ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{etapa.titulo}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pl-10">
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {etapa.orientacao.map((o) => (
                        <li key={o} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                          {o}
                        </li>
                      ))}
                    </ul>

                    {etapa.id === "edital" && (
                      <EditalBloco
                        a={a}
                        analisando={analisando}
                        inputRef={inputRef}
                        onArquivo={(f) => void analisar(f)}
                      />
                    )}

                    {etapa.id === "aptidao" && !aptidao.apto && (
                      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                        <p className="mb-1 font-semibold">Ainda falta:</p>
                        <ul className="list-inside list-disc text-muted-foreground">
                          {a.checklist
                            .filter((c) => c.status === "pendente")
                            .slice(0, 8)
                            .map((c) => (
                              <li key={c.id}>{c.item}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {etapa.id === "checklist" && (
                      <div className="space-y-4">
                        {porCategoria.map(([categoria, itens]) => (
                          <div key={categoria}>
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {categoria}
                            </p>
                            <ul className="space-y-1.5">
                              {itens.map((item) => (
                                <ChecklistLinha
                                  key={item.id}
                                  item={item}
                                  disabled={salvando}
                                  onChange={(s) => mudarItem(item.id, s)}
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            value={novoItem}
                            onChange={(e) => setNovoItem(e.target.value)}
                            placeholder="Adicionar item ao checklist"
                            className="h-9"
                            onKeyDown={(e) => e.key === "Enter" && adicionarItem()}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 gap-1"
                            onClick={adicionarItem}
                          >
                            <Plus className="h-4 w-4" /> Adicionar
                          </Button>
                        </div>
                      </div>
                    )}

                    {etapa.id === "resultado" && (
                      <div className="flex flex-wrap gap-2">
                        {RESULTADOS.map((r) => (
                          <Button
                            key={r.id}
                            size="sm"
                            variant={a.resultado === r.id ? "default" : "outline"}
                            disabled={salvando}
                            onClick={() =>
                              void atualizar({
                                resultado: a.resultado === r.id ? null : r.id,
                                ...(a.resultado === r.id
                                  ? {}
                                  : { situacaoPortal: "concluida" as const }),
                              })
                            }
                          >
                            {r.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={feita}
                        disabled={salvando}
                        onCheckedChange={(v) => alternarEtapa(etapa.id, v === true)}
                      />
                      Etapa concluída
                    </label>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <section className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Precisa de ajuda com esta licitação?</p>
            <p className="text-xs text-muted-foreground">
              A equipe CADBRASIL pode revisar o edital, a proposta ou os documentos de habilitação.
              {a.apoioSolicitadoEm ? ` Último pedido em ${dataHoraFmt(a.apoioSolicitadoEm)}.` : ""}
            </p>
            <Textarea
              value={mensagemApoio}
              onChange={(e) => setMensagemApoio(e.target.value)}
              placeholder="Conte em que podemos ajudar (opcional)"
              className="min-h-[60px] resize-none bg-background"
              maxLength={2000}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button className="gap-1.5" onClick={() => void pedirApoio()}>
                <MessageCircle className="h-4 w-4" /> Pedir apoio da CADBRASIL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-danger"
                onClick={() => void remover()}
              >
                <Trash2 className="h-4 w-4" /> Remover do acompanhamento
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function proximaEtapa(a: Acompanhamento) {
  return ETAPAS.find((e) => !a.etapas.includes(e.id))?.id;
}

function EditalBloco({
  a,
  analisando,
  inputRef,
  onArquivo,
}: {
  a: Acompanhamento;
  analisando: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onArquivo: (f: File) => void;
}) {
  const an = a.analise;
  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onArquivo(f);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={analisando}
          onClick={() => inputRef.current?.click()}
        >
          {analisando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {an ? "Analisar outro edital" : "Enviar edital (PDF) para análise"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Usa 1 crédito de IA (sem custo para quem assina o PNCP Inteligente). A leitura leva cerca
          de 1 minuto.
        </span>
      </div>
      {a.editalUrl && (
        <a
          href={a.editalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <FileText className="h-3.5 w-3.5" /> {a.editalNome || "Edital enviado"}
        </a>
      )}
      {an && (
        <div className="space-y-3 rounded-lg border bg-background p-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Valor estimado" valor={an.valorEstimado} />
            <Info label="Sessão" valor={an.dataSessao} />
            <Info label="Critério de julgamento" valor={an.criterioJulgamento} />
            <Info
              label="Exclusiva ME/EPP"
              valor={an.exclusivaME == null ? null : an.exclusivaME ? "Sim" : "Não"}
            />
          </div>
          {!!an.pontosAtencao?.length && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Pontos de atenção
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                {an.pontosAtencao.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {!!an.cronograma?.length && (
            <div>
              <p className="mb-1 text-xs font-semibold">Cronograma</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {an.cronograma.slice(0, 8).map((c, i) => (
                  <li key={`${c.evento}-${i}`}>
                    <strong className="text-foreground">{c.data || "—"}</strong> · {c.evento}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{valor || "—"}</p>
    </div>
  );
}

function ChecklistLinha({
  item,
  disabled,
  onChange,
}: {
  item: ChecklistItem;
  disabled: boolean;
  onChange: (s: ChecklistItem["status"]) => void;
}) {
  const opcoes: { id: ChecklistItem["status"]; label: string; icon: typeof Circle }[] = [
    { id: "ok", label: "OK", icon: CheckCircle2 },
    { id: "pendente", label: "Pendente", icon: Circle },
    { id: "nao_aplica", label: "Não se aplica", icon: MinusCircle },
  ];
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
        item.status === "ok" && "border-success/30 bg-success/5",
        item.status === "nao_aplica" && "opacity-60",
      )}
    >
      <span className="text-sm">{item.item}</span>
      <div className="flex shrink-0 gap-1">
        {opcoes.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            size="sm"
            variant={item.status === id ? "default" : "ghost"}
            className={cn(
              "h-7 gap-1 px-2 text-[11px]",
              item.status === id && id === "ok" && "bg-success hover:bg-success",
            )}
            disabled={disabled}
            onClick={() => onChange(id)}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </Button>
        ))}
      </div>
    </li>
  );
}
