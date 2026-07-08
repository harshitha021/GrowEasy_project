'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { CRM_FIELDS, CRM_STATUSES, DATA_SOURCES, type ImportSummary } from '@/types';
import { ColumnMappingPanel } from './ColumnMappingPanel';
import { DataTable } from './DataTable';
import { StatsCards } from './StatsCards';

const escapeCsv = (v: string) =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

function buildCsv(headers: string[], rows: Array<Record<string, string>>): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Union of raw-row columns across skipped records, preserving first-seen order. */
function skippedColumns(summary: ImportSummary): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const s of summary.skipped) {
    for (const key of Object.keys(s.raw)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }
  return cols;
}

export function ResultsView({
  summary,
  onReset,
  onEditRecord,
  onEditSkipped,
  onRetrySkipped,
}: {
  summary: ImportSummary;
  onReset: () => void;
  onEditRecord?: (recordIndex: number, field: string, value: string) => void;
  onEditSkipped?: (recordIndex: number, column: string, value: string) => void;
  onRetrySkipped?: () => void;
}) {
  const [tab, setTab] = useState<'imported' | 'skipped'>('imported');
  const [editing, setEditing] = useState(false);

  const canEdit =
    tab === 'imported'
      ? Boolean(onEditRecord) && summary.totalImported > 0
      : Boolean(onEditSkipped) && summary.totalSkipped > 0;

  const downloadImported = () => {
    downloadCsv(
      buildCsv(
        [...CRM_FIELDS],
        summary.imported.map(({ rowIndex: _rowIndex, ...rec }) => rec)
      ),
      'groweasy_crm_import.csv'
    );
  };

  const rawColumns = skippedColumns(summary);

  /** Original columns only — so the file can be fixed and re-uploaded as-is. */
  const downloadSkipped = () => {
    downloadCsv(
      buildCsv(rawColumns, summary.skipped.map((s) => s.raw)),
      'groweasy_skipped_rows.csv'
    );
  };

  // Skipped table: skip reason first, then every original CSV column.
  const skippedHeaders = ['skip reason', ...rawColumns];
  const skippedRows = summary.skipped.map((s) => ({
    'skip reason': s.reason,
    ...s.raw,
  }));

  return (
    <div className="space-y-6">
      {/* Success banner with drawn checkmark */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="flex items-center justify-center gap-2.5"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.15 }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15"
        >
          <svg className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </motion.span>
        <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">
          Import complete — {summary.totalImported} of {summary.totalRows} leads converted to CRM format
        </p>
      </motion.div>

      <StatsCards summary={summary} />

      {summary.columnMapping && summary.columnMapping.length > 0 && (
        <ColumnMappingPanel mapping={summary.columnMapping} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
          {(['imported', 'skipped'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {tab === t && (
                <motion.span
                  layoutId="results-tab-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 shadow-sm shadow-indigo-500/25"
                />
              )}
              <span className="relative">
                {t}{' '}
                <span className="tabular-nums">
                  ({t === 'imported' ? summary.totalImported : summary.totalSkipped})
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition ${
                editing
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              {editing ? 'Done editing' : 'Edit'}
            </button>
          )}
          {tab === 'imported' ? (
            <button
              type="button"
              onClick={downloadImported}
              disabled={summary.totalImported === 0}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download CRM CSV
            </button>
          ) : (
            <>
              {onRetrySkipped && summary.totalSkipped > 0 && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setEditing(false);
                    onRetrySkipped();
                  }}
                  title="Re-run only these rows through the AI (edit them first to fix issues)"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Retry {summary.totalSkipped} skipped
                </motion.button>
              )}
              <button
                type="button"
                onClick={downloadSkipped}
                disabled={summary.totalSkipped === 0}
                title="Original columns only — fix the rows and re-upload the file"
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-amber-500/25 transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download skipped CSV
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Import another file
          </button>
        </div>
      </div>

      {tab === 'imported' ? (
        <DataTable
          headers={[...CRM_FIELDS]}
          rows={summary.imported.map(({ rowIndex: _rowIndex, ...rec }) => rec)}
          rowNumbers={summary.imported.map((r) => r.rowIndex)}
          emptyMessage="No records were imported."
          editable={editing}
          onCellChange={onEditRecord}
          selectOptions={{ crm_status: CRM_STATUSES, data_source: DATA_SOURCES }}
        />
      ) : (
        <div className="space-y-3">
          {summary.totalSkipped > 0 && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              These rows could not be imported — the first column explains why.
              Click <span className="font-medium">Edit</span> to fix them right here
              (add a missing phone/email), then hit{' '}
              <span className="font-medium">Retry</span> to re-run them through the
              AI — or download, fix, and re-upload.
            </p>
          )}
          <DataTable
            headers={skippedHeaders}
            rows={skippedRows}
            rowNumbers={summary.skipped.map((s) => s.rowIndex)}
            emptyMessage="No records were skipped — every row was imported."
            editable={editing}
            onCellChange={onEditSkipped}
            readOnlyColumns={['skip reason']}
          />
        </div>
      )}
    </div>
  );
}
