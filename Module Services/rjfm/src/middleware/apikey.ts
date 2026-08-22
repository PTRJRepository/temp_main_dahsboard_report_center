// Auth untuk gateway service-to-service: API key statis dari .env (RJFM_API_KEY).
// Header: x-api-key: <key>  (atau Authorization: ApiKey <key>)
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      apiKeyUsed?: string;
    }
  }
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!env.apiKey) {
    return res.status(503).json({ status: 'error', message: 'Gateway dinonaktifkan — RJFM_API_KEY belum di-set di .env' });
  }
  const hdr = req.headers['x-api-key'] as string || '';
  const alt = (req.headers.authorization || '').toString();
  const key = hdr.trim() || (alt.startsWith('ApiKey ') ? alt.slice(7).trim() : '');
  if (!key) return res.status(401).json({ status: 'error', message: 'API key required (header x-api-key)' });
  if (key !== env.apiKey) return res.status(401).json({ status: 'error', message: 'API key tidak valid' });
  req.apiKeyUsed = key;
  next();
}
