'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCsv, startImport, subscribeToJob } from '@/lib/api';
import {
  addPendingEntry,
  addRetryEntry,
  failEntry,
  finalizeJobCompletion,
  type HistoryEntry,
} from '@/lib/history';
import type { ImportProgress, ImportSummary, ParseResult, RawRow } from '@/types';

export type Step = 'upload' | 'preview' | 'importing' | 'results';

export interface ImportState {
  step: Step;
  fileName: string;
  parsing: boolean;
  parseResult: ParseResult | null;
  progress: ImportProgress | null;
  summary: ImportSummary | null;
  /** History entry id backing the current results view. */
  historyId: string | null;
  error: string | null;
}

const initial: ImportState = {
  step: 'upload',
  fileName: '',
  parsing: false,
  parseResult: null,
  progress: null,
  summary: null,
  historyId: null,
  error: null,
};

interface RetryContext {
  originId: string | null;
  retryMap: number[];
  baseSummary: ImportSummary;
}

export function useImport() {
  const [state, setState] = useState<ImportState>(initial);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  /** Job currently shown on the importing screen (null once user navigates away). */
  const watchedJobRef = useRef<string | null>(null);

  // Close the UI stream on unmount — jobs keep running server-side, and
  // the RecentImports panel tracks them via their history entries.
  useEffect(() => () => unsubscribeRef.current?.(), []);

  /** Step 1 -> 2: upload + parse for preview (no AI). */
  const upload = useCallback(async (file: File) => {
    setState((s) => ({ ...s, parsing: true, error: null, fileName: file.name }));
    try {
      const parseResult = await parseCsv(file);
      setState((s) => ({ ...s, parsing: false, parseResult, step: 'preview' }));
    } catch (err) {
      setState((s) => ({
        ...s,
        parsing: false,
        error: err instanceof Error ? err.message : 'Upload failed.',
      }));
    }
  }, []);

  /** Where to land if a job errors out mid-watch. */
  const fallbackStep = (s: ImportState): Step =>
    s.summary ? 'results' : s.parseResult ? 'preview' : 'upload';

  /** Enqueue a background job for the given rows and watch its stream. */
  const launchJob = useCallback(async (rows: RawRow[], fileName: string, retry?: RetryContext) => {
    setState((s) => ({ ...s, step: 'importing', error: null, progress: null, fileName }));
    try {
      const jobId = await startImport(rows);
      if (retry) {
        addRetryEntry(
          jobId,
          fileName,
          retry.baseSummary.totalRows,
          retry.originId ?? '',
          retry.retryMap
        );
      } else {
        addPendingEntry(jobId, fileName, rows.length);
      }
      watchedJobRef.current = jobId;

      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToJob(jobId, {
        onProgress: (progress) => {
          if (watchedJobRef.current !== jobId) return;
          setState((s) => (s.step === 'importing' ? { ...s, progress } : s));
        },
        onDone: (summary) => {
          const final = finalizeJobCompletion(jobId, summary, retry?.baseSummary);
          if (watchedJobRef.current !== jobId) return;
          setState((s) =>
            s.step === 'importing'
              ? { ...s, summary: final, fileName, historyId: jobId, step: 'results' }
              : s
          );
        },
        onError: (message) => {
          failEntry(jobId, message);
          if (watchedJobRef.current !== jobId) return;
          setState((s) =>
            s.step === 'importing' ? { ...s, error: message, step: fallbackStep(s) } : s
          );
        },
        onNotFound: () => {
          failEntry(jobId, 'Job expired');
          if (watchedJobRef.current !== jobId) return;
          setState((s) =>
            s.step === 'importing'
              ? {
                  ...s,
                  error: 'The import session expired — please try again.',
                  step: fallbackStep(s),
                }
              : s
          );
        },
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Import failed to start.',
        step: fallbackStep(s),
      }));
    }
  }, []);

  /** Step 3: confirm -> import the previewed rows. */
  const confirmImport = useCallback(async () => {
    const rows = state.parseResult?.rows;
    if (!rows) return;
    await launchJob(rows, state.fileName);
  }, [state.parseResult, state.fileName, launchJob]);

  /**
   * Re-run only the skipped rows (typically after the user edited them).
   * The original import stays untouched; a NEW import with the SAME file
   * name (marked "edited") is created containing the full dataset: the
   * original's imported records (carried over) plus the retried results.
   */
  const retrySkipped = useCallback(async () => {
    const summary = state.summary;
    const skipped = summary?.skipped;
    if (!summary || !skipped || skipped.length === 0) return;
    const fileName = state.fileName || 'import.csv';
    await launchJob(skipped.map((s) => s.raw), fileName, {
      originId: state.historyId,
      retryMap: skipped.map((s) => s.rowIndex),
      baseSummary: summary,
    });
  }, [state.summary, state.fileName, state.historyId, launchJob]);

  /** Edit a raw cell on the preview table (before AI import). */
  const updatePreviewCell = useCallback(
    (rowIndex: number, header: string, value: string) => {
      setState((s) => {
        if (!s.parseResult) return s;
        const rows = s.parseResult.rows.slice();
        rows[rowIndex] = { ...rows[rowIndex], [header]: value };
        return { ...s, parseResult: { ...s.parseResult, rows } };
      });
    },
    []
  );

  /** Edit a field on an imported record (after AI import, before download). */
  const updateResultCell = useCallback(
    (recordIndex: number, field: string, value: string) => {
      setState((s) => {
        if (!s.summary) return s;
        const imported = s.summary.imported.slice();
        imported[recordIndex] = { ...imported[recordIndex], [field]: value };
        return { ...s, summary: { ...s.summary, imported } };
      });
    },
    []
  );

  /** Edit a raw cell on a skipped row (so it can be retried). */
  const updateSkippedCell = useCallback(
    (recordIndex: number, column: string, value: string) => {
      setState((s) => {
        if (!s.summary) return s;
        const skipped = s.summary.skipped.slice();
        skipped[recordIndex] = {
          ...skipped[recordIndex],
          raw: { ...skipped[recordIndex].raw, [column]: value },
        };
        return { ...s, summary: { ...s.summary, skipped } };
      });
    },
    []
  );

  /** Reopen a past import's results from history. */
  const openHistory = useCallback((entry: HistoryEntry) => {
    if (!entry.summary) return;
    setState({
      ...initial,
      fileName: entry.fileName,
      summary: entry.summary,
      historyId: entry.id,
      step: 'results',
    });
  }, []);

  /** Go home. Any running job continues in the background (visible in history). */
  const reset = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    watchedJobRef.current = null;
    setState(initial);
  }, []);

  const clearError = useCallback(
    () => setState((s) => ({ ...s, error: null })),
    []
  );

  return {
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
  };
}