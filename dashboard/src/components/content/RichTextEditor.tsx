'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  placeholder?: string;
  helperText?: string;
}

interface ToolbarAction {
  label: string;
  command: string;
  value?: string;
  prompt?: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' },
  { label: 'S', command: 'strikeThrough' },
  { label: 'H1', command: 'formatBlock', value: 'h1' },
  { label: 'H2', command: 'formatBlock', value: 'h2' },
  { label: 'Quote', command: 'formatBlock', value: 'blockquote' },
  { label: 'Bullet', command: 'insertUnorderedList' },
  { label: 'Number', command: 'insertOrderedList' },
  { label: 'Link', command: 'createLink', prompt: 'Enter URL' },
  { label: 'Clear', command: 'removeFormat' },
];

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

export function RichTextEditor({
  label,
  value,
  onChange,
  minHeight = 160,
  placeholder,
  helperText,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const normalizedValue = useMemo(() => normalizeHtml(value), [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
  }, [normalizedValue]);

  function syncValue() {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(editor.innerHTML);
  }

  function runCommand(
    command: string,
    options?: {
      value?: string;
      prompt?: string;
    }
  ) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    let commandValue = options?.value;
    if (options?.prompt) {
      const prompted = window.prompt(options.prompt, 'https://');
      if (!prompted) return;
      commandValue = prompted;
    }

    document.execCommand(command, false, commandValue);
    syncValue();
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="mb-2 flex flex-wrap gap-2">
        {TOOLBAR_ACTIONS.map((action) => (
          <Button
            key={`${action.command}-${action.label}`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => runCommand(action.command, { value: action.value, prompt: action.prompt })}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}`}
        style={{ minHeight }}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="outline-none prose prose-sm max-w-none"
          style={{ minHeight: minHeight - 18 }}
        />
      </div>
      {placeholder ? <p className="mt-2 text-xs text-gray-400">{placeholder}</p> : null}
      {helperText ? <p className="mt-2 text-xs text-gray-500">{helperText}</p> : null}
    </div>
  );
}
