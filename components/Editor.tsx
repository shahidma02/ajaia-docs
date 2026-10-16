"use client";

import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ReactNode } from "react";
import { List, ListOrdered, Redo2, Undo2 } from "lucide-react";

export default function Editor({
  content,
  editable,
  onChange,
}: {
  content: string;
  editable: boolean;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    // StarterKit v3 bundles bold/italic/underline/headings/lists plus markdown-style shortcuts (# , - , 1. ).
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !editable } })],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "page", "aria-label": "Document content" } },
  });

  return (
    <>
      {editor && editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}

function Toolbar({ editor }: { editor: TiptapEditor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  const setBlock = (v: string) => {
    if (v === "p") chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  };

  const btn = (label: ReactNode, title: string, active: boolean, run: () => void, disabled = false) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={active ? "tool active" : "tool"}
      disabled={disabled}
      onClick={run}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {btn(<Undo2 size={18} />, "Undo (⌘Z)", false, () => chain().undo().run(), !s.canUndo)}
      {btn(<Redo2 size={18} />, "Redo (⌘⇧Z)", false, () => chain().redo().run(), !s.canRedo)}
      <span className="sep" />
      <select aria-label="Text style" value={s.block} onChange={(e) => setBlock(e.target.value)}>
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="sep" />
      {btn("B", "Bold (⌘B)", s.bold, () => chain().toggleBold().run())}
      {btn("I", "Italic (⌘I)", s.italic, () => chain().toggleItalic().run())}
      {btn("U", "Underline (⌘U)", s.underline, () => chain().toggleUnderline().run())}
      <span className="sep" />
      {btn(<List size={18} />, "Bulleted list", s.bullet, () => chain().toggleBulletList().run())}
      {btn(<ListOrdered size={18} />, "Numbered list", s.ordered, () => chain().toggleOrderedList().run())}
    </div>
  );
}
