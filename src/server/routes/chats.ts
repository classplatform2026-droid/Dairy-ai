import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { chatWithContext } from '../services/ai.js';
import { decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(requireAuth);

// GET /api/chats
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chats = await db.chats.findMany(req.user!.id);
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// POST /api/chats
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, mode, linkedResourceId, linkedResourceType } = req.body;
    const chat = await db.chats.create(req.user!.id, {
      title: title || 'New Conversation',
      mode: mode || 'default',
      linkedResourceId,
      linkedResourceType,
    });
    res.status(201).json({ chat });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation.' });
  }
});

// GET /api/chats/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chat = await db.chats.findById(req.user!.id, req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation.' });
  }
});

// PUT /api/chats/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, mode } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (mode !== undefined) updates.mode = mode;

    const chat = await db.chats.update(req.user!.id, req.params.id, updates);
    if (!chat) {
      res.status(404).json({ error: 'Conversation not found or unauthorized.' });
      return;
    }
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update conversation.' });
  }
});

// DELETE /api/chats/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Critical: Never delete referenced resources (books, diaries, plans)
    const deleted = await db.chats.delete(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Conversation not found or unauthorized.' });
      return;
    }
    res.json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

// POST /api/chats/:id/messages
router.post('/:id/messages', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { content, attachments, skillId } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Message content is required.' });
      return;
    }

    const chat = await db.chats.findById(req.user!.id, req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    // 1. Save user message
    let skillExecutedInfo = undefined;
    if (skillId) {
      const skill = await db.skills.findById(skillId, req.user!.id);
      if (skill) {
        skillExecutedInfo = { skillId: skill.id || skill._id, skillName: skill.name };
      }
    }

    const userMessage = await db.chats.createMessage(req.user!.id, req.params.id, {
      role: 'user',
      content,
      attachments: attachments || [],
      skillExecuted: skillExecutedInfo,
    });

    // 2. Build context from attachments & linked resources
    let contextSnippets: string[] = [];

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'diary') {
          const entry = await db.diaries.findById(req.user!.id, att.id);
          if (entry) {
            contextSnippets.push(`[DIARY ENTRY: "${entry.title}" (${entry.date})]\n${entry.content}`);
          }
        } else if (att.type === 'plan') {
          const plan = await db.plans.findById(req.user!.id, att.id);
          if (plan) {
            const taskList = (plan.tasks || []).map((t: any) => `- [${t.completed ? 'x' : ' '}] ${t.title}`).join('\n');
            contextSnippets.push(`[PLAN: "${plan.title}" (${plan.category}, Status: ${plan.status})]\nDescription: ${plan.description}\nTasks:\n${taskList}\nNotes: ${plan.notes || 'None'}`);
          }
        } else if (att.type === 'book') {
          const book = await db.books.findById(req.user!.id, att.id);
          if (book) {
            const chaptersSummary = (book.chapters || []).map((c: any) => `Chapter ${c.order}: "${c.title}" (${c.wordCount || 0} words)`).join(', ');
            contextSnippets.push(`[BOOK: "${book.title}"]\nGenre: ${book.genre}\nDescription: ${book.description}\nChapters: ${chaptersSummary}`);
          }
        } else if (att.type === 'chapter') {
          // Chapter ID can be fetched
          const ch = await db.chapters.findById(req.user!.id, att.id);
          if (ch) {
            contextSnippets.push(`[CHAPTER: "${ch.title}"]\n${ch.content}`);
          }
        } else if (att.type === 'skill') {
          const sk = await db.skills.findById(att.id, req.user!.id);
          if (sk) {
            contextSnippets.push(`[REUSABLE SKILL INSTRUCTION: "${sk.name}"]\n${sk.promptTemplate}`);
          }
        }
      }
    }

    // 3. Query AI
    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = user?.selectedModel || 'gemini-3.8-flash';

    // Retrieve previous messages for conversation history (last 10)
    const historyMessages = (chat.messages || []).slice(-10).map((m: any) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
    historyMessages.push({ role: 'user', content });

    const aiResult = await chatWithContext({
      messages: historyMessages,
      mode: chat.mode || 'default',
      contextText: contextSnippets.join('\n\n---\n\n'),
      attachments: attachments || [],
      customApiKey: customKey,
      model,
    });

    // 4. Save assistant response
    const assistantMessage = await db.chats.createMessage(req.user!.id, req.params.id, {
      role: 'assistant',
      content: aiResult.reply,
      detectedIntent: aiResult.detectedIntent,
      actionProposal: aiResult.actionProposal,
    });

    res.status(201).json({
      userMessage,
      assistantMessage,
    });
  } catch (err: any) {
    console.error('[Chat Route] Message sending error:', err);
    res.status(500).json({ error: err.message || 'Failed to send message.' });
  }
});

// POST /api/chats/:id/messages/:msgId/apply-action
router.post('/:id/messages/:msgId/apply-action', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { actionData } = req.body;
    const chat = await db.chats.findById(req.user!.id, req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const message = (chat.messages || []).find((m: any) => (m.id === req.params.msgId || m._id === req.params.msgId));
    if (!message || !message.actionProposal) {
      res.status(404).json({ error: 'Action proposal not found in message.' });
      return;
    }

    const proposal = message.actionProposal;
    const dataToUse = actionData || proposal.data;
    let createdResource: any = null;

    if (proposal.type === 'create_diary') {
      createdResource = await db.diaries.create(req.user!.id, {
        title: dataToUse.title || 'Journal Entry',
        content: dataToUse.content || '',
        mood: dataToUse.mood || 'thoughtful',
        tags: dataToUse.tags || ['ai-chat'],
        date: dataToUse.date || new Date().toISOString().split('T')[0],
      });
    } else if (proposal.type === 'update_plan') {
      if (proposal.targetId) {
        const plan = await db.plans.findById(req.user!.id, proposal.targetId);
        if (plan) {
          const currentTasks = plan.tasks || [];
          const newTasks = (dataToUse.newTasks || []).map((t: string | any, i: number) => ({
            id: 'tsk_' + Math.random().toString(36).substr(2, 9),
            title: typeof t === 'string' ? t : t.title,
            completed: false,
            order: currentTasks.length + i + 1,
          }));
          createdResource = await db.plans.update(req.user!.id, proposal.targetId, {
            tasks: [...currentTasks, ...newTasks],
            notes: dataToUse.notes ? `${plan.notes || ''}\n${dataToUse.notes}`.trim() : plan.notes,
          });
        }
      } else {
        // Create new plan if no target plan
        const tasks = (dataToUse.newTasks || dataToUse.tasks || []).map((t: any, i: number) => ({
          title: typeof t === 'string' ? t : t.title,
          completed: false,
          order: i + 1,
        }));
        createdResource = await db.plans.create(req.user!.id, {
          title: dataToUse.planTitle || dataToUse.title || 'New Plan',
          description: dataToUse.description || '',
          category: dataToUse.category || 'Personal',
          tasks,
        });
      }
    } else if (proposal.type === 'add_chapter') {
      if (proposal.targetId) {
        createdResource = await db.chapters.create(req.user!.id, proposal.targetId, {
          title: dataToUse.chapterTitle || dataToUse.title || 'New Chapter',
          content: dataToUse.content || '',
          summary: dataToUse.summary || '',
        });
      }
    } else if (proposal.type === 'create_skill') {
      createdResource = await db.skills.create(req.user!.id, {
        name: dataToUse.name || 'New Custom Skill',
        description: dataToUse.description || 'Custom AI writing skill',
        promptTemplate: dataToUse.promptTemplate || 'Please analyze this text: {text}',
        tags: dataToUse.tags || ['custom'],
        icon: 'Sparkles',
      });
    }

    // Mark proposal as applied in message
    await db.chats.updateProposalStatus(req.user!.id, req.params.msgId, 'applied');

    res.json({
      success: true,
      message: 'Action successfully applied to your saved content.',
      createdResource,
    });
  } catch (err: any) {
    console.error('[Chat Route] Apply action error:', err);
    res.status(500).json({ error: err.message || 'Failed to apply action.' });
  }
});

export default router;
