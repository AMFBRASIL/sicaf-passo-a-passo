import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, Eye, Info, Loader2, RotateCcw, Send, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarCampanha,
  criarRotina,
  enviarEmailTeste,
  previewEmail,
  type FrequenciaRotina,
  type Segmento,
  type ServicoDetalhe,
} from "@/lib/admin-servicos-captacao-api";
import { FREQUENCIA_ROTINA, numero } from "./servicos-visual";

function proximaHoraLocal() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

const VARIAVEIS = [
  { key: "nome", label: "Primeiro nome" },
  { key: "empresa", label: "Empresa" },
  { key: "cnpj", label: "CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "UF" },
  { key: "servico", label: "Serviço" },
  { key: "preco", label: "Preço" },
  { key: "beneficios", label: "Lista de benefícios" },
];

export function EmailMassaPanel({
  servico,
  segmento,
  uf,
  cooldown,
  onCampanhaCriada,
  onRotinaCriada,
  onIrParaAba,
}: {
  servico: ServicoDetalhe;
  segmento: Segmento;
  uf: string;
  cooldown: number;
  onCampanhaCriada: (campanhaId: number) => void;
  onRotinaCriada: () => void;
  onIrParaAba: (aba: "whatsapp" | "exportar") => void;
}) {
  const navigate = useNavigate();
  const prospeccao = segmento.base === "fornecedores";
  const [assunto, setAssunto] = useState(segmento.email.assunto);
  const [corpo, setCorpo] = useState(segmento.email.corpo);
  const [cta, setCta] = useState(segmento.email.cta);
  const [editado, setEditado] = useState(false);
  const [limite, setLimite] = useState("");
  const [emailTeste, setEmailTeste] = useState("");
  const [rotinaNome, setRotinaNome] = useState("");
  const [frequencia, setFrequencia] = useState<FrequenciaRotina>("uma_vez");
  const [quando, setQuando] = useState(proximaHoraLocal);
  const [preview, setPreview] = useState<{ html: string; assunto: string; amostra: string } | null>(
    null,
  );
  const [carregando, setCarregando] = useState<"preview" | "teste" | "envio" | "rotina" | null>(
    null,
  );
  const [confirmar, setConfirmar] = useState(false);
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const variaveis = prospeccao ? VARIAVEIS.filter((v) => v.key !== "nome") : VARIAVEIS;

  const restaurar = () => {
    setAssunto(segmento.email.assunto);
    setCorpo(segmento.email.corpo);
    setCta(segmento.email.cta);
    setEditado(false);
  };

  const inserirVariavel = (key: string) => {
    const tag = `{{${key}}}`;
    const el = corpoRef.current;
    if (!el) {
      setCorpo((c) => `${c}${tag}`);
    } else {
      const ini = el.selectionStart ?? corpo.length;
      const fim = el.selectionEnd ?? corpo.length;
      const novo = `${corpo.slice(0, ini)}${tag}${corpo.slice(fim)}`;
      setCorpo(novo);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(ini + tag.length, ini + tag.length);
      });
    }
    setEditado(true);
  };

  const conteudo = { segmento: segmento.id, uf: uf || undefined, assunto, corpo, cta };
  const limiteNum = Math.max(0, parseInt(limite, 10) || 0);
  const destinatarios = limiteNum ? Math.min(limiteNum, segmento.total) : segmento.total;

  const abrirPreview = async () => {
    setCarregando("preview");
    const res = await previewEmail(servico.id, conteudo);
    setCarregando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPreview({
      html: res.html,
      assunto: res.assunto,
      amostra: `${res.amostra.empresa} · ${res.amostra.email}`,
    });
  };

  const testar = async () => {
    setCarregando("teste");
    const res = await enviarEmailTeste(servico.id, {
      ...conteudo,
      para: emailTeste.trim() || undefined,
    });
    setCarregando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Teste enviado para ${res.para}`);
  };

  const disparar = async () => {
    setConfirmar(false);
    setCarregando("envio");
    const res = await criarCampanha(servico.id, {
      ...conteudo,
      cooldownDias: cooldown || undefined,
      limite: limiteNum || undefined,
    });
    setCarregando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Campanha iniciada: ${numero(res.total)} e-mails na fila de envio`);
    setEditado(false);
    setLimite("");
    onCampanhaCriada(res.campanhaId);
  };

  const agendarRotina = async () => {
    const data = new Date(quando);
    if (!quando || Number.isNaN(data.getTime())) {
      toast.error("Escolha a data e a hora do primeiro envio");
      return;
    }
    setCarregando("rotina");
    const res = await criarRotina(servico.id, {
      ...conteudo,
      nome: rotinaNome.trim() || undefined,
      frequencia,
      primeiraExecucao: data.toISOString(),
      cooldownDias: cooldown || undefined,
      limite: limiteNum || undefined,
    });
    setCarregando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Rotina agendada (${FREQUENCIA_ROTINA[frequencia].toLowerCase()}) — primeiro envio em ${data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
      {
        action: {
          label: "Ver no Email Marketing",
          onClick: () =>
            void navigate({ to: "/admin/email-marketing", search: { aba: "servicos" } }),
        },
      },
    );
    setRotinaNome("");
    onRotinaCriada();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Mensagem</h3>
            <p className="text-xs text-muted-foreground">
              Modelo sugerido para o público “{segmento.nome}”. Edite à vontade.
            </p>
          </div>
          {editado && (
            <Button variant="ghost" size="sm" onClick={restaurar}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar modelo
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cap-assunto">Assunto</Label>
          <Input
            id="cap-assunto"
            value={assunto}
            maxLength={200}
            onChange={(e) => {
              setAssunto(e.target.value);
              setEditado(true);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cap-corpo">Texto do e-mail</Label>
          <Textarea
            id="cap-corpo"
            ref={corpoRef}
            value={corpo}
            rows={13}
            className="font-mono text-[13px] leading-relaxed"
            onChange={(e) => {
              setCorpo(e.target.value);
              setEditado(true);
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            Deixe uma linha em branco entre parágrafos. Linhas começando com “- ” viram lista com ✓.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {variaveis.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => inserirVariavel(v.key)}
                className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                title={`Inserir {{${v.key}}}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cap-cta">Texto do botão</Label>
          <Input
            id="cap-cta"
            value={cta}
            maxLength={60}
            onChange={(e) => {
              setCta(e.target.value);
              setEditado(true);
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            {prospeccao
              ? "O botão leva a empresa para o cadastro gratuito no portal (/auth)."
              : `O botão leva o cliente para ${servico.rota} no portal.`}{" "}
            O e-mail inclui também atalho para o WhatsApp e link de descadastro.
          </p>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Conferir antes de enviar</h3>
          <Button
            variant="outline"
            className="w-full"
            onClick={abrirPreview}
            disabled={!!carregando}
          >
            {carregando === "preview" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-1.5 h-4 w-4" />
            )}
            Pré-visualizar e-mail
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="cap-teste" className="text-xs">
              Enviar teste para
            </Label>
            <div className="flex gap-2">
              <Input
                id="cap-teste"
                type="email"
                placeholder="Seu e-mail de login"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                className="h-9 text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={testar}
                disabled={!!carregando}
              >
                {carregando === "teste" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>

        {prospeccao && !segmento.total && (
          <Card className="space-y-2 border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Info className="h-4 w-4" />
              Fornecedores ainda sem e-mail
            </p>
            <p className="text-xs leading-relaxed">
              As fontes públicas (Compras.gov.br e PNCP) não divulgam e-mail. Este público tem{" "}
              <strong>{numero(segmento.totalTelefone || 0)} empresas com telefone</strong>: aborde
              por WhatsApp ou suba o público em anúncios. Quando a base ganhar e-mails, o disparo
              libera aqui automaticamente.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onIrParaAba("whatsapp")}>
                Abordar por WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => onIrParaAba("exportar")}>
                Exportar para anúncios
              </Button>
            </div>
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Disparar agora</h3>
          <div className="space-y-1.5">
            <Label htmlFor="cap-limite" className="text-xs">
              Limitar quantidade (opcional)
            </Label>
            <Input
              id="cap-limite"
              type="number"
              min={1}
              placeholder={`Todos (${numero(segmento.total)})`}
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Comece com um lote menor para medir a resposta. Vale também para a rotina abaixo.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => setConfirmar(true)}
            disabled={!!carregando || !segmento.total}
          >
            {carregando === "envio" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Disparar para {numero(destinatarios)} {prospeccao ? "fornecedores" : "clientes"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {segmento.total
              ? "Abre o log com o andamento de cada e-mail."
              : "Nenhum e-mail válido neste público."}
          </p>
        </Card>

        <Card className="space-y-3 p-5">
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold">
              <CalendarPlus className="h-4 w-4" />
              Rotina no Email Marketing
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Deixe o processo agendado: na data escolhida o sistema monta o público atualizado e
              dispara este e-mail. Tudo fica visível em Admin → Email Marketing.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-rotina-nome" className="text-xs">
              Nome da rotina
            </Label>
            <Input
              id="cap-rotina-nome"
              value={rotinaNome}
              maxLength={150}
              placeholder={`${servico.nome} — ${segmento.nome}`}
              onChange={(e) => setRotinaNome(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Frequência</Label>
              <Select
                value={frequencia}
                onValueChange={(v) => setFrequencia(v as FrequenciaRotina)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQUENCIA_ROTINA) as FrequenciaRotina[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCIA_ROTINA[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-rotina-quando" className="text-xs">
                {frequencia === "uma_vez" ? "Enviar em" : "Primeiro envio"}
              </Label>
              <Input
                id="cap-rotina-quando"
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                className="h-9 px-2 text-xs"
              />
            </div>
          </div>
          {frequencia !== "uma_vez" && (
            <p className="text-[11px] text-muted-foreground">
              A cada execução entram só os novos do público: quem recebeu nos últimos{" "}
              {cooldown || 30} dias não recebe de novo.
            </p>
          )}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void agendarRotina()}
            disabled={!!carregando || !segmento.total}
          >
            {carregando === "rotina" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="mr-1.5 h-4 w-4" />
            )}
            Enviar para o Email Marketing
          </Button>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base">{preview?.assunto}</DialogTitle>
            <DialogDescription>Exemplo com os dados de {preview?.amostra}</DialogDescription>
          </DialogHeader>
          <iframe
            title="Pré-visualização do e-mail"
            srcDoc={preview?.html}
            sandbox=""
            className="h-[65vh] w-full rounded-md border bg-white"
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disparar campanha para {numero(destinatarios)}{" "}
              {prospeccao ? "fornecedores" : "clientes"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Público: {segmento.nome}
              {uf ? ` · UF ${uf}` : ""}
              {cooldown ? ` · sem repetir para quem recebeu nos últimos ${cooldown} dias` : ""}. Os
              e-mails saem em lotes pela fila; o log abre em seguida e você pode pausar ou cancelar
              a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void disparar()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
