import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@parikshaa/brand/ui";
import { ClipboardList, CornerDownLeft, History, LayoutGrid, Search, UserRound, Zap } from "lucide-react";
import type { CandidateHit, ConsoleClient, ExamSummary } from "../api.ts";
import { ATTEMPT_WORDS } from "./kit.tsx";

/**
 * Ctrl+K (⌘K on a Mac): find an exam, a candidate across every exam, or a
 * page, and go there without the mouse. Candidates are searched on the
 * server, by roll number, name or email, from two characters.
 */

export interface PageLink {
  readonly label: string;
  readonly go: () => void;
}

type Item =
  | { readonly kind: "exam"; readonly id: string; readonly exam: ExamSummary; readonly recent?: boolean }
  | { readonly kind: "candidate"; readonly id: string; readonly hit: CandidateHit; readonly recent?: boolean }
  | { readonly kind: "action"; readonly id: string; readonly page: PageLink }
  | { readonly kind: "page"; readonly id: string; readonly page: PageLink };

/** What was opened from here lately, on this device: offered first when nothing is typed. */
const RECENT_KEY = "parikshaa.console.recent";
type Recent = { readonly kind: "exam"; readonly examId: string } | { readonly kind: "candidate"; readonly hit: CandidateHit };
const recents = {
  read: (): readonly Recent[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
      return Array.isArray(parsed) ? (parsed as Recent[]) : [];
    } catch {
      return [];
    }
  },
  add: (item: Recent): void => {
    try {
      const key = (r: Recent) => (r.kind === "exam" ? `exam:${r.examId}` : `cand:${r.hit.invitationId}`);
      const next = [item, ...recents.read().filter((r) => key(r) !== key(item))].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Not remembered.
    }
  },
};

/** Opens on Ctrl+K or ⌘K, wherever focus is. */
export function useCommandKey(onOpen: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}

export function CommandPalette({
  client,
  exams,
  pages,
  actions = [],
  canSearchCandidates,
  onExam,
  onCandidate,
  onClose,
}: {
  client: ConsoleClient;
  exams: readonly ExamSummary[];
  pages: readonly PageLink[];
  /** Things to do, offered beside the pages: "New exam", "Invite candidates". */
  actions?: readonly PageLink[];
  canSearchCandidates: boolean;
  onExam: (examId: string) => void;
  onCandidate: (hit: CandidateHit) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  // Ask the server once typing pauses, not on every key.
  useEffect(() => {
    const wait = window.setTimeout(() => setTyped(query.trim()), 180);
    return () => window.clearTimeout(wait);
  }, [query]);

  const candidates = useQuery({
    queryKey: ["candidate-search", typed],
    queryFn: () => client.searchCandidates(typed),
    enabled: canSearchCandidates && typed.length >= 2,
    staleTime: 30_000,
  });

  const needle = query.trim().toLowerCase();
  const [recent] = useState(recents.read);
  const items = useMemo<readonly Item[]>(() => {
    const recentItems: Item[] =
      needle !== ""
        ? []
        : recent.flatMap((r): Item[] => {
            if (r.kind === "candidate") return [{ kind: "candidate", id: `recent-cand:${r.hit.invitationId}`, hit: r.hit, recent: true }];
            const exam = exams.find((e) => e.id === r.examId);
            return exam === undefined ? [] : [{ kind: "exam", id: `recent-exam:${exam.id}`, exam, recent: true }];
          });
    const actionItems: Item[] = actions
      .filter((a) => needle === "" || a.label.toLowerCase().includes(needle))
      .map((page) => ({ kind: "action", id: `action:${page.label}`, page }));
    const examItems: Item[] = exams
      .filter((e) => needle === "" || e.title.toLowerCase().includes(needle))
      .slice(0, needle === "" ? 5 : 8)
      .map((exam) => ({ kind: "exam", id: `exam:${exam.id}`, exam }));
    const candidateItems: Item[] =
      needle.length >= 2 ? (candidates.data ?? []).map((hit) => ({ kind: "candidate", id: `cand:${hit.invitationId}`, hit })) : [];
    const pageItems: Item[] = pages
      .filter((p) => needle === "" || p.label.toLowerCase().includes(needle))
      .map((page) => ({ kind: "page", id: `page:${page.label}`, page }));
    return [...recentItems, ...actionItems, ...examItems, ...candidateItems, ...pageItems];
  }, [exams, candidates.data, pages, actions, recent, needle]);

  useEffect(() => setActive(0), [needle]);
  const choose = (item: Item | undefined) => {
    if (item === undefined) return;
    onClose();
    if (item.kind === "exam") {
      recents.add({ kind: "exam", examId: item.exam.id });
      onExam(item.exam.id);
    } else if (item.kind === "candidate") {
      recents.add({ kind: "candidate", hit: item.hit });
      onCandidate(item.hit);
    } else item.page.go();
  };

  const group = (kind: Item["kind"] | "recent", title: string) => {
    const shown = items.filter((i) => (kind === "recent" ? "recent" in i && i.recent === true : i.kind === kind && !("recent" in i && i.recent === true)));
    if (shown.length === 0) return null;
    return (
      <li role="presentation">
        <p className="palette-group" id={`palette-${kind}`}>
          {title}
        </p>
        <ul role="group" aria-labelledby={`palette-${kind}`}>
          {shown.map((item) => {
            const index = items.indexOf(item);
            return (
              <li
                key={item.id}
                id={`palette-item-${index}`}
                role="option"
                aria-selected={index === active}
                className={`palette-item${index === active ? " active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
              >
                {item.kind === "exam" ? (
                  <>
                    {"recent" in item && item.recent === true ? <History aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
                    <span className="palette-main">{item.exam.title}</span>
                    <span className="palette-meta">
                      {item.exam.questionCount} questions
                      {item.exam.attempts === undefined ? "" : ` · ${item.exam.attempts.inProgress} in progress · ${item.exam.attempts.submitted} to grade`}
                    </span>
                  </>
                ) : item.kind === "candidate" ? (
                  <>
                    {"recent" in item && item.recent === true ? <History aria-hidden="true" /> : <UserRound aria-hidden="true" />}
                    <span className="palette-main">
                      {item.hit.name || item.hit.candidateRef} <span className="mono notice">{item.hit.candidateRef}</span>
                    </span>
                    <span className="palette-meta">
                      {item.hit.examTitle} · {ATTEMPT_WORDS[item.hit.attemptState]}
                    </span>
                  </>
                ) : item.kind === "action" ? (
                  <>
                    <Zap aria-hidden="true" />
                    <span className="palette-main">{item.page.label}</span>
                    <span className="palette-meta">Action</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid aria-hidden="true" />
                    <span className="palette-main">{item.page.label}</span>
                    <span className="palette-meta">Page</span>
                  </>
                )}
                {index === active ? <CornerDownLeft aria-hidden="true" className="palette-enter" /> : null}
              </li>
            );
          })}
        </ul>
      </li>
    );
  };

  return (
    <Dialog label="Search" variant="top" className="palette" onClose={onClose} initialFocus={input}>
        <label className="palette-input">
          <Search aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items.length === 0 ? undefined : `palette-item-${active}`}
            aria-label="Search exams, candidates and pages"
            placeholder={canSearchCandidates ? "Search exams, candidates by roll number, name or email, and pages" : "Search exams and pages"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(items[active]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="palette-list" id="palette-list" role="listbox" aria-label="Results">
          {group("recent", "Recent")}
          {group("action", "Actions")}
          {group("exam", "Exams")}
          {group("candidate", "Candidates")}
          {group("page", "Pages")}
        </ul>
        {items.length === 0 ? (
          <p className="notice palette-empty">{candidates.isFetching ? "Searching…" : `Nothing matches “${query.trim()}”.`}</p>
        ) : null}
        <p className="palette-foot notice small">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Ctrl</kbd> <kbd>K</kbd> from anywhere
        </p>
    </Dialog>
  );
}
