'use client';

import { motion } from 'motion/react';
import type { ImportSummary } from '@/types';
import { AnimatedNumber } from './AnimatedNumber';

const ICONS = {
  rows: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25A1.5 1.5 0 015.25 3.75h13.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25zM3.75 9h16.5M3.75 15h16.5" />
  ),
  imported: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  skipped: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  ),
};

export function StatsCards({ summary }: { summary: ImportSummary }) {
  const cards = [
    {
      label: 'Total rows',
      value: summary.totalRows,
      icon: ICONS.rows,
      chip: 'bg-slate-100 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300',
      accent: 'text-slate-900 dark:text-white',
    },
    {
      label: 'Imported',
      value: summary.totalImported,
      icon: ICONS.imported,
      chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Skipped',
      value: summary.totalSkipped,
      icon: ICONS.skipped,
      chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
      accent: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260, damping: 24 }}
          whileHover={{ y: -2 }}
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950/90"
        >
          <motion.span
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.12 + 0.08 * i, type: 'spring', stiffness: 300, damping: 18 }}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.chip}`}
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              {c.icon}
            </svg>
          </motion.span>
          <div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{c.label}</p>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${c.accent}`}>
              <AnimatedNumber value={c.value} />
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
