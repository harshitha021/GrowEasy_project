'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  parsing: boolean;
}

/** Tilted icon-card cluster that spreads apart while dragging. */
const ICON_TRANSFORMS = [
  { idle: 'translate(-78%, -50%) rotate(-8deg)', active: 'translate(-114%, -50%) rotate(-12deg) scale(1.08)' },
  { idle: 'translate(-50%, -50%) rotate(0deg)', active: 'translate(-50%, -50%) rotate(0deg) scale(1.18)' },
  { idle: 'translate(-22%, -50%) rotate(8deg)', active: 'translate(14%, -50%) rotate(12deg) scale(1.08)' },
];

const ICONS = [
  // spreadsheet grid
  <path key="a" strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25A1.5 1.5 0 015.25 3.75h13.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25zM3.75 9h16.5M3.75 15h16.5M9.75 3.75v16.5" />,
  // document with rows
  <path key="b" strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m1.5 12h6m-6 3h3.75M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
  // users / leads
  <path key="c" strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
];

export function FileDropzone({ onFile, parsing }: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setLocalError('Only .csv files are supported here.');
        return;
      }
      setLocalError(null);
      onFile(file);
    },
    [onFile]
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative rounded-[1.25rem]">
        {/* Glow aura while dragging */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-1 rounded-[1.5rem] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 blur-md transition-opacity duration-300 ${
            dragOver ? 'opacity-50' : 'opacity-0'
          }`}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload CSV file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragOver(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragOver(false);
            accept(e.dataTransfer.files[0]);
          }}
          className={`relative flex min-h-72 cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-[1.25rem] border border-dashed px-6 py-12 text-center backdrop-blur-sm transition-[border-color,background-color] duration-200 ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50/80 dark:border-indigo-500 dark:bg-indigo-950/40'
              : 'border-slate-300 bg-white/80 hover:border-indigo-400/70 hover:bg-slate-50/80 dark:border-white/15 dark:bg-zinc-950/70 dark:hover:border-indigo-500/60 dark:hover:bg-zinc-900/50'
          }`}
        >
          {parsing ? (
            <>
              <svg className="h-10 w-10 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">Parsing your CSV…</p>
            </>
          ) : (
            <>
              {/* Icon cluster — gentle idle float, spreads on drag */}
              <motion.div
                className="relative h-14 w-36"
                animate={dragOver ? { y: 0 } : { y: [0, -5, 0] }}
                transition={
                  dragOver
                    ? { duration: 0.2 }
                    : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                }
              >
                {ICONS.map((icon, i) => (
                  <div
                    key={i}
                    className={`absolute top-1/2 left-1/2 grid size-12 place-items-center rounded-xl border bg-white text-slate-400 shadow-sm transition-[transform,color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-500 ${
                      i === 1 ? 'z-10' : ''
                    } ${dragOver ? 'text-indigo-600 shadow-lg shadow-indigo-500/20 dark:text-indigo-400' : ''}`}
                    style={{ transform: dragOver ? ICON_TRANSFORMS[i].active : ICON_TRANSFORMS[i].idle }}
                  >
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      {icon}
                    </svg>
                  </div>
                ))}
              </motion.div>

              <div className="space-y-1.5">
                <p className="text-base font-semibold text-slate-800 dark:text-zinc-100">
                  {dragOver ? 'Drop it here' : 'Click to upload or drop your CSV'}
                </p>
                <p className="mx-auto max-w-sm text-sm text-slate-500 dark:text-zinc-400">
                  Facebook leads, Google Ads exports, CRM dumps, Excel sheets — any
                  valid CSV works
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {dragOver ? 'Release to upload' : 'Browse files'}
              </span>

              <p className="text-xs text-slate-400 dark:text-zinc-500">.csv up to 10 MB · 5,000 rows</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {localError && (
        <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{localError}</p>
      )}
    </div>
  );
}
