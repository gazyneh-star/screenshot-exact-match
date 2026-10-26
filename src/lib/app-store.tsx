import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type Lang } from "./i18n";

export type Theme = "dark" | "light" | "system";
export type Msg = { id: string; role: "user" | "assistant"; content: string };
export type Conversation = { id: string; title: string; updatedAt: number; messages: Msg[] };

type Store = {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (typeof dict)["en"];
  model: string;
  setModel: (m: string) => void;
  conversations: Conversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  send: (text: string) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>("ru");
  const [theme, setThemeS] = useState<Theme>("dark");
  const [model, setModel] = useState("auto");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // UI preferences only (not private data) are kept in the browser.
  useEffect(() => {
    const l = localStorage.getItem("elvyn.lang") as Lang | null;
    const th = localStorage.getItem("elvyn.theme") as Theme | null;
    if (l && l in dict) setLangS(l);
    if (th) setThemeS(th);
  }, []);

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

  const t = dict[lang];

  const send = (text: string) => {
    const user: Msg = { id: uid(), role: "user", content: text };
    const reply: Msg = { id: uid(), role: "assistant", content: t.notConnected };
    if (!activeId) {
      const c: Conversation = { id: uid(), title: text.slice(0, 48), updatedAt: Date.now(), messages: [user, reply] };
      setConversations((cs) => [c, ...cs]);
      setActiveId(c.id);
    } else {
      setConversations((cs) =>
        cs.map((c) => (c.id === activeId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, user, reply] } : c)),
      );
    }
  };

  return (
    <Ctx.Provider
      value={{
        lang,
        setLang: (l) => { setLangS(l); localStorage.setItem("elvyn.lang", l); },
        theme,
        setTheme: (th) => { setThemeS(th); localStorage.setItem("elvyn.theme", th); },
        t,
        model,
        setModel,
        conversations,
        activeId,
        setActiveId,
        send,
        rename: (id, title) => setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c))),
        remove: (id) => {
          setConversations((cs) => cs.filter((c) => c.id !== id));
          if (activeId === id) setActiveId(null);
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
