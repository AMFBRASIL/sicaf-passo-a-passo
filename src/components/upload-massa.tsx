import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, FileText, UploadCloud, X, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmpresaConhecida = { cnpj: string; nome: string };

type ResultadoArquivo = {
  id: string;
  arquivo: File;
  cnpjDetectado: string | null;
  empresa: EmpresaConhecida | null;
  status: "ok" | "revisar";
};

type Props = {
  empresas: EmpresaConhecida[];
  onConfirmar?: (resultados: ResultadoArquivo[]) => void;
};

const CNPJ_REGEX = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;

function normalizeCnpj(v: string) {
  return v.replace(/\D/g, "");
}

export function UploadMassa({ empresas, onConfirmar }: Props) {
  const [arquivos, setArquivos] = useState<ResultadoArquivo[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const mapaEmpresas = useMemo(() => {
    const m = new Map<string, EmpresaConhecida>();
    empresas.forEach((e) => m.set(normalizeCnpj(e.cnpj), e));
    return m;
  }, [empresas]);

  const processar = (lista: FileList | File[]) => {
    const novos: ResultadoArquivo[] = Array.from(lista).map((file, i) => {
      const match = file.name.match(CNPJ_REGEX);
      const cnpjDetectado = match ? match[1] : null;
      const empresa = cnpjDetectado ? mapaEmpresas.get(normalizeCnpj(cnpjDetectado)) ?? null : null;
      return {
        id: `${Date.now()}-${i}-${file.name}`,
        arquivo: file,
        cnpjDetectado,
        empresa,
        status: empresa ? "ok" : "revisar",
      };
    });
    setArquivos((prev) => [...prev, ...novos]);
  };

  const remover = (id: string) => setArquivos((p) => p.filter((a) => a.id !== id));
  const atribuir = (id: string, cnpj: string) => {
    const empresa = mapaEmpresas.get(normalizeCnpj(cnpj)) ?? null;
    setArquivos((p) =>
      p.map((a) =>
        a.id === id ? { ...a, empresa, cnpjDetectado: empresa ? cnpj : a.cnpjDetectado, status: empresa ? "ok" : "revisar" } : a,
      ),
    );
  };

  const okCount = arquivos.filter((a) => a.status === "ok").length;
  const revisarCount = arquivos.length - okCount;

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) processar(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition",
          dragOver && "border-primary bg-primary/5",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UploadCloud className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm font-semibold">Arraste vários PDFs aqui</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Identificamos cada empresa automaticamente pelo CNPJ no nome do arquivo.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
          <span>
            <ScanLine className="h-4 w-4" />
            Selecionar arquivos
          </span>
        </Button>
        <input
          type="file"
          multiple
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && processar(e.target.files)}
        />
      </label>

      {arquivos.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {okCount} identificados
              </span>
              {revisarCount > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-warning-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {revisarCount} para revisar
                </span>
              )}
            </div>
            <Button size="sm" disabled={okCount === 0} onClick={() => onConfirmar?.(arquivos)} className="h-8">
              Importar {okCount > 0 ? `${okCount} arquivos` : ""}
            </Button>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {arquivos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.arquivo.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.empresa ? (
                      <>
                        <span className="font-medium text-foreground">{a.empresa.nome}</span> · {a.empresa.cnpj}
                      </>
                    ) : (
                      <input
                        type="text"
                        placeholder="Digite o CNPJ da empresa"
                        onBlur={(e) => e.target.value && atribuir(a.id, e.target.value)}
                        className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs"
                      />
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    a.status === "ok" ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground",
                  )}
                >
                  {a.status === "ok" ? "Identificado" : "Revisar"}
                </span>
                <button
                  type="button"
                  onClick={() => remover(a.id)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label="Remover"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
