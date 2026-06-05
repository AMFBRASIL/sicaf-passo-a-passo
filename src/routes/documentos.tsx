import { createFileRoute } from "@tanstack/react-router";
import { FileText, Upload, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Meus Documentos — CADBRASIL" },
      { name: "description", content: "Checklist simples dos documentos da sua empresa." },
    ],
  }),
  component: DocsPage,
});

const docs = [
  { ok: true, nome: "Contrato Social" },
  { ok: true, nome: "Cartão CNPJ" },
  { ok: true, nome: "Comprovante de endereço" },
  { ok: true, nome: "RG e CPF do sócio" },
  { ok: true, nome: "Certidão Federal" },
  { ok: true, nome: "Certidão FGTS" },
  { ok: true, nome: "Certidão Municipal" },
  { ok: true, nome: "Balanço Patrimonial" },
  { ok: false, nome: "Certidão Estadual" },
  { ok: false, nome: "Certidão Trabalhista (CNDT)" },
];

function DocsPage() {
  const done = docs.filter((d) => d.ok).length;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Meus Documentos"
        subtitle={`${done} de ${docs.length} documentos enviados`}
        action={
          <Button size="lg" className="gap-2">
            <Upload className="h-4 w-4" />
            Enviar documento
          </Button>
        }
      />

      <Card className="mt-6">
        <CardContent className="p-5">
          <Progress value={(done / docs.length) * 100} className="h-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            Faltam apenas {docs.length - done} documentos para sua empresa estar 100% pronta.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Checklist de documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.nome} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {d.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                  <span className={d.ok ? "" : "font-medium"}>{d.nome}</span>
                </div>
                {!d.ok && (
                  <Button size="sm" variant="outline">
                    <Upload className="mr-1.5 h-4 w-4" />
                    Enviar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4 border-dashed">
        <CardContent className="flex items-center gap-3 p-4">
          <PlayCircle className="h-5 w-5 text-primary" />
          <p className="text-sm">
            <span className="font-medium">Não sabe onde achar um documento?</span>{" "}
            <span className="text-muted-foreground">Veja o vídeo "Como enviar documentos" (2 min).</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
