import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { initDatabase } from './src/server/db/connection.js';
import authRoutes from './src/server/routes/auth.js';
import diaryRoutes from './src/server/routes/diaries.js';
import planRoutes from './src/server/routes/plans.js';
import bookRoutes from './src/server/routes/books.js';
import skillRoutes from './src/server/routes/skills.js';
import chatRoutes from './src/server/routes/chats.js';
import aiRoutes from './src/server/routes/ai.js';
import dashboardRoutes from './src/server/routes/dashboard.js';
import healthRoutes from './src/server/routes/health.js';
import ideaRoutes from './src/server/routes/ideas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // CRITICAL: AI Studio reverse proxy (Nginx) forwards to port 3000.
  // process.env.PORT is often set to 8080 in container environments, so we strictly bind port 3000.
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize Database (MongoDB / Mongoose or persistent local fallback)
  const dbInit = await initDatabase();
  console.log(`[LifeNote AI] Database mode: ${dbInit.type} (${dbInit.message})`);

  // Mount API Endpoints
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/diaries', diaryRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/books', bookRoutes);
  app.use('/api/skills', skillRoutes);
  app.use('/api/ideas', ideaRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/ai', aiRoutes);

  // Database & server error middleware for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      err.name === 'MongooseError' ||
      err.name === 'MongoNetworkError' ||
      (err.message && err.message.includes('buffering timed out'))
    ) {
      console.warn('[AI Studio] Database offline — returning mock empty response');
      if (req.method === 'GET') {
        return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
      }
      return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
    }
    if (req.path.startsWith('/api')) {
      console.error('[LifeNote AI] API error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
    next(err);
  });

  // Global API error handler for unmatched /api requests
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Vite middleware in dev or static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Explicit fallback to ensure index.html is transformed and served without delay
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LifeNote AI] Server successfully listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[LifeNote AI] Fatal server startup error:', err);
  process.exit(1);
});
