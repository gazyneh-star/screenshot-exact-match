import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { dict, type Lang } from "./i18n";
import type { Attachment } from "./chat-schema";

export type Theme = "dark" | "light" | "system";
export type Msg = { id: string; role: "user" | "assistant"; content: string; provider?: string | null; attachments?: Attachment[]; image_path?: string | null; imageSrc?: string | undefined; imageFinal?: boolean; error?: string };
export type Conversation = { id: string; title: string; updatedAt: number };

type Store = {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (typeof dict)["en"];
  model: string;
  setModel: (m: string) => void;
  user: User | null;
  conversations: Conversation[];
  refresh: () => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>("ru");
  const [theme, setThemeS] = useState<Theme>("dark");
  const [model, setModel] = useState("auto");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const l = localStorage.getItem("elvyn.lang") as Lang | null;
    const th = localStorage.getItem("elvyn.theme") as Theme | null;
    if (l && l in dict) setLangS(l);
    if (th) setThemeS(th);
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return setConversations([]);
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) return console.error(error);
    setConversations((data ?? []).map((c) => ({ id: c.id, title: c.title, updatedAt: Date.parse(c.updated_at) })));
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  return (
    <Ctx.Provider
      value={{
        lang,
        setLang: (l) => { setLangS(l); localStorage.setItem("elvyn.lang", l); },
        theme,
        setTheme: (th) => { setThemeS(th); localStorage.setItem("elvyn.theme", th); },
        t: dict[lang],
        model,
        setModel,
        user,
        conversations,
        refresh,
        rename: async (id, title) => {
          setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
          const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
          if (error) console.error(error);
        },
        remove: async (id) => {
          setConversations((cs) => cs.filter((c) => c.id !== id));
          const { error } = await supabase.from("conversations").delete().eq("id", id);
          if (error) console.error(error);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
