import { Router } from 'express';
import { getDatabaseStatus } from '../db/connection.js';

const router = Router();

router.get('/', (_req, res) => {
  const dbStatus = getDatabaseStatus();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  res.json({
    status: 'ok',
    name: 'LifeNote AI API',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    ai: {
      hasDefaultKey: hasGeminiKey,
      provider: 'Google Gemini (@google/genai)',
      defaultModel: 'gemini-3.8-flash',
    },
  });
});

export default router;
