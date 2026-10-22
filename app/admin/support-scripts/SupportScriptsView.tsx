'use client';

// Support scripts: browse, preview with placeholder substitution, copy to
// clipboard. Editing is gated by support_scripts:manage (super admins).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  placeholdersIn,
  missingPlaceholders,
  PLACEHOLDER_DOCS,
} from '@/lib/support-scripts';

interface Script {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  usageNotes: string | null;
  isInternal: boolean;
  updatedAt: string;
}

export default function SupportScriptsView() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (query) params.set('q', query);
      const res = await fetch(`/api/admin/support-scripts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load scripts');
      setScripts(data.scripts || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, query]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        setCanManage((data?.admin?.role || '').toUpperCase() === 'SUPER_ADMIN');
      } catch {
        /* deny by default */
      }
    })();
  }, []);

  // Union of placeholders across the visible scripts → one shared field set.
  const allPlaceholders = useMemo(() => {
    const set = new Set<string>();
    scripts.forEach((s) => placeholdersIn(s.body).forEach((p) => set.add(p)));
    return Array.from(set);
  }, [scripts]);

  const copy = async (script: Script) => {
    const missing = missingPlaceholders(script.body, values);
    if (missing.length > 0) {
      const proceed = window.confirm(
        `This script still has unfilled placeholders: ${missing
          .map((m) => `{{${m}}}`)
          .join(', ')}. Copy anyway?`
      );
      if (!proceed) return;
    }
    const text = script.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, name: string) =>
      values[name] ? values[name] : whole
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError('Clipboard access was denied by the browser.');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/support-scripts/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save script');
      setEditing(null);
      await fetchScripts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save script');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Scripts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Copy-paste customer replies. Nothing is sent automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scripts"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Placeholder values */}
      {allPlaceholders.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Fill placeholders (shared across scripts)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allPlaceholders.map((p) => (
              <label key={p} className="text-xs text-slate-400">
                {`{{${p}}}`}
                <input
                  value={values[p] || ''}
                  onChange={(e) => setValues({ ...values, [p]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading scripts…</p>
      ) : scripts.length === 0 ? (
        <p className="text-slate-500 text-sm">No scripts found.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scripts.map((s) => {
            const missing = missingPlaceholders(s.body, values);
            const rendered = s.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, name: string) =>
              values[name] ? values[name] : whole
            );
            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">{s.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.category}
                      {s.isInternal ? ' · Internal only' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canManage && (
                      <button
                        onClick={() => {
                          setEditing(s);
                          setEditBody(s.body);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => copy(s)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {copiedId === s.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-200 font-sans flex-1">
                  {rendered}
                </pre>

                {missing.length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-300">
                    Missing: {missing.map((m) => `{{${m}}}`).join(', ')}
                  </p>
                )}
                {s.usageNotes && (
                  <p className="mt-3 text-[11px] text-slate-500 border-t border-slate-800 pt-2">
                    ⓘ {s.usageNotes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Placeholder documentation */}
      <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <summary className="cursor-pointer text-slate-300">Placeholder reference</summary>
        <ul className="mt-3 space-y-1">
          {PLACEHOLDER_DOCS.map((d) => (
            <li key={d.name}>
              <span className="font-mono text-slate-300">{`{{${d.name}}}`}</span> — {d.description}
            </li>
          ))}
        </ul>
      </details>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-white mb-2">Edit: {editing.title}</h3>
            <p className="text-xs text-slate-500 mb-3">
              Editing creates a new version; previous wording is retained in history.
            </p>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 font-mono"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
