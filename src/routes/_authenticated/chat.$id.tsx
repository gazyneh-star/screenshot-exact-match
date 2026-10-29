import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/elvyn/ChatView";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  head: () => ({
    meta: [
      { title: "Chat — Elvyn" },
      { name: "description", content: "Your conversation with Elvyn." },
      { property: "og:title", content: "Chat — Elvyn" },
      { property: "og:description", content: "Your conversation with Elvyn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  return <ChatView id={id} />;
}
