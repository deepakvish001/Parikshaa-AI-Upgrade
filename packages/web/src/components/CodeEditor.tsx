import { useEffect, useRef } from "react";
import { autocompletion, closeBrackets, closeBracketsKeymap, completeAnyWord } from "@codemirror/autocomplete";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";

interface Props {
  readonly value: string;
  readonly language: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly dark?: boolean;
  readonly fontSize?: number;
  /** Offer completion: the exam decides, and most say no. */
  readonly completion?: boolean;
  /** Ctrl/Cmd+Enter. */
  readonly onRunShortcut?: () => void;
  /** Ctrl/Cmd+'. */
  readonly onSubmitShortcut?: () => void;
}

const syntax = (language: string): Extension => {
  switch (language) {
    case "python":
      return python();
    case "javascript":
      return javascript();
    case "c":
    case "cpp":
      return cpp();
    case "java":
      return java();
    default:
      return [];
  }
};

/** Colours for the dark editor, from the brand's ink palette. */
const darkHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: "#c7a0ff" },
  { tag: [tags.string, tags.special(tags.string)], color: "#9fe39f" },
  { tag: [tags.number, tags.bool, tags.null], color: "#ffb86b" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#7d86a8", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#7ec8ff" },
  { tag: [tags.typeName, tags.className], color: "#ffd479" },
  { tag: [tags.definition(tags.variableName)], color: "#e6e9f5" },
  { tag: [tags.operator, tags.punctuation], color: "#b8c0de" },
]);

const light: Extension = [
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.theme({ "&": { backgroundColor: "var(--surface, #fff)" } }, { dark: false }),
];

const dark: Extension = [
  syntaxHighlighting(darkHighlight),
  EditorView.theme(
    {
      "&": { backgroundColor: "#11162b", color: "#e6e9f5" },
      ".cm-content": { caretColor: "#ffffff" },
      ".cm-gutters": { backgroundColor: "#0c1022", color: "#6c7596", border: "none" },
      ".cm-activeLine": { backgroundColor: "#1a2140" },
      ".cm-activeLineGutter": { backgroundColor: "#1a2140", color: "#c9cfe8" },
      "&.cm-focused .cm-cursor": { borderLeftColor: "#ffffff" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#34407a" },
      ".cm-matchingBracket": { backgroundColor: "#2c3a6e", outline: "1px solid #5a6bb8" },
      ".cm-tooltip": { backgroundColor: "#1a2140", color: "#e6e9f5", border: "1px solid #34407a" },
    },
    { dark: true },
  ),
];

const sized = (px: number): Extension => EditorView.theme({ "&": { fontSize: `${px}px` }, ".cm-content, .cm-gutter": { minHeight: "100%" } });

/** Completion, when the exam allows it: the language's own, and any word already in the file. */
const completing = (on: boolean): Extension =>
  on ? [autocompletion(), EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])] : [];

/**
 * What the editor always does: highlighting, line numbers, bracket matching
 * and closing, auto-indent, undo. Completion is the exam's choice and off by
 * default: an assessment of whether someone can write code should not, unasked,
 * have an editor that writes it for them.
 */
const setup: Extension = [
  lineNumbers(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  drawSelection(),
  history(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
];

/**
 * A code editor for one answer. Tab indents, as it does in every editor a candidate has used;
 * Escape then Tab moves focus on, so the page stays keyboard-navigable.
 */
export function CodeEditor({ value, language, label, disabled, onChange, dark: isDark = false, fontSize = 14, completion = false, onRunShortcut, onSubmitShortcut }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const languageSlot = useRef(new Compartment());
  const editableSlot = useRef(new Compartment());
  const themeSlot = useRef(new Compartment());
  const sizeSlot = useRef(new Compartment());
  const completionSlot = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const runRef = useRef(onRunShortcut);
  runRef.current = onRunShortcut;
  const submitRef = useRef(onSubmitShortcut);
  submitRef.current = onSubmitShortcut;

  useEffect(() => {
    if (host.current === null) return;
    const shortcuts = Prec.highest(
      keymap.of([
        { key: "Mod-Enter", run: () => (runRef.current === undefined ? false : (runRef.current(), true)) },
        { key: "Mod-'", run: () => (submitRef.current === undefined ? false : (submitRef.current(), true)) },
      ]),
    );
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          shortcuts,
          setup,
          languageSlot.current.of(syntax(language)),
          editableSlot.current.of(EditorView.editable.of(!disabled)),
          themeSlot.current.of(isDark ? dark : light),
          sizeSlot.current.of(sized(fontSize)),
          completionSlot.current.of(completing(completion)),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
    // Created once; the effects below keep it in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value set from outside — a restored draft, a language switch, a reset —
  // replaces the document; the editor's own edits arrive here already equal.
  useEffect(() => {
    const editor = view.current;
    if (editor !== null && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: languageSlot.current.reconfigure(syntax(language)) });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({ effects: editableSlot.current.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeSlot.current.reconfigure(isDark ? dark : light) });
  }, [isDark]);

  useEffect(() => {
    view.current?.dispatch({ effects: sizeSlot.current.reconfigure(sized(fontSize)) });
  }, [fontSize]);

  useEffect(() => {
    view.current?.dispatch({ effects: completionSlot.current.reconfigure(completing(completion)) });
  }, [completion]);

  return <div className={`code-editor${isDark ? " dark" : ""}`} ref={host} />;
}
