import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/inicio2")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
