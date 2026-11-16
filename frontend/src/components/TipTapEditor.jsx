import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo2,
  Redo2,
  Link2,
  Unlink,
  Check,
  X,
  Users,
} from "lucide-react";

export default function TipTapEditor({
  content,
  onChange,
  readOnly = false,
  placeholder = "Start writing your document...",
  // Yjs collaborative editing props
  ydoc = null,
  provider = null,
  user = null,
}) {
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Build extension pipeline based on whether collaborative mode (Y.Doc) is provided
  const extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      // In collaborative mode, Yjs handles history instead of ProseMirror history
      history: !ydoc,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-indigo-600 dark:text-indigo-400 underline cursor-pointer hover:text-indigo-700",
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
  ];

  if (ydoc) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
      })
    );

    if (provider && provider.awareness) {
      extensions.push(
        CollaborationCursor.configure({
          provider: provider,
          user: {
            name: user?.name || "Anonymous",
            color: user?.color || "#6366f1",
          },
        })
      );
    }
  }

  const editor = useEditor(
    {
      extensions,
      content: ydoc ? undefined : content || "<p></p>",
      editable: !readOnly,
      onUpdate: ({ editor }) => {
        if (onChange) {
          onChange({
            json: editor.getJSON(),
            html: editor.getHTML(),
          });
        }
      },
    },
    [ydoc, provider]
  );

  if (!editor) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading editor...</div>;
  }

  const setLink = () => {
    if (!linkUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkInputOpen(false);
      return;
    }

    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:") && !url.startsWith("/")) {
      url = `https://${url}`;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkUrl("");
    setLinkInputOpen(false);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
      {/* Editor Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs">
          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("heading", { level: 1 })
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("heading", { level: 2 })
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("heading", { level: 3 })
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

          {/* Formats: Bold, Italic, Underline */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("bold")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("italic")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("underline")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("bulletList")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("orderedList")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Ordered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          {/* Blockquote & Code Block */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("blockquote")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("codeBlock")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Code Block"
          >
            <Code className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

          {/* Links */}
          <button
            type="button"
            onClick={() => {
              const previousUrl = editor.getAttributes("link").href;
              setLinkUrl(previousUrl || "");
              setLinkInputOpen(!linkInputOpen);
            }}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("link")
                ? "bg-indigo-600 text-white font-bold"
                : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
            title="Insert Link"
          >
            <Link2 className="w-4 h-4" />
          </button>

          {editor.isActive("link") && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500"
              title="Remove Link"
            >
              <Unlink className="w-4 h-4" />
            </button>
          )}

          {/* Undo / Redo (non-collab fallback) */}
          {!ydoc && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Link Prompt Popover */}
      {linkInputOpen && !readOnly && (
        <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs">
          <input
            type="text"
            placeholder="Enter URL (https://...)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setLink();
              } else if (e.key === "Escape") {
                setLinkInputOpen(false);
              }
            }}
            className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            type="button"
            onClick={setLink}
            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            title="Apply Link"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setLinkInputOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Prose Content Area */}
      <div className="p-6 min-h-[360px] text-slate-900 dark:text-slate-100 focus:outline-hidden prose dark:prose-invert max-w-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
