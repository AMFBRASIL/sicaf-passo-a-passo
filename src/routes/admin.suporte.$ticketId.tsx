import { createFileRoute } from "@tanstack/react-router";
import { AdminTicketDetalhe } from "@/components/admin/admin-ticket-detalhe";

export const Route = createFileRoute("/admin/suporte/$ticketId")({
  component: AdminTicketDetalheRoute,
});

function AdminTicketDetalheRoute() {
  const { ticketId } = Route.useParams();
  return <AdminTicketDetalhe ticketId={ticketId} />;
}
