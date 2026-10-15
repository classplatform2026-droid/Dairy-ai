import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import {
  executeSkillPrompt,
  executeSkillAdvanced,
  generateSkillFromConversation,
  refineSkillFromFeedback,
} from '../services/ai.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(requireAuth);

function parseSkillMarkdown(rawMd: string) {
  let name = 'Imported Skill';
  let description = '';
  let category = 'Writing';
  let icon = 'Sparkles';
  let tags: string[] = [];
  let variables: string[] = ['text'];
  let promptTemplate = '';

  const frontmatterMatch = rawMd.match(/^---\s*([\s\S]*?)\s*---/);
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    const nameMatch = yaml.match(/name:\s*["']?([^"'\n\r]+)["']?/);
    if (nameMatch) name = nameMatch[1].trim();

    const descMatch = yaml.match(/description:\s*["']?([^"'\n\r]+)["']?/);
    if (descMatch) description = descMatch[1].trim();

    const catMatch = yaml.match(/category:\s*["']?([^"'\n\r]+)["']?/);
    if (catMatch) category = catMatch[1].trim();

    const iconMatch = yaml.match(/icon:\s*["']?([^"'\n\r]+)["']?/);
    if (iconMatch) icon = iconMatch[1].trim();

    const inputsMatch = yaml.match(/inputs:\s*([\s\S]*?)(?=(?:\n[a-z]+:)|$)/i);
    if (inputsMatch) {
      const vars = inputsMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s*-\s*/, '').replace(/[`'"]/g, '').trim())
        .filter(Boolean);
      if (vars.length > 0) variables = vars;
    }

    const tagsMatch = yaml.match(/tags:\s*([\s\S]*?)(?=(?:\n[a-z]+:)|$)/i);
    if (tagsMatch) {
      const t = tagsMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s*-\s*/, '').replace(/[`'"]/g, '').trim())
        .filter(Boolean);
      if (t.length > 0) tags = t;
    }
  }

  // Extract body
  const body = rawMd.replace(/^---\s*[\s\S]*?\s*---\s*/, '').trim();
  if (!description) {
    const purposeMatch = body.match(/## Purpose\s*([\s\S]*?)(?=\n##|$)/i);
    if (purposeMatch) description = purposeMatch[1].trim().slice(0, 160);
  }

  // Find prompt template if encapsulated in code block, otherwise synthesize from body
  const codeBlockMatch = body.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1].length > 20) {
    promptTemplate = codeBlockMatch[1].trim();
  } else {
    promptTemplate = body;
  }

  if (!promptTemplate.includes('{text}') && !promptTemplate.includes('{input}')) {
    promptTemplate = `${promptTemplate}\n\nContent to process:\n"{text}"`;
  }

  return {
    name,
    description: description || 'Custom cognitive skill',
    category,
    icon,
    tags,
    variables,
    promptTemplate,
    skillMd: rawMd,
  };
}

// GET /api/skills
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const skills = await db.skills.findMany(req.user!.id);
    res.json({ skills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch skills.' });
  }
});

// GET /api/skills/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const skill = await db.skills.findById(req.params.id, req.user!.id);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found.' });
      return;
    }
    res.json({ skill });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch skill details.' });
  }
});

// POST /api/skills/generate-spec (Conversational / Interactive Claude-style Skill Creator)
router.post('/generate-spec', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { prompt, conversationHistory, currentDraft } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt is required to generate skill.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const spec = await generateSkillFromConversation({
      prompt: prompt.trim(),
      conversationHistory: conversationHistory || [],
      currentDraft,
      customApiKey: customKey,
      model,
    });

    res.json(spec);
  } catch (err: any) {
    console.error('Skill generation failed:', err);
    res.status(500).json({ error: err.message || 'Failed to generate skill specification.' });
  }
});

// POST /api/skills/refine-spec (Refine SKILL.md based on user feedback or test outputs)
router.post('/refine-spec', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { skillMd, feedback, testOutput } = req.body;
    if (!skillMd || !feedback) {
      res.status(400).json({ error: 'skillMd and feedback are required.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const refined = await refineSkillFromFeedback({
      currentSkillMd: skillMd,
      feedback,
      testOutput,
      customApiKey: customKey,
      model,
    });

    res.json(refined);
  } catch (err: any) {
    console.error('Skill refinement failed:', err);
    res.status(500).json({ error: err.message || 'Failed to refine skill specification.' });
  }
});

// POST /api/skills/parse-markdown (Import and validate external SKILL.md)
router.post('/parse-markdown', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { markdown } = req.body;
    if (!markdown || typeof markdown !== 'string') {
      res.status(400).json({ error: 'Markdown content is required.' });
      return;
    }

    const parsed = parseSkillMarkdown(markdown);
    res.json(parsed);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to parse SKILL.md document.' });
  }
});

// POST /api/skills/test-draft (Live test bench for un-saved drafts)
router.post('/test-draft', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptTemplate, skillMd, input, variables } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ error: 'Sample input is required for testing.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    const result = await executeSkillAdvanced({
      promptTemplate: promptTemplate || 'Transform the following text:\n"{text}"',
      skillMd,
      input,
      variables,
      customApiKey: customKey,
      model,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Skill draft test error:', err);
    res.status(500).json({ error: err.message || 'Test execution failed.' });
  }
});

// POST /api/skills/:id/test (Run test on a saved skill & record execution history)
router.post('/:id/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { input, variables } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ error: 'Sample input is required.' });
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

    const result = await executeSkillAdvanced({
      promptTemplate: skill.promptTemplate,
      skillMd: skill.skillMd,
      input,
      variables,
      customApiKey: customKey,
      model,
    });

    // Record execution in persistent history
    const logEntry = await db.skills.recordExecution(req.user!.id, req.params.id, {
      input: input.slice(0, 1000),
      output: result.output.slice(0, 4000),
      model: result.model,
      durationMs: result.durationMs,
      status: 'success',
    });

    res.json({
      output: result.output,
      durationMs: result.durationMs,
      model: result.model,
      logEntry,
    });
  } catch (err: any) {
    console.error('Skill test error:', err);
    res.status(500).json({ error: err.message || 'Skill test failed.' });
  }
});

// POST /api/skills/:id/restore-version/:versionNumber
router.post('/:id/restore-version/:versionNumber', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const versionNum = parseInt(req.params.versionNumber, 10);
    if (isNaN(versionNum)) {
      res.status(400).json({ error: 'Valid version number required.' });
      return;
    }

    const restored = await db.skills.restoreVersion(req.user!.id, req.params.id, versionNum);
    if (!restored) {
      res.status(404).json({ error: 'Version not found or unauthorized.' });
      return;
    }

    res.json({ success: true, skill: restored });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore skill version.' });
  }
});

// POST /api/skills (Create new skill with SKILL.md & versioning)
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, category, description, promptTemplate, skillMd, variables, tags, icon } = req.body;
    if (!name || !description || (!promptTemplate && !skillMd)) {
      res.status(400).json({ error: 'Name, description, and prompt template or SKILL.md are required.' });
      return;
    }

    const skill = await db.skills.create(req.user!.id, {
      name,
      category: category || 'Writing',
      description,
      promptTemplate: promptTemplate || 'Transform the text:\n"{text}"',
      skillMd: skillMd || '',
      variables: variables || ['text'],
      tags: tags || [],
      icon: icon || 'Sparkles',
    });

    res.status(201).json({ skill });
  } catch (err) {
    console.error('Failed to create skill:', err);
    res.status(500).json({ error: 'Failed to create skill.' });
  }
});

// PUT /api/skills/:id (Update skill with versioning and change notes)
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, category, description, promptTemplate, skillMd, variables, tags, icon, changeNote } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (promptTemplate !== undefined) updates.promptTemplate = promptTemplate;
    if (skillMd !== undefined) updates.skillMd = skillMd;
    if (variables !== undefined) updates.variables = variables;
    if (tags !== undefined) updates.tags = tags;
    if (icon !== undefined) updates.icon = icon;
    if (changeNote !== undefined) updates.changeNote = changeNote;

    const skill = await db.skills.update(req.user!.id, req.params.id, updates);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found or cannot edit system skill.' });
      return;
    }

    res.json({ skill });
  } catch (err) {
    console.error('Failed to update skill:', err);
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

// POST /api/skills/:id/execute (Legacy single execute endpoint kept for backwards compatibility)
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

    const result = await executeSkillAdvanced({
      promptTemplate: skill.promptTemplate,
      skillMd: skill.skillMd,
      input: text,
      customApiKey: customKey,
      model,
    });

    // Record execution log
    await db.skills.recordExecution(req.user!.id, req.params.id, {
      input: text.slice(0, 1000),
      output: result.output.slice(0, 4000),
      model: result.model,
      durationMs: result.durationMs,
      status: 'success',
    });

    res.json({
      skillId: skill.id || skill._id,
      skillName: skill.name,
      output: result.output,
      durationMs: result.durationMs,
      model: result.model,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Skill execution failed.' });
  }
});

export default router;
