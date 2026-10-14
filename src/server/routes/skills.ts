import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { executeSkillPrompt } from '../services/ai.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(requireAuth);

// GET /api/skills
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const skills = await db.skills.findMany(req.user!.id);
    res.json({ skills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch skills.' });
  }
});

// POST /api/skills
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, category, description, promptTemplate, variables, tags, icon } = req.body;
    if (!name || !description || !promptTemplate) {
      res.status(400).json({ error: 'Name, description, and prompt template are required.' });
      return;
    }

    const skill = await db.skills.create(req.user!.id, {
      name,
      category,
      description,
      promptTemplate,
      variables,
      tags,
      icon,
    });

    res.status(201).json({ skill });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create skill.' });
  }
});

// PUT /api/skills/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, category, description, promptTemplate, variables, tags, icon } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (promptTemplate !== undefined) updates.promptTemplate = promptTemplate;
    if (variables !== undefined) updates.variables = variables;
    if (tags !== undefined) updates.tags = tags;
    if (icon !== undefined) updates.icon = icon;

    const skill = await db.skills.update(req.user!.id, req.params.id, updates);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found or cannot edit system skill.' });
      return;
    }

    res.json({ skill });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update skill.' });
  }
});

// DELETE /api/skills/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await db.skills.delete(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(400).json({ error: 'System skills cannot be deleted or skill not found.' });
      return;
    }
    res.json({ success: true, message: 'Skill deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete skill.' });
  }
});

// POST /api/skills/:id/execute
router.post('/:id/execute', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text input is required to execute skill.' });
      return;
    }

    const skill = await db.skills.findById(req.params.id, req.user!.id);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const output = await executeSkillPrompt({
      promptTemplate: skill.promptTemplate,
      text,
      customApiKey: customKey,
      model,
    });

    res.json({
      skillId: skill.id || skill._id,
      skillName: skill.name,
      output,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Skill execution failed.' });
  }
});

export default router;
