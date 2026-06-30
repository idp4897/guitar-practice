'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCollectionAction,
  updateCollectionAction,
} from '@/application/collections/collection.actions';
import { normalizeTag, type StoredCollection } from '@/domain/collections/types';

interface CollectionEditorProps {
  collection?: StoredCollection;
  allTags:     string[];
}

export function CollectionEditor({ collection, allTags }: CollectionEditorProps) {
  const isEdit = !!collection;
  const router = useRouter();

  const [name,        setName]        = useState(collection?.name        ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [tags,        setTags]        = useState<string[]>(collection?.tags ?? []);
  const [tagInput,    setTagInput]    = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [pending,     startTransition] = useTransition();
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete: allTags that match current input, not already added
  const suggestions = tagInput.trim()
    ? allTags.filter(
        (t) =>
          t.includes(normalizeTag(tagInput)) &&
          !tags.includes(normalizeTag(tagInput)) &&
          !tags.includes(t),
      ).slice(0, 6)
    : [];

  const addTag = useCallback((raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || tags.includes(tag)) return;
    setTags((prev) => [...prev, tag]);
    setTagInput('');
    setShowSuggest(false);
    tagInputRef.current?.focus();
  }, [tags]);

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    } else if (e.key === 'Escape') {
      setShowSuggest(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setError(null);
    const input = {
      name:        name.trim(),
      description: description.trim() || undefined,
      tags,
    };
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateCollectionAction(collection.id, input);
        } else {
          await createCollectionAction(input);
        }
      } catch (e: unknown) {
        if (
          e != null && typeof e === 'object' && 'digest' in e &&
          typeof (e as Record<string, unknown>).digest === 'string' &&
          (e as Record<string, string>).digest.startsWith('NEXT_')
        ) return;
        setError(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3
        border-b border-zinc-800 bg-zinc-900">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-9 h-9 rounded-lg
            text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="flex-1 text-base font-semibold">
          {isEdit ? 'Edit Collection' : 'New Collection'}
        </h1>
        <button
          onClick={handleSave}
          disabled={pending}
          className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950
            text-sm font-bold hover:bg-amber-400
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-950 border-b border-red-800">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Name */}
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collection name"
            className={inputCls}
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description…"
            rows={3}
            className={[inputCls, 'resize-none'].join(' ')}
          />
        </Field>

        {/* Tags */}
        <Field label="Tags">
          <div className="flex flex-col gap-2">
            {/* Current tag chips */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                      bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag input + autocomplete */}
            <div className="relative">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setShowSuggest(true); }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="Add tag (Enter or , to confirm)"
                className={inputCls}
              />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20
                  bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => addTag(s)}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300
                        hover:bg-zinc-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-600">
              Tags are lowercased automatically. Press Enter or comma to add.
            </p>
          </div>
        </Field>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label:     string;
  required?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-amber-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = [
  'w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700',
  'text-sm text-zinc-100 placeholder:text-zinc-600',
  'focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500',
  'transition-colors',
].join(' ');
