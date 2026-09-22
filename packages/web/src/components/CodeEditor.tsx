import { useEffect, useRef } from "react";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";

interface Props {
  readonly value: string;
  readonly language: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
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

/**
 * What the editor does: highlighting, line numbers, bracket matching,
 * auto-indent, undo. What it deliberately does not: completion of any kind, and
 * snippets. An assessment of whether someone can write code should not have an
 * editor that writes it for them.
 */
const setup: Extension = [
  lineNumbers(),
  highlightActiveLine(),
  drawSelection(),
  history(),
  indentOnInput(),
  bracketMatching(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
];

/**
 * A code editor for one answer. Tab indents, as it does in every editor a candidate has used;
 * Escape then Tab moves focus on, so the page stays keyboard-navigable.
 */
export function CodeEditor({ value, language, label, disabled, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const languageSlot = useRef(new Compartment());
  const editableSlot = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (host.current === null) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          setup,
          languageSlot.current.of(syntax(language)),
          editableSlot.current.of(EditorView.editable.of(!disabled)),
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

  // A value set from outside — a restored draft, a language switch — replaces
  // the document; the editor's own edits arrive here already equal.
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

  return <div className="code-editor" ref={host} />;
}
