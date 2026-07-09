'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface DataTableProps {
  headers: string[];
  rows: Array<Record<string, string>>;
  /** Optional leading column of row numbers. */
  rowNumbers?: number[];
  maxHeightClass?: string;
  emptyMessage?: string;
  /** When true, cells render as inputs; commits on blur/Enter. */
  editable?: boolean;
  onCellChange?: (rowIndex: number, header: string, value: string) => void;
  /** Columns rendered as a dropdown instead of a free-text input. */
  selectOptions?: Record<string, readonly string[]>;
  /** Columns that stay read-only even in edit mode. */
  readOnlyColumns?: readonly string[];
  /** Per-column value → badge classes; matching values render as colored pills. */
  badgeStyles?: Record<string, Record<string, string>>;
}

/** Above this row count, only visible rows are rendered (virtualization). */
const VIRTUALIZE_THRESHOLD = 100;
/** Estimated row height in px (text-sm + py-2). Refined per-row by measurement. */
const ESTIMATED_ROW_HEIGHT = 37;

/**
 * Responsive data table: horizontal + vertical scrolling, sticky header,
 * zebra rows, dark mode. Large datasets are virtualized — only the rows in
 * view (plus overscan) exist in the DOM, so a 5,000-row CSV scrolls smoothly.
 * Uses spacer rows above/below the visible window to preserve native table
 * layout (and the sticky header) instead of absolute positioning.
 */
export function DataTable({
  headers,
  rows,
  rowNumbers,
  maxHeightClass = 'max-h-[26rem]',
  emptyMessage = 'No rows to display.',
  editable = false,
  onCellChange,
  selectOptions,
  readOnlyColumns,
  badgeStyles,
}: DataTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  const virtualItems = virtualize ? virtualizer.getVirtualItems() : null;
  const paddingTop = virtualItems && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems && virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;
  const indices = virtualItems
    ? virtualItems.map((v) => v.index)
    : rows.map((_, i) => i);

  return (
    <div
      ref={scrollRef}
      className={`table-scroll overflow-auto rounded-2xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/95 ${maxHeightClass}`}
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100 dark:bg-zinc-900">
            {rowNumbers && (
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/15 dark:text-zinc-400">
                #
              </th>
            )}
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/15 dark:text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden style={{ height: paddingTop }} />
          )}
          {indices.map((i) => {
            const row = rows[i];
            return (
              <motion.tr
                key={i}
                data-index={i}
                ref={virtualize ? virtualizer.measureElement : undefined}
                initial={!virtualize && i < 14 ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i, 14) * 0.035,
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`${
                  i % 2 === 0
                    ? 'bg-white dark:bg-zinc-950'
                    : 'bg-slate-50 dark:bg-zinc-900/40'
                } hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40`}
              >
                {rowNumbers && (
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-400 dark:text-zinc-500">
                    {rowNumbers[i]}
                  </td>
                )}
                {headers.map((h) =>
                  editable && onCellChange && !readOnlyColumns?.includes(h) ? (
                    <td key={h} className="whitespace-nowrap px-1.5 py-1">
                      {selectOptions?.[h] ? (
                        <select
                          value={row[h] ?? ''}
                          onChange={(e) => onCellChange(i, h, e.target.value)}
                          className="w-full min-w-[10rem] rounded-md border border-indigo-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none dark:border-indigo-500/30 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          <option value="">—</option>
                          {selectOptions[h].map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          // Remount when the committed value changes (e.g. via scroll
                          // re-render) — uncontrolled while typing, cheap to render.
                          key={`${i}-${h}-${row[h]}`}
                          defaultValue={row[h] ?? ''}
                          onBlur={(e) => {
                            if (e.target.value !== (row[h] ?? '')) {
                              onCellChange(i, h, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') {
                              e.currentTarget.value = row[h] ?? '';
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full min-w-[8rem] rounded-md border border-indigo-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none dark:border-indigo-500/30 dark:bg-zinc-900 dark:text-zinc-200"
                        />
                      )}
                    </td>
                  ) : (
                    <td
                      key={h}
                      className="max-w-xs truncate whitespace-nowrap px-3 py-2 text-slate-700 dark:text-zinc-300"
                      title={row[h]}
                    >
                      {badgeStyles?.[h]?.[row[h]] ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyles[h][row[h]]}`}
                        >
                          {row[h]}
                        </span>
                      ) : (
                        row[h] || <span className="text-slate-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                  )
                )}
              </motion.tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden style={{ height: paddingBottom }} />
          )}
        </tbody>
      </table>
    </div>
  );
}