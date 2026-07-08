import type { ImportProgress, ImportSummary, ParseResult, RawRow } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

/** Upload a CSV file for parsing/preview. No AI involved. */
export async function parseCsv(file: File): Promise<ParseResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/parse`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ParseResult;
}

/** Start a background import job. Returns the job id immediately. */
export async function startImport(rows: RawRow[]): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
  } catch {
    throw new Error('Could not reach the server. Is the backend running?');
  }
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { jobId: string };
  return body.jobId;
}

export interface JobCallbacks {
  onProgress: (p: ImportProgress) => void;
  onDone: (summary: ImportSummary) => void;
  onError: (message: string) => void;
  /** Job expired or never existed (e.g. memory store + server restart). */
  onNotFound: () => void;
}

/**
 * Subscribe to a job's SSE stream. EventSource reconnects automatically on
 * connection loss (including a server restart mid-job), which is exactly what
 * makes the import resumable. Returns an unsubscribe function.
 */
export function subscribeToJob(jobId: string, cb: JobCallbacks): () => void {
  const es = new EventSource(
    `${API_URL}/api/import/${encodeURIComponent(jobId)}/stream`
  );

  es.addEventListener('progress', (e) => {
    cb.onProgress(JSON.parse((e as MessageEvent).data) as ImportProgress);
  });
  es.addEventListener('done', (e) => {
    es.close();
    cb.onDone(JSON.parse((e as MessageEvent).data) as ImportSummary);
  });
  es.addEventListener('fatal', (e) => {
    es.close();
    const data = JSON.parse((e as MessageEvent).data) as { error?: string };
    cb.onError(data.error ?? 'Import failed.');
  });
  es.addEventListener('not_found', () => {
    es.close();
    cb.onNotFound();
  });
  // Transient errors: EventSource retries on its own — no action needed.

  return () => es.close();
}
