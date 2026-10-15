import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { transformText, generatePlanBreakdown, executeSkillPrompt, testAIConnection } from '../services/ai.js';
import { db } from '../db/connection.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(requireAuth);

// POST /api/ai/transform-text
router.post('/transform-text', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { text, action, tone, customPrompt } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text is required.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const output = await transformText({
      text,
      action: action || 'improve',
      tone,
      customPrompt,
      customApiKey: customKey,
      model,
    });

    res.json({ output, original: text, action });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI transformation failed.' });
  }
});

// POST /api/ai/generate-plan
router.post('/generate-plan', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { goal, category } = req.body;
    if (!goal) {
      res.status(400).json({ error: 'Goal is required.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const plan = await generatePlanBreakdown({
      goal,
      category,
      customApiKey: customKey,
      model,
    });

    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI plan generation failed.' });
  }
});

// POST /api/ai/execute-skill
router.post('/execute-skill', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptTemplate, text } = req.body;
    if (!promptTemplate || !text) {
      res.status(400).json({ error: 'Prompt template and text are required.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const output = await executeSkillPrompt({
      promptTemplate,
      text,
      customApiKey: customKey,
      model,
    });

    res.json({ output });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI execution failed.' });
  }
});

// GET /api/ai/models
router.get('/models', async (_req, res): Promise<void> => {
  res.json({
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Default)', description: 'Fastest, highly capable for text, reflections, and planning' },
      { id: 'gemini-4-argon', name: 'Gemini 4 Argon', description: 'Advanced reasoning and complex creative writing' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Ultra-low latency for quick edits' },
    ],
  });
});

export default router;
