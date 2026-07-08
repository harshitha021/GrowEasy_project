'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ColumnMapping } from '@/types';

/**
 * Transparency panel: shows how the AI mapped each CSV column to a CRM field.
 * Collapsed by default to keep the results view focused.
 */
export function ColumnMappingPanel({ mapping }: { mapping: ColumnMapping[] }) {
  const [open, setOpen] = useState(false);
  const mapped = mapping.filter((m) => m.maps_to);
  const unmapped = mapping.filter((m) => !m.maps_to);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/90"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
          <svg className="size-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          How your columns were mapped
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            {mapped.length} of {mapping.length} used
          </span>
        </span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="size-4 shrink-0 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-5 py-4 dark:border-white/5">
              <div className="flex flex-wrap gap-2">
                {mapped.map((m, i) => (
                  <motion.span
                    key={m.column}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 22 }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-white/10 dark:bg-zinc-900"
                  >
                    <span className="font-medium text-slate-700 dark:text-zinc-200">{m.column}</span>
                    <svg className="size-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{m.maps_to}</span>
                  </motion.span>
                ))}
              </div>
              {unmapped.length > 0 && (
                <p className="mt-3 text-xs text-slate-400 dark:text-zinc-500">
                  Not used:{' '}
                  {unmapped.map((m) => (
                    <span
                      key={m.column}
                      className="mr-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 dark:bg-zinc-900"
                    >
                      {m.column}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
