import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropostaComercialModal } from "@/components/proposta-comercial-modal";
import {
  fetchPropostasPendentes,
  formatMoedaProposta,
  labelPeriodicidade,
  type PropostaComercial,
} from "@/lib/propostas-api";
import { toast } from "sonner";

export const Route = createFileRoute("/propostas")({
  head: () => ({
    meta: [
      { title: "Propostas — CADBRASIL" },
      { name: "description", content: "Acompanhe suas propostas comerciais e finalize o pagamento." },
    ],
  }),
  component: PropostasPage,
});

function PropostasPage() {
  const [loading, setLoading] = useState(true);
  const [propostas, setPropostas] = useState<PropostaComercial[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const res = await fetchPropostasPendentes();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar propostas");
      setPropostas([]);
      return [] as PropostaComercial[];
    }
    const lista = res.propostas || [];
    setPropostas(lista);
    return lista;
  };

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    if (!loading && propostas.length > 0) {
      setModalOpen(true);
    }
  }, [loading, propostas.length]);

  return (
    <PageContainer>
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Propostas"
        subtitle="Veja suas propostas comerciais e escolha a forma de pagamento."
        action={
          propostas.length > 0 ? (
            <Button className="gap-2" onClick={() => setModalOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Abrir proposta
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando propostas...
        </div>
      ) : propostas.length === 0 ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-base font-semibold">Nenhuma proposta em aberto</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando uma proposta for gerada no cadastro, ela aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {propostas.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{p.razaoSocial || "Empresa"}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {p.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.protocoloProposta}</p>
                <p className="text-2xl font-bold tracking-tight">{formatMoedaProposta(p.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">{labelPeriodicidade(p.periodicidade)}</p>
                <Button className="w-full" onClick={() => setModalOpen(true)}>
                  Ver proposta
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PropostaComercialModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        propostas={propostas}
        onAtualizado={() => {
          void carregar().then((lista) => {
            if (!lista.length) setModalOpen(false);
          });
        }}
      />
    </PageContainer>
  );
}

