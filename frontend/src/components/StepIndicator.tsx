'use client';

import { motion } from 'motion/react';
import type { Step } from '@/hooks/useImport';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload CSV' },
  { key: 'preview', label: 'Preview' },
  { key: 'importing', label: 'AI Import' },
  { key: 'results', label: 'Results' },
];

export function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  done
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30'
                    : active
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30 ring-4 ring-indigo-500/15'
                      : 'border border-slate-300 bg-white text-slate-400 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-500'
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden text-sm sm:block ${
                  active
                    ? 'font-semibold text-slate-900 dark:text-white'
                    : done
                      ? 'font-medium text-slate-600 dark:text-zinc-300'
                      : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px w-6 rounded-full transition-colors duration-300 sm:w-10 ${
                  done
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                    : 'bg-slate-300 dark:bg-white/15'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
