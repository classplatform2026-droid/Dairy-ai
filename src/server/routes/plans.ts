import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { generatePlanBreakdown } from '../services/ai.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(requireAuth);

// GET /api/plans
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const plans = await db.plans.findMany(
      req.user!.id,
      typeof status === 'string' ? status : undefined
    );
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans.' });
  }
});

// POST /api/plans
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, priority, deadline, status, tasks, notes } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Plan title is required.' });
      return;
    }

    const plan = await db.plans.create(req.user!.id, {
      title,
      description,
      category,
      priority,
      deadline,
      status,
      tasks: tasks || [],
      notes,
    });

    res.status(201).json({ plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan.' });
  }
});

// GET /api/plans/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plan = await db.plans.findById(req.user!.id, req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan.' });
  }
});

// PUT /api/plans/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, priority, deadline, status, tasks, notes } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (priority !== undefined) updates.priority = priority;
    if (deadline !== undefined) updates.deadline = deadline;
    if (status !== undefined) updates.status = status;
    if (tasks !== undefined) updates.tasks = tasks;
    if (notes !== undefined) updates.notes = notes;

    const updated = await db.plans.update(req.user!.id, req.params.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Plan not found or unauthorized.' });
      return;
    }

    res.json({ plan: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan.' });
  }
});

// DELETE /api/plans/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await db.plans.delete(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Plan not found or unauthorized.' });
      return;
    }
    res.json({ success: true, message: 'Plan deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan.' });
  }
});

// POST /api/plans/ai-breakdown
router.post('/ai-breakdown', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { goal, category } = req.body;
    if (!goal) {
      res.status(400).json({ error: 'Goal description is required.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const breakdown = await generatePlanBreakdown({
      goal,
      category,
      customApiKey: customKey,
      model,
    });

    res.json({ breakdown });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI plan generation failed.' });
  }
});

export default router;
