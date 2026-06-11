import { createFileRoute } from "@tanstack/react-router";
import SicafAssistantChat from "@/lib/sicaf-assistant-chat";

export const Route = createFileRoute("/sicaf-assistant")({
  head: () => ({
    meta: [
      { title: "Assistente SICAF — CadBrasil" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SicafAssistantChat,
});
