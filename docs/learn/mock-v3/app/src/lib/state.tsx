import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStore, writeStore } from "./core";

/* ---------------- Sahayak pane (global, opens beside any page) ---------------- */

type AiCtx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void; width: number; setWidth: (w: number) => void };
const AiContext = createContext<AiCtx>({ open: false, setOpen: () => {}, toggle: () => {}, width: 380, setWidth: () => {} });

export function AiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(() => Number(readStore("pk3-ai-w")) || 384);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const set = useCallback((w: number) => {
    const c = Math.max(300, Math.min(560, w));
    setWidth(c);
    writeStore("pk3-ai-w", String(c));
  }, []);
  const v = useMemo(() => ({ open, setOpen, toggle, width, setWidth: set }), [open, toggle, width, set]);
  return <AiContext.Provider value={v}>{children}</AiContext.Provider>;
}
export const useAi = () => useContext(AiContext);

/* ---------------- sidebar collapse ---------------- */

type SideCtx = { mini: boolean; setMini: (v: boolean) => void };
const SideContext = createContext<SideCtx>({ mini: false, setMini: () => {} });
export function SideProvider({ children }: { children: ReactNode }) {
  const [mini, setMiniState] = useState(() => readStore("pk3-side") === "mini");
  const setMini = useCallback((v: boolean) => {
    setMiniState(v);
    writeStore("pk3-side", v ? "mini" : "full");
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setMiniState((m) => !m);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const v = useMemo(() => ({ mini, setMini }), [mini, setMini]);
  return <SideContext.Provider value={v}>{children}</SideContext.Provider>;
}
export const useSide = () => useContext(SideContext);

/* ---------------- admin roles and permissions ---------------- */

export type Role = "super" | "content" | "editor" | "reviewer" | "support" | "finance" | "moderator" | "analyst";
export type Access = "full" | "edit" | "view" | "own" | "none";

export const ROLES: { id: Role; name: [string, string, string]; people: number; desc: string }[] = [
  { id: "super", name: ["Super admin", "Super admin", "सुपर एडमिन"], people: 2, desc: "Everything, including staff, roles and system" },
  { id: "content", name: ["Content admin", "Content admin", "कंटेंट एडमिन"], people: 3, desc: "All content, publishing, factory, contests" },
  { id: "editor", name: ["Editor", "Editor", "संपादक"], people: 11, desc: "Writes and edits content; cannot publish" },
  { id: "reviewer", name: ["Reviewer", "Reviewer", "समीक्षक"], people: 6, desc: "Reviews and publishes after the checklist" },
  { id: "support", name: ["Support", "Support", "सहायता"], people: 5, desc: "Learners, tickets, refund requests" },
  { id: "finance", name: ["Finance", "Finance", "वित्त"], people: 2, desc: "Plans, coupons, refunds, invoices" },
  { id: "moderator", name: ["Moderator", "Moderator", "मॉडरेटर"], people: 4, desc: "Community flags, posts, bans" },
  { id: "analyst", name: ["Analyst", "Analyst", "विश्लेषक"], people: 3, desc: "Read-only numbers and reports" },
];

/** Module → access per role (from docs/learn/ADMIN-PANEL.md §1). */
export const MATRIX: Record<string, Record<Role, Access>> = {
  dashboard: { super: "full", content: "view", editor: "view", reviewer: "view", support: "view", finance: "view", moderator: "view", analyst: "view" },
  content: { super: "full", content: "full", editor: "edit", reviewer: "view", support: "view", finance: "none", moderator: "none", analyst: "view" },
  review: { super: "full", content: "full", editor: "own", reviewer: "full", support: "none", finance: "none", moderator: "none", analyst: "none" },
  factory: { super: "full", content: "full", editor: "view", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "view" },
  learners: { super: "full", content: "view", editor: "none", reviewer: "none", support: "full", finance: "view", moderator: "view", analyst: "view" },
  support: { super: "full", content: "full", editor: "own", reviewer: "full", support: "full", finance: "none", moderator: "full", analyst: "none" },
  community: { super: "full", content: "none", editor: "none", reviewer: "none", support: "view", finance: "none", moderator: "full", analyst: "none" },
  commerce: { super: "full", content: "none", editor: "none", reviewer: "none", support: "own", finance: "full", moderator: "none", analyst: "view" },
  contests: { super: "full", content: "full", editor: "own", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "view" },
  ai: { super: "full", content: "view", editor: "none", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "view" },
  analytics: { super: "full", content: "full", editor: "own", reviewer: "full", support: "none", finance: "full", moderator: "none", analyst: "full" },
  notify: { super: "full", content: "full", editor: "none", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "none" },
  system: { super: "full", content: "none", editor: "none", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "none" },
  security: { super: "full", content: "none", editor: "none", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "none" },
  approvals: { super: "full", content: "full", editor: "none", reviewer: "none", support: "none", finance: "full", moderator: "none", analyst: "none" },
  audit: { super: "full", content: "none", editor: "none", reviewer: "none", support: "none", finance: "none", moderator: "none", analyst: "view" },
};

type RoleCtx = { role: Role; setRole: (r: Role) => void; can: (mod: string, need?: "view" | "edit" | "full") => boolean; access: (mod: string) => Access };
const RoleContext = createContext<RoleCtx>({ role: "super", setRole: () => {}, can: () => true, access: () => "full" });

const RANK: Record<Access, number> = { none: 0, view: 1, own: 2, edit: 3, full: 4 };
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => (readStore("pk3-role") as Role) || "super");
  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    writeStore("pk3-role", r);
  }, []);
  const access = useCallback((mod: string) => MATRIX[mod]?.[role] ?? "full", [role]);
  const can = useCallback((mod: string, need: "view" | "edit" | "full" = "view") => RANK[access(mod)] >= RANK[need], [access]);
  const v = useMemo(() => ({ role, setRole, can, access }), [role, setRole, can, access]);
  return <RoleContext.Provider value={v}>{children}</RoleContext.Provider>;
}
export const useRole = () => useContext(RoleContext);
