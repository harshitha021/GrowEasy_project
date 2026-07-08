import crypto from 'node:crypto';
import { config } from '../config.js';
import { extractBatch, extractColumnMapping, makeBatches } from './aiExtractor.js';
import { validateRecords } from './validator.js';
import { jobStore, type ImportJob } from './jobStore.js';
import type { ImportSummary, RawRow } from '../types/crm.js';

/** Jobs actively being processed by THIS process (avoid double-processing). */
const locallyProcessing = new Set<string>();

/** A processing job with no heartbeat for this long is considered orphaned. */
const STALE_MS = 30_000;

export async function startJob(rows: RawRow[]): Promise<ImportJob> {
  const totalBatches = Math.ceil(rows.length / config.batchSize);
  const job: ImportJob = {
    id: crypto.randomUUID(),
    status: 'processing',
    createdAt: Date.now(),
    heartbeat: Date.now(),
    totalRows: rows.length,
    totalBatches,
    batchesDone: 0,
    batchStatus: Array<'pending' | 'done'>(totalBatches).fill('pending'),
    rows,
    imported: [],
    skipped: [],
  };
  await jobStore.save(job);
  void processJob(job);
  return job;
}

/**
 * Process all still-pending batches of a job with limited concurrency.
 * Safe to call on a partially finished job (resume after restart): completed
 * batches are skipped, only pending ones are re-run.
 */
async function processJob(job: ImportJob): Promise<void> {
  if (locallyProcessing.has(job.id)) return;
  locallyProcessing.add(job.id);
  try {
    const batches = makeBatches(job.rows);
    const rowsByIndex = new Map<number, RawRow>(job.rows.map((r, i) => [i + 1, r]));
    const pending = batches
      .map((batch, index) => ({ batch, index }))
      .filter(({ index }) => job.batchStatus[index] === 'pending');

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < pending.length) {
        const { batch, index } = pending[cursor++];
        try {
          const records = await extractBatch(batch);
          const outcome = validateRecords(records, rowsByIndex);
          job.imported.push(...outcome.imported);
          job.skipped.push(...outcome.skipped);

          const returned = new Set(records.map((r) => Number(r.row_index)));
          for (const r of batch) {
            if (!returned.has(r.row_index)) {
              const { row_index, ...raw } = r;
              job.skipped.push({
                rowIndex: row_index,
                raw: raw as RawRow,
                reason: 'AI did not return this row',
              });
            }
          }
        } catch (err) {
          // Batch failed after all retries -> its rows are skipped with reason.
          for (const r of batch) {
            const { row_index, ...raw } = r;
            job.skipped.push({
              rowIndex: row_index,
              raw: raw as RawRow,
              reason: (err as Error).message,
            });
          }
        }
        job.batchStatus[index] = 'done';
        job.batchesDone += 1;
        job.heartbeat = Date.now();
        await jobStore.save(job);
      }
    };

    // Column mapping (display-only) runs in parallel with the batch pool —
    // failures are tolerated, the import itself never depends on it.
    const mappingPromise = job.columnMapping
      ? Promise.resolve()
      : extractColumnMapping(Object.keys(job.rows[0] ?? {}), job.rows.slice(0, 3))
          .then((mapping) => {
            job.columnMapping = mapping;
          })
          .catch((err) =>
            console.warn('[jobs] column mapping failed:', (err as Error).message)
          );

    await Promise.all([
      mappingPromise,
      ...Array.from(
        { length: Math.min(config.maxConcurrentBatches, Math.max(pending.length, 1)) },
        () => worker()
      ),
    ]);

    job.imported.sort((a, b) => a.rowIndex - b.rowIndex);
    job.skipped.sort((a, b) => a.rowIndex - b.rowIndex);
    job.status = 'done';
    job.heartbeat = Date.now();
    await jobStore.save(job);
  } catch (err) {
    job.status = 'failed';
    job.error = (err as Error).message;
    job.heartbeat = Date.now();
    await jobStore.save(job).catch(() => {});
  } finally {
    locallyProcessing.delete(job.id);
  }
}

export async function getJob(id: string): Promise<ImportJob | null> {
  return jobStore.get(id);
}

/** Resume a job orphaned by a crash/restart (stale heartbeat, still processing). */
export function maybeResumeJob(job: ImportJob): void {
  if (
    job.status === 'processing' &&
    !locallyProcessing.has(job.id) &&
    Date.now() - job.heartbeat > STALE_MS
  ) {
    console.log(
      `[jobs] resuming orphaned job ${job.id} (${job.batchesDone}/${job.totalBatches} batches done)`
    );
    void processJob(job);
  }
}

/** Startup sweep: pick up any jobs left processing by a previous process. */
export async function resumeStaleJobs(): Promise<void> {
  const ids = await jobStore.listJobIds();
  for (const id of ids) {
    const job = await jobStore.get(id);
    if (job) maybeResumeJob(job);
  }
}

export function toProgress(job: ImportJob) {
  return {
    batchesDone: job.batchesDone,
    totalBatches: job.totalBatches,
    rowsProcessed: job.imported.length + job.skipped.length,
    totalRows: job.totalRows,
  };
}

export function toSummary(job: ImportJob): ImportSummary {
  return {
    imported: job.imported,
    skipped: job.skipped,
    totalImported: job.imported.length,
    totalSkipped: job.skipped.length,
    totalRows: job.totalRows,
    ...(job.columnMapping ? { columnMapping: job.columnMapping } : {}),
  };
}
