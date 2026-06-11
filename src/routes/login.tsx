import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redireciona /login → /auth (rota oficial de autenticação) */
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
