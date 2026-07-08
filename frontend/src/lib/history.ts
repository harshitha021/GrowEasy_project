import type { ImportSummary } from '@/types';

/**
 * Import history, persisted in localStorage (device-scoped, no login).
 * Entries are keyed by jobId and track the job lifecycle: an entry is added
 * as 'pending' the moment a job starts, then updated to 'done'/'failed'.
 * Full results are stored only for smaller imports (~5MB quota); larger
 * imports keep metadata only (not re-openable).
 */

export type HistoryStatus = 'pending' | 'done' | 'failed';

export interface HistoryEntry {
  /** Job id — stable key, so updates replace instead of duplicate. */
  id: string;
  fileName: string;
  /** ISO date string */
  date: string;
  status: HistoryStatus;
  totalRows: number;
  totalImported?: number;
  totalSkipped?: number;
  /** Present only when the import was small enough to store fully. */
  summary?: ImportSummary;
  error?: string;
  /** Retry jobs only: id of the original entry to merge results into. */
  mergeInto?: string;
  /** Retry jobs only: retry rowIndex (1-based) -> original CSV rowIndex. */
  retryMap?: number[];
}

const KEY = 'groweasy_import_history';
const MAX_ENTRIES = 10;
/** Store full results only below this row count. */
const FULL_SUMMARY_MAX_ROWS = 500;

/** Fired whenever history changes, so mounted panels can re-read it. */
export const HISTORY_CHANGED_EVENT = 'groweasy:history-changed';

function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT));
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded — retry with full summaries stripped from older entries.
    try {
      const slim = entries.map((e, i) => (i === 0 ? e : { ...e, summary: undefined }));
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* give up silently — history is a nice-to-have */
    }
  }
  notifyChanged();
}

function upsert(entry: HistoryEntry): void {
  const rest = loadHistory().filter((e) => e.id !== entry.id);
  persist([entry, ...rest].slice(0, MAX_ENTRIES));
}

/** Record a just-started job so it shows up as Pending in history. */
export function addPendingEntry(
  jobId: string,
  fileName: string,
  totalRows: number
): HistoryEntry {
  const entry: HistoryEntry = {
    id: jobId,
    fileName,
    date: new Date().toISOString(),
    status: 'pending',
    totalRows,
  };
  upsert(entry);
  return entry;
}

/** Mark a job's history entry as completed with its results. */
export function completeEntry(jobId: string, summary: ImportSummary): void {
  const existing = loadHistory().find((e) => e.id === jobId);
  upsert({
    id: jobId,
    fileName: existing?.fileName ?? 'import.csv',
    date: existing?.date ?? new Date().toISOString(),
    status: 'done',
    totalRows: summary.totalRows,
    totalImported: summary.totalImported,
    totalSkipped: summary.totalSkipped,
    summary: summary.totalRows <= FULL_SUMMARY_MAX_ROWS ? summary : undefined,
  });
}

/** Mark a job's history entry as failed/expired. */
export function failEntry(jobId: string, error: string): void {
  const existing = loadHistory().find((e) => e.id === jobId);
  if (!existing) return;
  upsert({ ...existing, status: 'failed', error, summary: undefined });
}

/** Record a retry job: shows as pending, and merges into the original on completion. */
export function addRetryEntry(
  jobId: string,
  fileName: string,
  totalRows: number,
  mergeInto: string,
  retryMap: number[]
): HistoryEntry {
  const entry: HistoryEntry = {
    id: jobId,
    fileName,
    date: new Date().toISOString(),
    status: 'pending',
    totalRows,
    mergeInto,
    retryMap,
  };
  upsert(entry);
  return entry;
}

/** Re-key a retry job's row indices back to the original CSV's row indices. */
export function remapSummary(summary: ImportSummary, retryMap: number[]): ImportSummary {
  const mapIdx = (r: number) => retryMap[r - 1] ?? r;
  return {
    ...summary,
    imported: summary.imported.map((rec) => ({ ...rec, rowIndex: mapIdx(rec.rowIndex) })),
    skipped: summary.skipped.map((s) => ({ ...s, rowIndex: mapIdx(s.rowIndex) })),
  };
}

/**
 * Merge a (re-keyed) retry result into the original summary: newly imported
 * rows are appended; the skipped list is REPLACED by the rows still skipped.
 */
export function mergeSummaries(
  base: ImportSummary,
  retryMapped: ImportSummary
): ImportSummary {
  const imported = [...base.imported, ...retryMapped.imported].sort(
    (a, b) => a.rowIndex - b.rowIndex
  );
  const skipped = retryMapped.skipped.slice().sort((a, b) => a.rowIndex - b.rowIndex);
  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
    totalRows: base.totalRows,
    ...(base.columnMapping ? { columnMapping: base.columnMapping } : {}),
  };
}

/**
 * Handle a finished job. Plain jobs complete their own entry; retry jobs
 * merge into their original entry and then remove themselves from history.
 */
export function recordJobCompletion(jobId: string, summary: ImportSummary): void {
  const entries = loadHistory();
  const entry = entries.find((e) => e.id === jobId);
  if (!entry?.mergeInto) {
    completeEntry(jobId, summary);
    return;
  }

  const mapped = remapSummary(summary, entry.retryMap ?? []);
  const original = entries.find((e) => e.id === entry.mergeInto);
  if (original) {
    if (original.summary) {
      const merged = mergeSummaries(original.summary, mapped);
      upsert({
        ...original,
        status: 'done',
        totalImported: merged.totalImported,
        totalSkipped: merged.totalSkipped,
        summary: merged.totalRows <= FULL_SUMMARY_MAX_ROWS ? merged : undefined,
      });
    } else {
      // Original too large to store fully — update the counts at least.
      upsert({
        ...original,
        status: 'done',
        totalImported: (original.totalImported ?? 0) + mapped.totalImported,
        totalSkipped: mapped.totalSkipped,
      });
    }
  }
  // The retry entry served its purpose — drop it.
  persist(loadHistory().filter((e) => e.id !== jobId));
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((e) => e.id !== id);
  persist(entries);
  return entries;
}
