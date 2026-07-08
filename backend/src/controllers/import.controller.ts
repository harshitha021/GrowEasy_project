import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config, assertAiConfigured } from '../config.js';
import { parseCsvBuffer } from '../services/csvParser.js';
import {
  getJob,
  maybeResumeJob,
  startJob,
  toProgress,
  toSummary,
} from '../services/jobProcessor.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { RawRow } from '../types/crm.js';

/** POST /api/parse — multipart CSV upload -> headers + rows for preview. No AI. */
export function parseHandler(req: Request, res: Response): void {
  if (!req.file) {
    throw new HttpError(400, 'No file uploaded. Send the CSV as multipart field "file".');
  }
  const result = parseCsvBuffer(req.file.buffer);
  res.json(result);
}

const importBodySchema = z.object({
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, 'rows must contain at least one row')
    .max(config.maxRows, `rows cannot exceed ${config.maxRows}`),
});

/**
 * POST /api/import — creates a background import job and returns its id
 * immediately. Progress/results are consumed via GET /api/import/:id/stream,
 * so a page reload (or even a server restart, with Redis) can resume.
 */
export async function createImportJobHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsed = importBodySchema.safeParse(req.body);
  if (!parsed.success) {
    next(new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid request body'));
    return;
  }
  try {
    assertAiConfigured();
  } catch (err) {
    next(new HttpError(500, (err as Error).message));
    return;
  }

  const job = await startJob(parsed.data.rows as RawRow[]);
  res.status(202).json({ jobId: job.id });
}

/** GET /api/import/:id — JSON snapshot of a job (poll fallback). */
export async function getJobHandler(req: Request, res: Response): Promise<void> {
  const job = await getJob(req.params.id);
  if (!job) {
    throw new HttpError(404, 'Job not found or expired.');
  }
  maybeResumeJob(job);
  res.json({
    jobId: job.id,
    status: job.status,
    progress: toProgress(job),
    ...(job.status === 'done' ? { summary: toSummary(job) } : {}),
    ...(job.status === 'failed' ? { error: job.error } : {}),
  });
}

function sseWrite(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 700;

/**
 * GET /api/import/:id/stream — SSE stream of a job's progress.
 * Emits: progress (on every change), done (final summary), fatal, not_found.
 * Reconnecting after a reload replays current state, then live-tails.
 */
export async function streamJobHandler(req: Request, res: Response): Promise<void> {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) clientGone = true;
  });

  let job = await getJob(req.params.id);
  if (!job) {
    // 200 + explicit event (not HTTP 404) so EventSource doesn't retry forever.
    sseWrite(res, 'not_found', {});
    res.end();
    return;
  }

  // If this job was orphaned by a restart, this reconnect revives it.
  maybeResumeJob(job);

  let lastBatchesDone = -1;
  while (!clientGone) {
    if (job.batchesDone !== lastBatchesDone) {
      lastBatchesDone = job.batchesDone;
      sseWrite(res, 'progress', toProgress(job));
    }
    if (job.status !== 'processing') break;
    await sleep(POLL_MS);
    job = await getJob(req.params.id);
    if (!job) {
      sseWrite(res, 'not_found', {});
      res.end();
      return;
    }
  }

  if (clientGone) return; // job keeps running server-side

  if (job.status === 'done') {
    sseWrite(res, 'done', toSummary(job));
  } else {
    sseWrite(res, 'fatal', { error: job.error ?? 'Import failed.' });
  }
  res.end();
}
