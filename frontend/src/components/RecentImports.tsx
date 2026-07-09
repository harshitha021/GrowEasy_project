'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { subscribeToJob } from '@/lib/api';
import {
  failEntry,
  finalizeJobCompletion,
  loadHistory,
  removeHistoryEntry,
  HISTORY_CHANGED_EVENT,
  type HistoryEntry,
} from '@/lib/history';
import type { ImportProgress } from '@/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface RecentImportsProps {
  onOpen: (entry: HistoryEntry) => void;
  /** Sidebar variant renders an empty-state instead of collapsing. */
  showEmpty?: boolean;
}

export function RecentImports({ onOpen, showEmpty = false }: RecentImportsProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [liveProgress, setLiveProgress] = useState<Record<string, ImportProgress>>({});
  const subscriptions = useRef<Map<string, () => void>>(new Map());

  // localStorage is client-only — read after mount to avoid hydration mismatch.
  // Re-read whenever any part of the app changes history (new pending job,
  // completion, deletion) or another tab writes it (storage event).
  useEffect(() => {
    const refresh = () => setEntries(loadHistory());
    refresh();
    window.addEventListener(HISTORY_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(HISTORY_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Live-track pending jobs: subscribe to each one's stream, update history
  // (and this list) when they finish. Jobs run server-side — this works even
  // right after a page reload.
  useEffect(() => {
    const subs = subscriptions.current;
    for (const entry of entries) {
      if (entry.status !== 'pending' || subs.has(entry.id)) continue;
      const unsubscribe = subscribeToJob(entry.id, {
        onProgress: (p) => setLiveProgress((m) => ({ ...m, [entry.id]: p })),
        onDone: (summary) => {
          // Retry jobs combine with their original's records; plain jobs as-is.
          finalizeJobCompletion(entry.id, summary);
          setEntries(loadHistory());
        },
        onError: (message) => {
          failEntry(entry.id, message);
          setEntries(loadHistory());
        },
        onNotFound: () => {
          failEntry(entry.id, 'Job expired');
          setEntries(loadHistory());
        },
      });
      subs.set(entry.id, unsubscribe);
    }
    // Drop subscriptions for entries that are no longer pending/listed.
    for (const [id, unsubscribe] of subs) {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.status !== 'pending') {
        unsubscribe();
        subs.delete(id);
      }
    }
  }, [entries]);

  // Clean up all streams on unmount.
  useEffect(() => {
    const subs = subscriptions.current;
    return () => {
      for (const unsubscribe of subs.values()) unsubscribe();
      subs.clear();
    };
  }, []);

  if (entries.length === 0 && !showEmpty) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 26 }}
      className="w-full"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
        Recent imports
      </h3>
      {entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400 dark:border-white/10 dark:text-zinc-500">
          No imports yet — your uploaded CSVs will appear here.
        </div>
      )}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
            const progress = liveProgress[entry.id];
            const pct =
              progress && progress.totalBatches > 0
                ? Math.round((progress.batchesDone / progress.totalBatches) * 100)
                : null;
            return (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="group rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3 shadow-sm backdrop-blur transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950/80"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m6.75 3H9m1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">
                      {entry.fileName}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      {formatDate(entry.date)} · {entry.totalRows} rows
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    aria-label={`Delete ${entry.fileName} from history`}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setEntries(removeHistoryEntry(entry.id))}
                    className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </motion.button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-1.5 text-xs font-medium">
                  <div className="flex flex-wrap items-center gap-1.5">
                  {entry.edited && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                      edited
                    </span>
                  )}
                  {entry.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </span>
                      Pending{pct !== null ? ` · ${pct}%` : ''}
                    </span>
                  )}
                  {entry.status === 'failed' && (
                    <span
                      className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                      title={entry.error}
                    >
                      Failed
                    </span>
                  )}
                  {entry.status === 'done' && (
                    <>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        {entry.totalImported} in
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        {entry.totalSkipped} skip
                      </span>
                    </>
                  )}
                  </div>

                  {entry.status === 'done' &&
                    (entry.summary ? (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onOpen(entry)}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
                      >
                        View
                      </motion.button>
                    ) : (
                      <span
                        className="shrink-0 cursor-help px-1 text-xs text-slate-300 dark:text-zinc-600"
                        title="Too large to store — metadata only"
                      >
                        —
                      </span>
                    ))}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}