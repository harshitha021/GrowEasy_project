'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useImport } from '@/hooks/useImport';
import { FileDropzone } from '@/components/FileDropzone';
import { DataTable } from '@/components/DataTable';
import { ProgressPanel } from '@/components/ProgressPanel';
import { ResultsView } from '@/components/ResultsView';
import { StepIndicator } from '@/components/StepIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RecentImports } from '@/components/RecentImports';
import { SearchInput } from '@/components/SearchInput';

export default function Home() {
  const {
    state,
    upload,
    confirmImport,
    retrySkipped,
    openHistory,
    reset,
    clearError,
    updatePreviewCell,
    updateResultCell,
    updateSkippedCell,
  } = useImport();
  const [editingPreview, setEditingPreview] = useState(false);
  const [previewQuery, setPreviewQuery] = useState('');

  /** Preview rows matching the search, with their original indices kept. */
  const previewFiltered = useMemo(() => {
    const rows = state.parseResult?.rows ?? [];
    const q = previewQuery.trim().toLowerCase();
    if (!q) return rows.map((row, index) => ({ row, index }));
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        Object.values(row).some((v) => v.toLowerCase().includes(q))
      );
  }, [state.parseResult, previewQuery]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      {/* Decorative background — drifting aurora blobs over a faded grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-aurora absolute -top-40 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-400/25 via-violet-400/15 to-fuchsia-400/20 blur-3xl dark:from-indigo-600/20 dark:via-violet-600/12 dark:to-fuchsia-600/12" />
        <div className="animate-aurora-slow absolute top-1/3 -left-40 h-[24rem] w-[36rem] rounded-full bg-gradient-to-tr from-violet-400/15 to-cyan-400/10 blur-3xl dark:from-violet-600/10 dark:to-cyan-500/8" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(100 116 139 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgb(100 116 139 / 0.12) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
          }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-white/10/70 dark:bg-black/70">
        <div className="flex w-full items-center justify-between px-3 py-3.5 sm:px-5">
          <motion.button
            type="button"
            onClick={reset}
            whileTap={{ scale: 0.98 }}
            aria-label="Go to home"
            className="flex items-center gap-3 rounded-xl text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- .ico logo, no optimization needed */}
            <img
              src="/favicon.ico"
              alt="GrowEasy logo"
              className="h-9 w-9 rounded-xl shadow-md shadow-indigo-500/25 transition-shadow hover:shadow-lg hover:shadow-indigo-500/35"
            />
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight">
                GrowEasy CSV Importer
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                AI-powered lead extraction from any CSV
              </p>
            </div>
          </motion.button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex w-full flex-1 gap-6 px-3 py-10 sm:px-5">
        {/* Left sidebar — import history, always visible on desktop */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24">
            <RecentImports onOpen={openHistory} showEmpty />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
        {state.step === 'upload' && (
          <motion.div
            className="mb-10 text-center"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.09 } } }}
          >
            <motion.span
              variants={{
                hidden: { opacity: 0, y: 12, scale: 0.95 },
                show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } },
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
            >
              <svg className="size-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
              </svg>
              Powered by AI field mapping
            </motion.span>
            <motion.h2
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
              }}
              className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Import leads from{' '}
              <span className="animate-gradient-x bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                any CSV
              </span>
            </motion.h2>
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
              }}
              className="mx-auto mt-3 max-w-xl text-sm text-slate-500 dark:text-zinc-400"
            >
              Different column names, layouts and structures — our AI maps them all
              into clean GrowEasy CRM records. No templates required.
            </motion.p>
          </motion.div>
        )}

        <StepIndicator current={state.step} />

        <AnimatePresence>
          {state.error && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="mx-auto mt-6 flex max-w-2xl items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <p>{state.error}</p>
              <button type="button" onClick={clearError} aria-label="Dismiss error" className="font-bold">
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            className="mt-8"
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 240, damping: 26 }}
          >
          {state.step === 'upload' && (
            <>
              <FileDropzone onFile={upload} parsing={state.parsing} />
              {/* On mobile (no sidebar), history lives below the dropzone */}
              <div className="mt-10 lg:hidden">
                <RecentImports onOpen={openHistory} />
              </div>
            </>
          )}

          {state.step === 'preview' && state.parseResult && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Preview</h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    <span className="font-medium text-slate-700 dark:text-zinc-200">
                      {state.fileName}
                    </span>{' '}
                    · {state.parseResult.totalRows} rows ·{' '}
                    {state.parseResult.headers.length} columns — review the raw
                    data, then confirm to run AI extraction
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPreview((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition ${
                      editingPreview
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                    {editingPreview ? 'Done editing' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPreview(false);
                      setPreviewQuery('');
                      reset();
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Choose another file
                  </button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setEditingPreview(false);
                      setPreviewQuery('');
                      confirmImport();
                    }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-shadow hover:shadow-lg hover:shadow-indigo-500/35"
                  >
                    Confirm import →
                  </motion.button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SearchInput
                  value={previewQuery}
                  onChange={setPreviewQuery}
                  placeholder="Search rows…"
                />
                {previewQuery && (
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    Showing {previewFiltered.length} of {state.parseResult.totalRows} rows
                  </span>
                )}
              </div>
              <DataTable
                headers={state.parseResult.headers}
                rows={previewFiltered.map(({ row }) => row)}
                rowNumbers={previewFiltered.map(({ index }) => index + 1)}
                editable={editingPreview}
                onCellChange={(i, h, v) => updatePreviewCell(previewFiltered[i].index, h, v)}
              />
            </div>
          )}

          {state.step === 'importing' && (
            <>
              <ProgressPanel progress={state.progress} />
              <div className="mt-6 text-center">
                <motion.button
                  type="button"
                  onClick={reset}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Import another CSV
                </motion.button>
                <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">
                  This import keeps running in the background — track it under
                  Recent imports on the home page.
                </p>
              </div>
            </>
          )}

          {state.step === 'results' && state.summary && (
            <ResultsView
              summary={state.summary}
              onReset={reset}
              onEditRecord={updateResultCell}
              onEditSkipped={updateSkippedCell}
              onRetrySkipped={retrySkipped}
            />
          )}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>

      <footer className="border-t border-slate-200/70 py-4 text-center text-xs text-slate-400 dark:border-white/10/70 dark:text-zinc-500">
        GrowEasy Software Developer Assignment — AI-powered CSV Importer
      </footer>
    </div>
  );
}