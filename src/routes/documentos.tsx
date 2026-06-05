import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText, Upload, CheckCircle2, Circle, ArrowLeft, Building2, MapPin, ShieldCheck, Loader2, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PageHeader, StatusBadge } from "@/components/page-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { empresasMock, statusLabel, NIVEIS_SICAF, type EmpresaData } from "@/routes/empresas";

type DocSearch = { cnpj?: string };

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos da empresa — CADBRASIL" },
      { name: "description", content: "Envie os documentos por nível do SICAF." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): DocSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: DocsPage,
});

type DocStatus = "ok" | "pendente";
interface DocItem {
  id: string;
  nome: string;
  descricao: string;
  status: DocStatus;
  validade?: string;
}

const docsPorNivel: Record<number, DocItem[]> = {
  1: [
    { id: "1-cnpj", nome: "Cartão CNPJ", descricao: "Comprovante de inscrição na Receita Federal.", status: "ok", validade: "12/03/2026" },
    { id: "1-end", nome: "Comprovante de endereço", descricao: "Conta de consumo recente da sede da empresa.", status: "ok", validade: "20/04/2026" },
  ],
  2: [
    { id: "2-contrato", nome: "Contrato Social consolidado", descricao: "Última versão registrada na Junta Comercial.", status: "ok", validade: "—" },
    { id: "2-rg", nome: "RG e CPF dos sócios", descricao: "Documentos pessoais dos representantes legais.", status: "ok" },
    { id: "2-procuracao", nome: "Procuração (se aplicável)", descricao: "Para representação por terceiros.", status: "pendente" },
  ],
  3: [
    { id: "3-receita", nome: "Certidão Conjunta Federal", descricao: "Receita Federal e PGFN — débitos tributários.", status: "ok", validade: "15/05/2026" },
    { id: "3-fgts", nome: "Certidão de Regularidade do FGTS", descricao: "Emitida pela Caixa Econômica Federal.", status: "ok", validade: "30/03/2026" },
    { id: "3-cndt", nome: "Certidão Negativa de Débitos Trabalhistas (CNDT)", descricao: "Emitida pelo TST.", status: "pendente" },
  ],
  4: [
    { id: "4-est", nome: "Certidão Estadual", descricao: "Negativa de débitos da Fazenda Estadual.", status: "pendente" },
    { id: "4-mun", nome: "Certidão Municipal", descricao: "Negativa de débitos da Fazenda Municipal.", status: "ok", validade: "10/06/2026" },
  ],
  5: [
    { id: "5-acervo", nome: "Atestado de capacidade técnica", descricao: "Comprovação de execução de serviços compatíveis.", status: "pendente" },
    { id: "5-registro", nome: "Registro em conselho de classe", descricao: "CREA, CRC, OAB ou similar conforme a atividade.", status: "ok", validade: "31/12/2026" },
  ],
  6: [
    { id: "6-balanco", nome: "Balanço Patrimonial e DRE", descricao: "Último exercício social exigível, assinado pelo contador.", status: "pendente" },
    { id: "6-cndfalencia", nome: "Certidão Negativa de Falência", descricao: "Distribuidor da sede da empresa.", status: "ok", validade: "08/04/2026" },
  ],
};

function DocsPage() {
  const { cnpj } = Route.useSearch();
  const empresa: EmpresaData | undefined = empresasMock.find((e) => e.cnpj === cnpj) ?? empresasMock[0];
  const [items, setItems] = useState<Record<string, DocItem>>(() => {
    const map: Record<string, DocItem> = {};
    Object.values(docsPorNivel).flat().forEach((d) => { map[d.id] = d; });
    return map;
  });
  const [uploadDoc, setUploadDoc] = useState<DocItem | null>(null);

  const allDocs = Object.values(items);
  const done = allDocs.filter((d) => d.status === "ok").length;
  const total = allDocs.length;
  const meta = statusLabel[empresa.sicaf];

  const handleUploaded = (doc: DocItem, validade?: string) => {
    setItems((p) => ({ ...p, [doc.id]: { ...p[doc.id], status: "ok", validade: validade || p[doc.id].validade } }));
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 gap-1">
        <Link to="/empresas"><ArrowLeft className="h-4 w-4" /> Voltar para Empresas</Link>
      </Button>

      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Documentos da empresa"
        subtitle={`${done} de ${total} documentos enviados — organizados por nível do SICAF`}
      />

      {/* Cabeçalho com dados da empresa */}
      <Card className="mt-6 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Empresa selecionada
              </div>
              <h2 className="mt-1 text-lg font-bold leading-tight truncate">{empresa.nome}</h2>
              <p className="text-sm text-muted-foreground">CNPJ {empresa.cnpj}</p>
            </div>
            <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
          </div>
        </div>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Inscrição Estadual" value={empresa.inscricaoEstadual} />
          <Info label="Inscrição Municipal" value={empresa.inscricaoMunicipal} />
          <Info label="Ramo" value={empresa.ramoAtividade} />
          <Info label="Endereço" value={`${empresa.endereco} — ${empresa.cidade}/${empresa.uf}`} icon={<MapPin className="h-3.5 w-3.5" />} />
          <Info label="Telefone" value={empresa.telefone} />
          <Info label="E-mail" value={empresa.email} />
        </CardContent>
      </Card>

      {/* Progresso geral */}
      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-medium">Progresso geral</p>
            <p className="text-sm text-muted-foreground">{Math.round((done / total) * 100)}%</p>
          </div>
          <Progress value={(done / total) * 100} className="h-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            Faltam {total - done} documentos para concluir os 6 níveis do SICAF.
          </p>
        </CardContent>
      </Card>

      {/* Checklist por nível */}
      <div className="mt-6 space-y-4">
        {NIVEIS_SICAF.map((nivel) => {
          const lista = docsPorNivel[nivel.num].map((d) => items[d.id]);
          const nivelDone = lista.filter((d) => d.status === "ok").length;
          const completo = nivelDone === lista.length;
          return (
            <Card key={nivel.num} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: nivel.color }}
                    >
                      {nivel.roman}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        Nível {nivel.roman} — {nivel.nome}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {nivelDone} de {lista.length} documentos enviados
                      </p>
                    </div>
                  </div>
                  {completo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success text-xs font-semibold px-2.5 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-foreground text-xs font-semibold px-2.5 py-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Pendente
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {lista.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {d.status === "ok" ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{d.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{d.descricao}</p>
                          {d.status === "ok" && d.validade && d.validade !== "—" && (
                            <p className="text-[11px] text-success mt-0.5">Válido até {d.validade}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={d.status === "ok" ? "outline" : "default"}
                        className="gap-1.5 shrink-0"
                        onClick={() => setUploadDoc(d)}
                      >
                        {d.status === "ok" ? <Upload className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {d.status === "ok" ? "Substituir" : "Enviar"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <UploadDocDialog
        doc={uploadDoc}
        empresa={empresa}
        onClose={() => setUploadDoc(null)}
        onUploaded={handleUploaded}
      />
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
    </div>
  );
}

function UploadDocDialog({
  doc, empresa, onClose, onUploaded,
}: {
  doc: DocItem | null;
  empresa: EmpresaData;
  onClose: () => void;
  onUploaded: (doc: DocItem, validade?: string) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [validade, setValidade] = useState("");
  const [estado, setEstado] = useState<"form" | "enviando" | "ok">("form");

  useEffect(() => {
    if (!doc) {
      setArquivo(null);
      setValidade("");
      setEstado("form");
    }
  }, [doc]);

  if (!doc) return null;
  const pode = arquivo && estado === "form";

  const enviar = () => {
    setEstado("enviando");
    setTimeout(() => {
      setEstado("ok");
      setTimeout(() => {
        onUploaded(doc, validade);
        onClose();
      }, 1100);
    }, 1500);
  };

  return (
    <Dialog open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">{doc.nome}</DialogTitle>
          <DialogDescription className="text-center">
            {empresa.nome} · CNPJ {empresa.cnpj}
          </DialogDescription>
        </DialogHeader>

        {estado === "form" && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground text-center">{doc.descricao}</p>
            <div className="space-y-2">
              <Label>Arquivo do documento</Label>
              <label
                htmlFor="doc-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-primary/5"
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">
                  {arquivo ? arquivo.name : "Clique para selecionar o arquivo"}
                </span>
                <span className="text-xs text-muted-foreground">PDF, JPG ou PNG · até 10 MB</span>
                <input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validade">Validade (opcional)</Label>
              <Input
                id="validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Avisaremos você 30 dias antes do vencimento.
              </p>
            </div>
          </div>
        )}

        {estado === "enviando" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Enviando documento…</p>
            <p className="text-xs text-muted-foreground">Validando arquivo e anexando à empresa</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold">Documento enviado!</p>
            <p className="text-center text-xs text-muted-foreground">
              {doc.nome} foi anexado à empresa.
            </p>
          </div>
        )}

        {estado === "form" && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={enviar} disabled={!pode} className="gap-2">
              <Upload className="h-4 w-4" />
              Enviar documento
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
