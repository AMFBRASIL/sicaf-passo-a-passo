import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  MapPin,
  User,
  Mail,
  Phone,
  FileText,
  Hash,
  Calendar,
  Briefcase,
} from "lucide-react";
import type { ClienteDetalheCompleto } from "@/lib/admin-clientes-api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: ClienteDetalheCompleto | null;
  loading?: boolean;
};

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value?.trim() || "—"}</p>
      </div>
    </div>
  );
}

function formatCep(cep?: string | null) {
  const d = String(cep || "").replace(/\D/g, "");
  if (d.length !== 8) return cep || "—";
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatDoc(doc?: string | null) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return doc || "—";
}

export function ClienteDadosDetalheModal({ open, onOpenChange, dados, loading }: Props) {
  const cidadeUf = [dados?.cidade, dados?.estado].filter(Boolean).join(" / ") || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0">
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-6 py-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-400/20 blur-2xl" />
          <DialogHeader className="relative space-y-1 text-left">
            <DialogTitle className="text-lg text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-300" />
              Detalhes do cliente
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {dados?.razao_social || "Carregando cadastro completo…"}
            </DialogDescription>
            {dados?.documento && (
              <div className="pt-2 flex flex-wrap gap-2">
                <Badge className="bg-white/10 text-white hover:bg-white/15 border-0 font-mono text-[11px]">
                  {formatDoc(dados.documento)}
                </Badge>
                {dados.status && (
                  <Badge className="bg-teal-500/20 text-teal-100 hover:bg-teal-500/30 border-0 text-[11px]">
                    {dados.status}
                  </Badge>
                )}
              </div>
            )}
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          {loading && !dados ? (
            <p className="text-sm text-muted-foreground">Carregando dados…</p>
          ) : (
            <>
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Empresa
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Row icon={Building2} label="Razão social" value={dados?.razao_social} />
                  <Row icon={Briefcase} label="Nome fantasia" value={dados?.nome_fantasia} />
                  <Row icon={Hash} label="CNPJ / CPF" value={formatDoc(dados?.documento)} />
                  <Row icon={FileText} label="Porte" value={dados?.porte} />
                  <Row icon={Briefcase} label="Ramo" value={dados?.ramo_atividade} />
                  <Row
                    icon={Calendar}
                    label="Desde"
                    value={
                      dados?.created_at
                        ? new Date(dados.created_at).toLocaleDateString("pt-BR")
                        : null
                    }
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Endereço
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Row icon={MapPin} label="Logradouro / endereço" value={dados?.endereco} />
                  </div>
                  <Row icon={MapPin} label="Cidade / UF" value={cidadeUf} />
                  <Row icon={Hash} label="CEP" value={formatCep(dados?.cep)} />
                </div>
              </section>

              <Separator />

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Contatos
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Row icon={Mail} label="E-mail principal" value={dados?.email} />
                  <Row icon={Mail} label="E-mail financeiro" value={dados?.email_financeiro} />
                  <Row icon={Mail} label="E-mail adicional" value={dados?.email_adicional} />
                  <Row icon={Phone} label="Telefone" value={dados?.telefone} />
                  <Row icon={Phone} label="Celular" value={dados?.celular} />
                </div>
              </section>

              <Separator />

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Responsável
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Row icon={User} label="Nome" value={dados?.responsavel_nome} />
                  <Row icon={Hash} label="CPF" value={formatDoc(dados?.responsavel_cpf)} />
                  <Row icon={Mail} label="E-mail" value={dados?.responsavel_email} />
                  <Row icon={Phone} label="Telefone" value={dados?.responsavel_telefone} />
                </div>
              </section>

              {dados?.observacoes ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Observações
                    </h4>
                    <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm whitespace-pre-wrap">
                      {dados.observacoes}
                    </p>
                  </section>
                </>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
