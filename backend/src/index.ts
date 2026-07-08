import { createApp } from './app.js';
import { config } from './config.js';
import { jobStore } from './services/jobStore.js';
import { resumeStaleJobs } from './services/jobProcessor.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Job store: ${jobStore.kind}${jobStore.kind === 'memory' ? ' (set REDIS_URL for restart-proof jobs)' : ''}`);
  resumeStaleJobs().catch((err) =>
    console.error('[jobs] startup sweep failed:', (err as Error).message)
  );
  console.log(`GrowEasy CSV Importer backend listening on http://localhost:${config.port}`);
  if (!config.azureApiKey || !config.azureEndpoint) {
    console.warn('\u26a0\ufe0f  Azure OpenAI credentials not set — /api/import will fail. Copy .env.example to .env');
  }
});
