import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Gavel,
  Search,
  MapPin,
  Calendar,
  Building2,
  Sparkles,
  Filter,
  Star,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/licitacoes")({
  head: () => ({
    meta: [
      { title: "Licitações — CADBRASIL" },
      {
        name: "description",
        content: "Encontre licitações compatíveis com sua empresa, com filtros simples.",
      },
    ],
  }),
  component: LicitacoesPage,
});

type Licitacao = {
  id: string;
  orgao: string;
  objeto: string;
  uf: string;
  modalidade: string;
  valor: string;
  abertura: string;
  prazo: string;
  match: number;
  destaque?: boolean;
};

const licitacoes: Licitacao[] = [
  {
    id: "PE-2025-001",
    orgao: "Prefeitura de Belo Horizonte / MG",
    objeto: "Fornecimento de materiais de escritório para secretarias municipais",
    uf: "MG",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 280.000",
    abertura: "12/06/2026",
    prazo: "Encerra em 6 dias",
    match: 96,
    destaque: true,
  },
  {
    id: "PE-2025-002",
    orgao: "Governo do Estado de São Paulo",
    objeto: "Aquisição de equipamentos de informática (notebooks e monitores)",
    uf: "SP",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 1.450.000",
    abertura: "15/06/2026",
    prazo: "Encerra em 9 dias",
    match: 88,
  },
  {
    id: "DI-2025-014",
    orgao: "Tribunal Regional Federal 1ª Região",
    objeto: "Serviço de manutenção predial preventiva e corretiva",
    uf: "DF",
    modalidade: "Dispensa Eletrônica",
    valor: "R$ 95.000",
    abertura: "10/06/2026",
    prazo: "Encerra em 4 dias",
    match: 72,
  },
  {
    id: "PE-2025-003",
    orgao: "Universidade Federal do Rio de Janeiro",
    objeto: "Material de laboratório e reagentes químicos",
    uf: "RJ",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 540.000",
    abertura: "18/06/2026",
    prazo: "Encerra em 12 dias",
    match: 64,
  },
  {
    id: "CC-2025-007",
    orgao: "Ministério da Saúde",
    objeto: "Concorrência para construção de UBS no interior do Nordeste",
    uf: "BA",
    modalidade: "Concorrência",
    valor: "R$ 8.200.000",
    abertura: "30/06/2026",
    prazo: "Encerra em 24 dias",
    match: 58,
  },
  {
    id: "PE-2025-004",
    orgao: "Prefeitura de Curitiba / PR",
    objeto: "Serviços de limpeza e conservação predial",
    uf: "PR",
    modalidade: "Pregão Eletrônico",
    valor: "R$ 420.000",
    abertura: "20/06/2026",
    prazo: "Encerra em 14 dias",
    match: 81,
  },
];

const ufs = ["Todas", "SP", "MG", "RJ", "DF", "BA", "PR"];
const modalidades = ["Todas", "Pregão Eletrônico", "Dispensa Eletrônica", "Concorrência"];

function matchTone(v: number) {
  if (v >= 85) return "bg-success/10 text-success border-success/20";
  if (v >= 70) return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-border";
}

function LicitacoesPage() {
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("Todas");
  const [mod, setMod] = useState("Todas");

  const filtradas = useMemo(() => {
    return licitacoes.filter((l) => {
      const matchQ =
        q.trim() === "" ||
        l.objeto.toLowerCase().includes(q.toLowerCase()) ||
        l.orgao.toLowerCase().includes(q.toLowerCase());
      const matchUf = uf === "Todas" || l.uf === uf;
      const matchMod = mod === "Todas" || l.modalidade === mod;
      return matchQ && matchUf && matchMod;
    });
  }, [q, uf, mod]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Gavel className="h-5 w-5" />}
        title="Licitações"
        subtitle="Oportunidades compatíveis com a sua empresa, atualizadas todos os dias."
      />

      {/* Resumo */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Compatíveis hoje
            </div>
            <p className="mt-1 text-2xl font-bold">{licitacoes.filter((l) => l.match >= 70).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5" /> Match alto (85%+)
            </div>
            <p className="mt-1 text-2xl font-bold">{licitacoes.filter((l) => l.match >= 85).length}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Encerram esta semana
            </div>
            <p className="mt-1 text-2xl font-bold">
              {licitacoes.filter((l) => /\b[1-7] dias/.test(l.prazo)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="O que você quer vender? Ex.: material de escritório"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="w-[120px]">
                <MapPin className="mr-1 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ufs.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mod} onValueChange={setMod}>
              <SelectTrigger className="w-[170px]">
                <Filter className="mr-1 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modalidades.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="mt-4 grid gap-3">
        {filtradas.map((l) => (
          <Card
            key={l.id}
            className={l.destaque ? "border-primary/40 ring-1 ring-primary/20" : ""}
          >
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {l.modalidade}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${matchTone(l.match)}`}
                    >
                      <Sparkles className="h-3 w-3" /> {l.match}% match
                    </span>
                    {l.destaque && (
                      <span className="text-[11px] font-medium text-primary">⭐ Recomendado para você</span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 font-semibold leading-snug">{l.objeto}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {l.orgao}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {l.uf}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Abertura {l.abertura}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Valor estimado</p>
                    <p className="text-base font-bold">{l.valor}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-warning-foreground">{l.prazo}</p>
                  </div>
                  <Button size="sm">Ver detalhes</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filtradas.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma licitação encontrada com esses filtros. Tente outra palavra-chave.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
