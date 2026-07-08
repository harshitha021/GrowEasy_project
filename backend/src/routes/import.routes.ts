import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import {
  parseHandler,
  createImportJobHandler,
  getJobHandler,
  streamJobHandler,
} from '../controllers/import.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (ok) cb(null, true);
    else cb(new Error('Only .csv files are accepted'));
  },
});

export const importRouter = Router();

importRouter.post('/parse', upload.single('file'), parseHandler);
importRouter.post('/import', createImportJobHandler);
importRouter.get('/import/:id', getJobHandler);
importRouter.get('/import/:id/stream', streamJobHandler);
