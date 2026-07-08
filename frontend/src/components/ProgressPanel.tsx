'use client';

import { motion } from 'motion/react';
import type { ImportProgress } from '@/types';

export function ProgressPanel({ progress }: { progress: ImportProgress | null }) {
  const pct = progress && progress.totalBatches > 0
    ? Math.round((progress.batchesDone / progress.totalBatches) * 100)
    : 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[1.5rem] bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-fuchsia-500/30 blur-lg"
      />
      <div className="relative rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
        <div className="relative mx-auto h-16 w-16">
          {/* Rotating conic ring */}
          <div
            className="animate-spin-slow absolute -inset-1 rounded-[1.35rem]"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 260deg, rgb(129 140 248 / 0.9) 320deg, transparent 360deg)',
              WebkitMask:
                'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 2px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 2px))',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
            <svg className="h-7 w-7 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">AI is mapping your leads…</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Rows are processed in batches. Failed batches are retried automatically.
        </p>

        <div className="mt-7">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-900">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              initial={{ width: '4%' }}
              animate={{ width: `${Math.max(pct, 4)}%` }}
              transition={{ type: 'spring', stiffness: 60, damping: 18 }}
            >
              <div className="animate-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </motion.div>
          </div>
          <div className="mt-2.5 flex justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>
              Batch {progress?.batchesDone ?? 0} / {progress?.totalBatches ?? '?'}
            </span>
            <span className="tabular-nums">{pct}%</span>
            <span>
              {progress?.rowsProcessed ?? 0} of {progress?.totalRows ?? '?'} rows
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
