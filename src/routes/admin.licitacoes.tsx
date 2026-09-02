import { createFileRoute } from "@tanstack/react-router";
import { LicitacoesPage } from "@/routes/licitacoes";

export const Route = createFileRoute("/admin/licitacoes")({
  head: () => ({
    meta: [
      { title: "Licitações (Admin) — CADBRASIL" },
      {
        name: "description",
        content: "Visão administrativa da base de licitações PNCP para validação operacional.",
      },
    ],
  }),
  component: AdminLicitacoesPage,
});

function AdminLicitacoesPage() {
  return <LicitacoesPage adminMode />;
}
