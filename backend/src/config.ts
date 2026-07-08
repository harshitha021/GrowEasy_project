import dotenv from 'dotenv';

dotenv.config();

const intFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: intFromEnv('PORT', 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  azureApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
  azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
  azureDeployment: process.env.AZURE_DEPLOYMENT ?? 'o4-mini',
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
  /** Optional Redis URL — enables resumable jobs across server restarts. */
  redisUrl: process.env.REDIS_URL ?? '',
  /** How long finished/abandoned jobs are kept (seconds). */
  jobTtlSeconds: intFromEnv('JOB_TTL_SECONDS', 3600),
  batchSize: intFromEnv('BATCH_SIZE', 20),
  maxConcurrentBatches: intFromEnv('MAX_CONCURRENT_BATCHES', 3),
  maxRetries: intFromEnv('MAX_RETRIES', 3),
  /** Max upload size in bytes (10 MB) */
  maxUploadBytes: 10 * 1024 * 1024,
  /** Hard cap on number of data rows accepted per import */
  maxRows: 5000,
} as const;

export function assertAiConfigured(): void {
  if (!config.azureApiKey || !config.azureEndpoint) {
    throw new Error(
      'AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT are not set. Copy backend/.env.example to backend/.env and add your credentials.'
    );
  }
}
