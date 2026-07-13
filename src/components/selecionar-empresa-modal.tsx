import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchEmpresas } from "@/lib/empresas-api";
import {
  formatSicafValidade,
  statusLabel,
  type EmpresaData,
} from "@/lib/empresas-shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaAtualCnpj?: string | null;
  onSelect: (empresa: EmpresaData) => void;
  titulo?: string;
  descricao?: string;
};

export function SelecionarEmpresaModal({
  open,
  onOpenChange,
  empresaAtualCnpj,
  onSelect,
  titulo = "Selecionar empresa",
  descricao = "Escolha qual empresa você deseja visualizar no SICAF.",
}: Props) {
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchEmpresas();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar empresas");
      setEmpresas([]);
      return;
    }
    setEmpresas(res.empresas);
  }, []);

  useEffect(() => {
    if (!open) return;
    setBusca("");
    void carregar();
  }, [open, carregar]);

  useEffect(() => {
    if (!open) return;
    const atual = empresaAtualCnpj?.replace(/\D/g, "") ?? "";
    if (!atual) {
      setSelecionada(null);
      return;
    }
    const match = empresas.find((e) => e.cnpj.replace(/\D/g, "") === atual);
    setSelecionada(match?.cnpj ?? null);
  }, [open, empresaAtualCnpj, empresas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        e.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
    );
  }, [empresas, busca]);

  const confirmar = (empresa: EmpresaData) => {
    onSelect(empresa);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="shrink-0 border-b px-5 py-5 sm:px-6">
          <DialogTitle className="text-xl font-bold">{titulo}</DialogTitle>
          <DialogDescription className="mt-1 text-sm">{descricao}</DialogDescription>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF ou CNPJ..."
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 max-h-[min(62vh,640px)]">
          <div className="p-5 sm:p-6">
            {loading && empresas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Carregando empresas...</p>
              </div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">
                  {empresas.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhuma empresa encontrada"}
                </p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {empresas.length === 0
                    ? "Cadastre uma empresa para começar a atualizar o SICAF."
                    : "Ajuste a busca acima."}
                </p>
                {empresas.length === 0 && (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to="/empresas">
                      <Plus className="h-4 w-4" />
                      Cadastrar empresa
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtradas.map((empresa) => (
                  <EmpresaSelectCard
                    key={empresa.clienteId ?? empresa.cnpj}
                    empresa={empresa}
                    selected={selecionada === empresa.cnpj}
                    onSelect={() => {
                      setSelecionada(empresa.cnpj);
                      confirmar(empresa);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            {empresas.length} empresa{empresas.length !== 1 ? "s" : ""} cadastrada
            {empresas.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/empresas">
                <Plus className="h-3.5 w-3.5" />
                Nova empresa
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmpresaSelectCard({
  empresa,
  selected,
  onSelect,
}: {
  empresa: EmpresaData;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = statusLabel[empresa.sicaf];
  const toneMap = {
    ok: "border-success/40 bg-success/5",
    warn: "border-warning/40 bg-warning/5",
    danger: "border-danger/40 bg-danger/5",
    idle: "border-border bg-card",
  } as const;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-xl border-2 p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      )}

      <div className="flex items-start gap-3 pr-8">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{empresa.nome}</p>
          <p className="mt-0.5 truncate text-[11px] font-mono text-muted-foreground">
            {empresa.cnpj.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"} {empresa.cnpj}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-semibold",
            meta.status === "ok" && "border-success/30 bg-success/10 text-success",
            meta.status === "warn" && "border-warning/30 bg-warning/10 text-warning-foreground",
            meta.status === "danger" && "border-danger/30 bg-danger/10 text-danger",
            meta.status === "idle" && "text-muted-foreground",
          )}
        >
          {meta.label}
        </Badge>
        {empresa.manutencaoAtiva && (
          <Badge variant="secondary" className="text-[10px]">
            Manutenção ativa
          </Badge>
        )}
      </div>

      <div
        className={cn(
          "mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
          toneMap[meta.status],
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="text-muted-foreground">{formatSicafValidade(empresa)}</span>
      </div>
    </button>
  );
}
