'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import { Button } from '@/components/ui/Button';

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  placeholder?: string;
  helperText?: string;
}

function normalizeHtml(value: string): string {
  return value && value.trim().length > 0 ? value : '<p></p>';
}

export function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|blockquote|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ToolbarButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={active ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function RichTextEditor({
  label,
  value,
  onChange,
  minHeight = 160,
  placeholder,
  helperText,
}: RichTextEditorProps) {
  const normalizedValue = useMemo(() => normalizeHtml(value), [value]);
  const [isFocused, setIsFocused] = useState(false);
  const isEmpty = stripHtml(normalizedValue).length === 0;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        class:
          'ProseMirror outline-none max-w-none text-sm text-gray-900 leading-6 [&_p]:mb-3 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_a]:text-blue-600 [&_a]:underline',
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    onFocus: () => {
      setIsFocused(true);
    },
    onBlur: () => {
      setIsFocused(false);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentHtml = normalizeHtml(editor.getHTML());
    if (currentHtml !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, normalizedValue]);

  function setLink() {
    if (!editor) return;
    const existingUrl = editor.getAttributes('link').href as string | undefined;
    const nextUrl = window.prompt('Enter URL', existingUrl ?? 'https://');
    if (nextUrl === null) return;
    const trimmedUrl = nextUrl.trim();
    if (!trimmedUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmedUrl }).run();
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="mb-2 flex flex-wrap gap-2">
        <ToolbarButton label="B" active={!!editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolbarButton label="I" active={!!editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="U" active={!!editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
        <ToolbarButton
          label="H1"
          active={!!editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="H2"
          active={!!editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton label="Quote" active={!!editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton label="Bullet" active={!!editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="Number" active={!!editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton label="Link" active={!!editor?.isActive('link')} onClick={setLink} />
        <ToolbarButton label="Clear" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} />
      </div>
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}`}
        style={{ minHeight }}
      >
        <div className="relative" style={{ minHeight: minHeight - 18 }}>
          {placeholder && isEmpty ? (
            <div className="pointer-events-none absolute left-0 top-0 text-sm text-gray-400">
              {placeholder}
            </div>
          ) : null}
          <EditorContent editor={editor} />
        </div>
      </div>
      {helperText ? <p className="mt-2 text-xs text-gray-500">{helperText}</p> : null}
    </div>
  );
}
