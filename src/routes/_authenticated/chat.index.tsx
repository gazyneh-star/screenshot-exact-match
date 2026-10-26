import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/elvyn/ChatView";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "New chat — Elvyn" },
      { name: "description", content: "Start a new conversation with Elvyn." },
      { property: "og:title", content: "New chat — Elvyn" },
      { property: "og:description", content: "Start a new conversation with Elvyn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ChatView />,
});
