import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { structureIdeaFromContent, analyzeIdeaAndSuggestImprovements } from '../services/ai.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(requireAuth);

// Helper to retrieve custom user API key if configured
async function getUserApiKey(userId: string): Promise<string | undefined> {
  const user = await db.users.findById(userId);
  if (user && (user as any).customApiKeyEncrypted) {
    try {
      return decryptSecret((user as any).customApiKeyEncrypted);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// GET /api/ideas - List ideas for current user
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, category, search } = req.query;
    const ideas = await db.ideas.findMany(req.user!.id, {
      status: typeof status === 'string' ? status : undefined,
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    res.json({ ideas });
  } catch (err: any) {
    console.error('[Ideas Route] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch ideas.' });
  }
});

// GET /api/ideas/:id - Get specific idea
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const idea = await db.ideas.findById(req.user!.id, req.params.id);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found.' });
      return;
    }
    res.json({ idea });
  } catch (err: any) {
    console.error('[Ideas Route] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch idea.' });
  }
});

// POST /api/ideas - Create new idea
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, category, status, tags, sections, chatId } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Idea title is required.' });
      return;
    }

    const idea = await db.ideas.create(req.user!.id, {
      title: title.trim(),
      category: category || 'Tech & AI',
      status: status || 'draft',
      tags: Array.isArray(tags) ? tags : [],
      sections: sections || {},
      chatId,
    });

    res.status(201).json({ idea });
  } catch (err: any) {
    console.error('[Ideas Route] POST / error:', err);
    res.status(500).json({ error: 'Failed to create idea.' });
  }
});

// PUT /api/ideas/:id - Update existing idea
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, category, status, tags, sections, changeNote, chatId } = req.body;

    const existing = await db.ideas.findById(req.user!.id, req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Idea not found.' });
      return;
    }

    const updated = await db.ideas.update(req.user!.id, req.params.id, {
      title,
      category,
      status,
      tags,
      sections,
      changeNote,
      chatId,
    });

    res.json({ idea: updated });
  } catch (err: any) {
    console.error('[Ideas Route] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update idea.' });
  }
});

// PATCH /api/ideas/:id/archive - Toggle archive state
router.patch('/:id/archive', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await db.ideas.findById(req.user!.id, req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Idea not found.' });
      return;
    }

    const idea = await db.ideas.archive(req.user!.id, req.params.id);
    res.json({ idea });
  } catch (err: any) {
    console.error('[Ideas Route] PATCH /:id/archive error:', err);
    res.status(500).json({ error: 'Failed to toggle archive state.' });
  }
});

// DELETE /api/ideas/:id - Delete idea
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await db.ideas.findById(req.user!.id, req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Idea not found.' });
      return;
    }

    const success = await db.ideas.delete(req.user!.id, req.params.id);
    res.json({ success });
  } catch (err: any) {
    console.error('[Ideas Route] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete idea.' });
  }
});

// POST /api/ideas/structure-from-text - AI extraction from raw text/conversation
router.post('/structure-from-text', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { content, category } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Content is required to structure an idea.' });
      return;
    }

    const customApiKey = await getUserApiKey(req.user!.id);
    const structured = await structureIdeaFromContent({
      content: content.trim(),
      category,
      customApiKey,
    });

    res.json({ structured });
  } catch (err: any) {
    console.error('[Ideas Route] POST /structure-from-text error:', err);
    res.status(500).json({ error: 'Failed to structure idea with AI.' });
  }
});

// POST /api/ideas/analyze - AI critique, missing info detection & improvements
router.post('/analyze', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { idea } = req.body;
    if (!idea || typeof idea !== 'object') {
      res.status(400).json({ error: 'Idea payload is required for analysis.' });
      return;
    }

    const customApiKey = await getUserApiKey(req.user!.id);
    const analysis = await analyzeIdeaAndSuggestImprovements({
      idea,
      customApiKey,
    });

    res.json({ analysis });
  } catch (err: any) {
    console.error('[Ideas Route] POST /analyze error:', err);
    res.status(500).json({ error: 'Failed to analyze idea.' });
  }
});

export default router;
