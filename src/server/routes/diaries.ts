import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { transformText } from '../services/ai.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();

// All diary routes require authentication and strictly scope to req.user.id
router.use(requireAuth);

// GET /api/diaries
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, tag, mood } = req.query;
    const entries = await db.diaries.findMany(
      req.user!.id,
      typeof search === 'string' ? search : undefined,
      typeof tag === 'string' ? tag : undefined,
      typeof mood === 'string' ? mood : undefined
    );
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diary entries.' });
  }
});

// POST /api/diaries
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, mood, weather, tags, location, date, favorite } = req.body;
    if (!content && !title) {
      res.status(400).json({ error: 'Title or content is required.' });
      return;
    }

    const entry = await db.diaries.create(req.user!.id, {
      title: title || 'Untitled Entry',
      content: content || '',
      mood: mood || 'thoughtful',
      weather: weather || 'sunny',
      tags: Array.isArray(tags) ? tags : [],
      location: location || '',
      date: date || new Date().toISOString().split('T')[0],
      favorite: !!favorite,
    });

    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create diary entry.' });
  }
});

// GET /api/diaries/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const entry = await db.diaries.findById(req.user!.id, req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Diary entry not found.' });
      return;
    }
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diary entry.' });
  }
});

// PUT /api/diaries/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, mood, weather, tags, location, date, favorite } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (mood !== undefined) updates.mood = mood;
    if (weather !== undefined) updates.weather = weather;
    if (tags !== undefined) updates.tags = tags;
    if (location !== undefined) updates.location = location;
    if (date !== undefined) updates.date = date;
    if (favorite !== undefined) updates.favorite = favorite;

    const updated = await db.diaries.update(req.user!.id, req.params.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Diary entry not found or unauthorized.' });
      return;
    }

    res.json({ entry: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update diary entry.' });
  }
});

// DELETE /api/diaries/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await db.diaries.delete(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Diary entry not found or unauthorized.' });
      return;
    }
    res.json({ success: true, message: 'Diary entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete diary entry.' });
  }
});

// POST /api/diaries/:id/ai-refine
router.post('/:id/ai-refine', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { action, tone, customText } = req.body;
    const entry = await db.diaries.findById(req.user!.id, req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Diary entry not found.' });
      return;
    }

    const textToProcess = customText || entry.content;
    if (!textToProcess) {
      res.status(400).json({ error: 'No content to refine.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const refined = await transformText({
      text: textToProcess,
      action: action || 'improve',
      tone,
      customApiKey: customKey,
      model,
    });

    res.json({
      original: textToProcess,
      refined,
      action,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI refinement failed.' });
  }
});

export default router;
