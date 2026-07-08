import { Redis } from 'ioredis';
import { config } from '../config.js';
import type {
  ColumnMapping,
  ImportedRecord,
  RawRow,
  SkippedRecord,
} from '../types/crm.js';

export type JobStatus = 'processing' | 'done' | 'failed';

export interface ImportJob {
  id: string;
  status: JobStatus;
  createdAt: number;
  /** Last activity timestamp — used to detect jobs orphaned by a restart. */
  heartbeat: number;
  totalRows: number;
  totalBatches: number;
  batchesDone: number;
  batchStatus: Array<'pending' | 'done'>;
  /** Original rows — kept so unfinished batches can be re-run on resume. */
  rows: RawRow[];
  imported: ImportedRecord[];
  skipped: SkippedRecord[];
  /** Display-only: how CSV columns map to CRM fields (best effort). */
  columnMapping?: ColumnMapping[];
  error?: string;
}

export interface JobStore {
  readonly kind: 'redis' | 'memory';
  save(job: ImportJob): Promise<void>;
  get(id: string): Promise<ImportJob | null>;
  listJobIds(): Promise<string[]>;
}

const PREFIX = 'groweasy:job:';

class RedisJobStore implements JobStore {
  readonly kind = 'redis' as const;
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
    this.redis.on('error', (err) => console.error('[redis]', err.message));
  }

  async save(job: ImportJob): Promise<void> {
    await this.redis.set(
      PREFIX + job.id,
      JSON.stringify(job),
      'EX',
      config.jobTtlSeconds
    );
  }

  async get(id: string): Promise<ImportJob | null> {
    const raw = await this.redis.get(PREFIX + id);
    return raw ? (JSON.parse(raw) as ImportJob) : null;
  }

  async listJobIds(): Promise<string[]> {
    const ids: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${PREFIX}*`,
        'COUNT',
        100
      );
      cursor = next;
      for (const key of keys) ids.push(key.slice(PREFIX.length));
    } while (cursor !== '0');
    return ids;
  }
}

/** Fallback when REDIS_URL is not configured. Jobs die with the process. */
class MemoryJobStore implements JobStore {
  readonly kind = 'memory' as const;
  private jobs = new Map<string, { job: ImportJob; expiresAt: number }>();

  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.jobs) {
      if (entry.expiresAt <= now) this.jobs.delete(id);
    }
  }

  async save(job: ImportJob): Promise<void> {
    this.sweep();
    this.jobs.set(job.id, {
      job,
      expiresAt: Date.now() + config.jobTtlSeconds * 1000,
    });
  }

  async get(id: string): Promise<ImportJob | null> {
    this.sweep();
    return this.jobs.get(id)?.job ?? null;
  }

  async listJobIds(): Promise<string[]> {
    this.sweep();
    return [...this.jobs.keys()];
  }
}

export const jobStore: JobStore = config.redisUrl
  ? new RedisJobStore(config.redisUrl)
  : new MemoryJobStore();
