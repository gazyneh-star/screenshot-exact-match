import { createFileRoute, Link } from "@tanstack/react-router";
import { useApp } from "@/lib/app-store";
import { ElvynLogo } from "@/components/elvyn/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elvyn — AI assistant" },
      { name: "description", content: "Elvyn is a premium AI assistant for chat, images, files and research." },
      { property: "og:title", content: "Elvyn — AI assistant" },
      { property: "og:description", content: "Chat, images, files and research in one calm assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, user } = useApp();
  return (
    <div className="canvas-glow flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <ElvynLogo className="h-20 w-20" />
      <h1 className="text-5xl font-semibold tracking-tight">Elvyn</h1>
      <p className="max-w-xs text-lg text-muted-foreground">{t.tagline}</p>
      <Link
        to={user ? "/chat" : "/auth"}
        className="mt-2 flex h-14 items-center rounded-full bg-brand px-8 text-lg font-semibold text-brand-foreground shadow-[0_0_30px_-6px_var(--glow)]"
      >
        {user ? t.openChat : t.signIn}
      </Link>
    </div>
  );
}
