import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { importRouter } from './routes/import.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
    })
  );
  app.use(express.json({ limit: '20mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', aiConfigured: Boolean(config.azureApiKey && config.azureEndpoint) });
  });

  app.use('/api', importRouter);

  app.use(errorHandler);
  return app;
}
