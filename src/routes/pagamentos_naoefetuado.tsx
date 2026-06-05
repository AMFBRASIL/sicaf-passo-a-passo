import { createFileRoute } from "@tanstack/react-router";
import { PlanosPage } from "@/components/planos-page";

export const Route = createFileRoute("/pagamentos_naoefetuado")({
  head: () => ({
    meta: [
      { title: "Pagamentos — CADBRASIL" },
      { name: "description", content: "Escolha o plano ideal para proteger sua empresa e nunca perder uma licitação." },
    ],
  }),
  component: PlanosPage,
});
