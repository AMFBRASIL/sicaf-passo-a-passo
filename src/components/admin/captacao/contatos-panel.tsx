import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  MessageCircle,
  Phone,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchPublico,
  registrarContato,
  type ClientePublico,
  type ResultadoContato,
  type Segmento,
  type ServicoDetalhe,
} from "@/lib/admin-servicos-captacao-api";
import {
  RESULTADO_CONTATO,
  aplicarScript,
  dataHora,
  numero,
  primeiroNome,
} from "./servicos-visual";

const chave = (c: ClientePublico) => (c.clienteId ? `c${c.clienteId}` : `f${c.fornecedorId ?? ""}`);

export function ContatosPanel({
  servico,
  segmento,
  uf,
}: {
  servico: ServicoDetalhe;
  segmento: Segmento;
  uf: string;
}) {
  const prospeccao = segmento.base === "fornecedores";
  const rotulo = prospeccao ? "fornecedores" : "clientes";
  const [script, setScript] = useState(segmento.whatsapp || servico.whatsapp);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [ocultar, setOcultar] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<{
    total: number;
    porPagina: number;
    clientes: ClientePublico[];
  }>({
    total: 0,
    porPagina: 25,
    clientes: [],
  });
  const requisicao = useRef(0);

  const carregar = useCallback(async () => {
    const seq = ++requisicao.current;
    setLoading(true);
    const res = await fetchPublico(servico.id, {
      segmento: segmento.id,
      uf: uf || undefined,
      busca: buscaAplicada || undefined,
      pagina,
      ocultarContatados: ocultar,
    });
    if (seq !== requisicao.current) return;
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDados({ total: res.total, porPagina: res.porPagina, clientes: res.clientes });
  }, [servico.id, segmento.id, uf, buscaAplicada, pagina, ocultar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setPagina(1);
  }, [segmento.id, uf, buscaAplicada, ocultar]);

  const mensagem = (c: ClientePublico) =>
    aplicarScript(script, { nome: primeiroNome(c.responsavel), empresa: c.empresa });

  const marcar = async (
    c: ClientePublico,
    canal: "whatsapp" | "telefone" | "email",
    resultado: ResultadoContato,
  ) => {
    const res = await registrarContato(servico.id, {
      clienteId: c.clienteId,
      fornecedorId: c.fornecedorId,
      canal,
      resultado,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDados((d) => ({
      ...d,
      clientes: d.clientes.map((x) =>
        chave(x) === chave(c)
          ? {
              ...x,
              ultimoContato: {
                canal,
                resultado,
                observacao: null,
                em: new Date().toISOString(),
                por: "Você",
              },
            }
          : x,
      ),
    }));
  };

  const abrirWhatsApp = (c: ClientePublico) => {
    if (!c.whatsapp) {
      toast.error("Telefone inválido para WhatsApp");
      return;
    }
    window.open(
      `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensagem(c))}`,
      "_blank",
      "noopener",
    );
    void marcar(c, "whatsapp", "contatado");
  };

  const copiar = async (c: ClientePublico) => {
    await navigator.clipboard.writeText(mensagem(c));
    toast.success("Mensagem copiada");
  };

  const totalPaginas = Math.max(1, Math.ceil(dados.total / dados.porPagina));

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <Label htmlFor="cap-script" className="font-semibold">
          Roteiro da mensagem
        </Label>
        <Textarea
          id="cap-script"
          value={script}
          rows={3}
          onChange={(e) => setScript(e.target.value)}
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          {prospeccao
            ? "{{empresa}} é trocado pelo nome de cada fornecedor (a base pública não traz o nome do responsável)."
            : "{{nome}} e {{empresa}} são trocados pelos dados de cada cliente."}{" "}
          Ao clicar em WhatsApp, o contato fica registrado para a equipe não abordar a mesma empresa
          duas vezes.
        </p>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscaAplicada(busca.trim());
            }}
          >
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Empresa, responsável ou CNPJ"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-9">
              Buscar
            </Button>
          </form>
          <div className="flex items-center gap-2">
            <Switch id="cap-ocultar" checked={ocultar} onCheckedChange={setOcultar} />
            <Label htmlFor="cap-ocultar" className="text-xs">
              Ocultar contatados nos últimos 30 dias
            </Label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Empresa</th>
                <th className="px-4 py-2 font-medium">Responsável</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
                <th className="px-4 py-2 font-medium">Último contato</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && !dados.clientes.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : !dados.clientes.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma empresa com telefone neste público.
                  </td>
                </tr>
              ) : (
                dados.clientes.map((c) => (
                  <tr key={chave(c)} className="border-t align-top">
                    <td className="px-4 py-3">
                      <p className="max-w-[260px] truncate font-medium" title={c.empresa}>
                        {c.empresa}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.documento}
                        {c.cidade || c.uf ? ` · ${[c.cidade, c.uf].filter(Boolean).join("/")}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate">{c.responsavel || "—"}</p>
                      <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {c.email}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{c.telefone}</td>
                    <td className="px-4 py-3">
                      {c.ultimoContato ? (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={RESULTADO_CONTATO[c.ultimoContato.resultado]?.classe}
                          >
                            {RESULTADO_CONTATO[c.ultimoContato.resultado]?.label ??
                              c.ultimoContato.resultado}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground">
                            {dataHora(c.ultimoContato.em)}
                            {c.ultimoContato.por ? ` · ${c.ultimoContato.por}` : ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nunca</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => abrirWhatsApp(c)}
                          disabled={!c.whatsapp}
                        >
                          <MessageCircle className="mr-1 h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Copiar mensagem"
                          onClick={() => void copiar(c)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Ligar"
                          asChild
                        >
                          <a href={`tel:+${c.whatsapp || c.telefone.replace(/\D/g, "")}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Select
                          value=""
                          onValueChange={(v) => void marcar(c, "telefone", v as ResultadoContato)}
                        >
                          <SelectTrigger className="h-8 w-[118px] text-xs">
                            <SelectValue placeholder="Resultado" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(RESULTADO_CONTATO) as ResultadoContato[]).map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {RESULTADO_CONTATO[r].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {numero(dados.total)} {rotulo} com telefone
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagina <= 1 || loading}
              onClick={() => setPagina((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span>
              {pagina} / {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagina >= totalPaginas || loading}
              onClick={() => setPagina((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
