import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-store";
import { ElvynLogo } from "@/components/elvyn/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Elvyn" },
      { name: "description", content: "Sign in or create your Elvyn account." },
      { property: "og:title", content: "Sign in — Elvyn" },
      { property: "og:description", content: "Sign in or create your Elvyn account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/chat" });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/chat" } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: "/chat" });
      else toast.success(t.checkEmail);
    }
  };

  const input = "pill h-14 w-full px-5 text-[17px] outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring";
  return (
    <div className="canvas-glow flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
        <ElvynLogo className="mx-auto mb-2 h-16 w-16" />
        <h1 className="mb-4 text-center text-3xl font-semibold tracking-tight">{mode === "in" ? t.signIn : t.signUp}</h1>
        <input className={input} type="email" required autoComplete="email" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} className="mt-2 h-14 rounded-full bg-brand text-lg font-semibold text-brand-foreground shadow-[0_0_30px_-6px_var(--glow)] disabled:opacity-50">
          {mode === "in" ? t.signIn : t.signUp}
        </button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="py-2 text-muted-foreground hover:text-foreground">
          {mode === "in" ? t.noAccount : t.haveAccount}
        </button>
      </form>
    </div>
  );
}
