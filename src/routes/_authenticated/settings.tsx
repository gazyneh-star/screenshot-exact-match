import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProviderStatus } from "@/lib/admin.functions";
import { X, UserCircle, Shield, Cpu, BarChart3, ChevronRight, Moon, Sun, Monitor, Check } from "lucide-react";
import { toast } from "sonner";
import { useApp, type Theme } from "@/lib/app-store";
import { langNames, type Lang } from "@/lib/i18n";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Elvyn" },
      { name: "description", content: "Manage your Elvyn account, appearance and language." },
      { property: "og:title", content: "Settings — Elvyn" },
      { property: "og:description", content: "Account, appearance and language for Elvyn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="px-2 pb-2 text-[15px] font-medium text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-3xl bg-card">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, onClick, right }: { icon?: typeof X; label: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-auto rounded-none flex w-full items-center gap-4 px-5 py-4 text-start hover:bg-accent/50 [&+&]:border-t">
      {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate text-[17px] font-medium">{label}</span>
      {right ?? <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" />}
    </Button>
  );
}

function SettingsPage() {
  const { t, theme, setTheme, lang, setLang, user, refresh } = useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getProviderStatus);
  const status = useQuery({ queryKey: ["provider-status"], queryFn: () => fetchStatus() });
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const [panel, setPanel] = useState<"profile" | "privacy" | "usage" | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const accountData = useQuery({ queryKey: ["account-data", user?.id], enabled: Boolean(user), queryFn: async () => {
    if (!user) return { name: "", chats: 0, messages: 0 };
    const [profile, chats, messages] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).single(),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("messages").select("id", { count: "exact", head: true }),
    ]);
    return { name: profile.data?.display_name || "", chats: chats.count || 0, messages: messages.count || 0 };
  } });
  const saveName = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), updated_at: new Date().toISOString() }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success(t.saved); void accountData.refetch(); }
  };
  const exportChats = async () => {
    const [chats, messages] = await Promise.all([supabase.from("conversations").select("*"), supabase.from("messages").select("*")]);
    if (chats.error || messages.error) { toast.error(chats.error?.message || messages.error?.message); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ conversations: chats.data, messages: messages.data }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "elvyn-chats.json"; a.click(); URL.revokeObjectURL(url);
  };
  const clearChats = async () => {
    if (!user || !confirm(t.confirmDelete)) return;
    const { error } = await supabase.from("conversations").delete().eq("user_id", user.id);
    if (error) toast.error(error.message); else { await refresh(); void accountData.refetch(); toast.success(t.saved); }
  };
  const themes: [Theme, typeof Moon, string][] = [
    ["dark", Moon, t.dark],
    ["light", Sun, t.light],
    ["system", Monitor, t.system],
  ];
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-xl px-4 pb-12 pt-4">
        <header className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center">
          <Link to="/chat" aria-label={t.close} className="pill grid h-12 w-12 place-items-center hover:bg-accent">
            <X className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-center text-xl font-semibold">{t.settings}</h1>
        </header>

        <div className="mt-6 flex items-center gap-4 rounded-3xl bg-card px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-background font-semibold uppercase">{user?.email?.[0] ?? "?"}</div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{accountData.data?.name || user?.email?.split("@")[0]}</p>
            <p className="truncate text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Group title={t.appearance}>
          <div className="grid grid-cols-3 gap-2 p-2">
            {themes.map(([v, Icon, label]) => (
              <Button variant="ghost"
                key={v}
                onClick={() => setTheme(v)}
                className={cn("flex flex-col items-center gap-2 rounded-2xl py-4 text-[15px]", theme === v ? "bg-accent" : "hover:bg-accent/50")}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Button>
            ))}
          </div>
        </Group>

        <Group title={t.language}>
          {(Object.keys(langNames) as Lang[]).map((l) => (
            <Row key={l} label={langNames[l]} onClick={() => setLang(l)} right={lang === l ? <Check className="h-5 w-5" /> : <span />} />
          ))}
        </Group>

        <Group title={t.account}>
          <Row icon={UserCircle} label={t.profile} onClick={() => { setPanel("profile"); setName(accountData.data?.name || ""); }} />
          <Row icon={Shield} label={t.privacy} onClick={() => setPanel("privacy")} />
          <Row icon={BarChart3} label={t.usage} onClick={() => setPanel("usage")} />
          <Row icon={LogOut} label={t.signOut} onClick={signOut} right={<span />} />
        </Group>

        {panel && <Group title={t[panel]}>
          <div className="space-y-3 p-5">
            {panel === "profile" && <><label className="block" htmlFor="display-name">{t.displayName}</label><input id="display-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-lg border bg-background px-3" /><Button disabled={saving || !name.trim()} onClick={() => void saveName()}>{t.save}</Button></>}
            {panel === "privacy" && <><Button variant="outline" onClick={() => void exportChats()}>{t.exportData}</Button><Button variant="destructive" className="w-full" onClick={() => void clearChats()}>{t.clearChats}</Button></>}
            {panel === "usage" && <dl className="grid grid-cols-2 gap-3"><dt>{t.recent}</dt><dd>{accountData.data?.chats ?? 0}</dd><dt>{t.messages}</dt><dd>{accountData.data?.messages ?? 0}</dd></dl>}
          </div>
        </Group>}
        {status.data?.isAdmin && (
          <Group title={t.providersStatus}>
            <Button variant="outline" className="m-3 max-w-[90%] whitespace-normal h-auto" onClick={async () => {
              if (!confirm(t.resumeAI)) return;
              const { error } = await supabase.from("ai_access_state").delete().in("scope", ["gateway", "lovable", "image", "gemini", "groq", "sambanova", "cloudflare", "together", "deepseek", "openrouter", "huggingface", "pollinations"]);
              if (error) toast.error(error.message); else toast.success(t.saved);
            }}>{t.resumeAI}</Button>
            {status.data.providers.map((p) => (
              <Row key={p.id} icon={Cpu} label={p.id} right={<span className={p.configured ? "text-brand" : "text-muted-foreground"}>{p.configured ? t.connectedL : t.notConfigured}</span>} />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}
