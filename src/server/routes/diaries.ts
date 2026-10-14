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

    const targetDate = date ? String(date).split('T')[0].trim() : new Date().toISOString().split('T')[0];
    const existing = await db.diaries.findByDate(req.user!.id, targetDate);

    if (existing) {
      const existingId = existing.id || (existing as any)._id;
      const updated = await db.diaries.update(req.user!.id, existingId, {
        title: title || existing.title,
        content: content !== undefined ? content : existing.content,
        mood: mood || existing.mood,
        weather: weather || existing.weather,
        tags: Array.isArray(tags) ? tags : existing.tags,
        location: location !== undefined ? location : existing.location,
        favorite: favorite !== undefined ? !!favorite : existing.favorite,
        date: targetDate,
      });
      res.status(200).json({ entry: updated });
      return;
    }

    const entry = await db.diaries.create(req.user!.id, {
      title: title || `Journal: ${targetDate}`,
      content: content || '',
      mood: mood || 'thoughtful',
      weather: weather || 'sunny',
      tags: Array.isArray(tags) ? tags : [],
      location: location || '',
      date: targetDate,
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

// GET /api/diaries/by-date/:date
router.get('/by-date/:date', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rawDate = req.params.date ? String(req.params.date).split('T')[0].trim() : '';
    const entry = await db.diaries.findByDate(req.user!.id, rawDate);
    res.json({ entry: entry || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diary entry by date.' });
  }
});

// POST /api/diaries/ai-update-page
// Appends or updates the diary text for a specific date given the user's message and current content
router.post('/ai-update-page', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { date, currentContent, userMessage } = req.body;
    if (!userMessage || !userMessage.trim()) {
      res.status(400).json({ error: 'User message is required.' });
      return;
    }

    const targetDate = date ? String(date).split('T')[0].trim() : new Date().toISOString().split('T')[0];
    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const prompt = `You are LifeNote AI, a thoughtful and personal diary companion.
A diary is strictly organized by DATE. Each calendar day has ONE single continuous page (one sheet of paper for this date).
Target Date: ${targetDate}

=== PREVIOUS DIARY TEXT FOR THIS DAY (${targetDate}) ===
${currentContent && currentContent.trim() ? currentContent.trim() : '(No writing recorded yet for this date - this is the start of today\'s page)'}

=== USER'S MESSAGE / UPDATE INSTRUCTION ===
"${userMessage.trim()}"

TASK:
1. If this is the start of this date's diary (no previous text), write a warm, beautifully composed, personal first-person journal entry reflecting what the user shared.
2. If there is already previous text for this day:
   - When the user shares new events, feelings, or thoughts, append and naturally weave them into today's continuous page without deleting previous events.
   - When the user asks to update, correct, or change existing information (e.g. changing times, dates, friend names, locations, or details), update that specific information while preserving the rest of the day's record intact.
   - Maintain the author's personal voice, tone, and emotional authenticity.
3. Return ONLY a valid JSON object matching this schema (no markdown wrap):
{
  "updatedContent": "Complete updated text for this date's page",
  "explanation": "Brief 1-sentence note of what was added or updated",
  "title": "Short title or theme for this day (optional, e.g. 'Productive workday and evening walk')",
  "mood": "thoughtful"
}`;

    const aiResult = await transformText({
      text: prompt,
      action: 'improve',
      customApiKey: customKey,
      model,
    });

    let parsed: any = { updatedContent: '', explanation: '', title: '', mood: 'thoughtful' };
    try {
      const cleaned = aiResult.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        updatedContent: currentContent ? `${currentContent}\n\n${aiResult}` : aiResult,
        explanation: 'Updated diary page with your thoughts.',
        title: `Journal: ${targetDate}`,
        mood: 'thoughtful',
      };
    }

    const finalContent = (parsed.updatedContent || aiResult || '').trim();
    const explanation = parsed.explanation || 'Diary page updated.';
    const finalTitle = parsed.title || `Journal: ${targetDate}`;
    const finalMood = parsed.mood || 'thoughtful';

    // Auto-persist entry for this date in db.diaries
    const userDiaries = await db.diaries.findMany(req.user!.id);
    let existing = userDiaries.find((d: any) => d.date === targetDate);
    let savedEntry: any = null;

    if (existing) {
      const existingId = existing.id || (existing as any)._id;
      savedEntry = await db.diaries.update(req.user!.id, existingId, {
        content: finalContent,
        title: existing.title && existing.title !== `Journal: ${targetDate}` ? existing.title : finalTitle,
        mood: finalMood,
        date: targetDate,
      });
    } else {
      savedEntry = await db.diaries.create(req.user!.id, {
        title: finalTitle,
        content: finalContent,
        date: targetDate,
        mood: finalMood,
        weather: 'sunny',
        tags: [],
      });
    }

    res.json({
      date: targetDate,
      updatedContent: finalContent,
      explanation,
      entry: savedEntry,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update diary page with AI.' });
  }
});

export default router;
