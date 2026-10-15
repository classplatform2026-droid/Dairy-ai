import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { chatWithContext, craftBeautifulJournalEntry } from '../services/ai.js';
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

function sanitizeMessageProposal(msg: any, prevUserContent?: string): any {
  if (!msg || !msg.actionProposal) return msg;
  const p = { ...msg.actionProposal };
  let rawType = String(p.type || '').toLowerCase();
  if (
    rawType.includes('diary') ||
    rawType.includes('journal') ||
    rawType.includes('|') ||
    !['create_diary', 'update_diary', 'update_plan', 'add_chapter', 'create_skill'].includes(rawType)
  ) {
    if (rawType.includes('plan')) {
      rawType = 'update_plan';
    } else if (rawType.includes('chapter') || rawType.includes('book')) {
      rawType = 'add_chapter';
    } else if (rawType.includes('skill')) {
      rawType = 'create_skill';
    } else {
      rawType = 'create_diary';
    }
  }
  p.type = rawType;
  if (!p.data || typeof p.data !== 'object') p.data = {};

  if (p.type === 'create_diary' || p.type === 'update_diary') {
    let content = (p.data.content || p.data.text || p.data.entry || p.data.body || p.data.notes || '').trim();
    const isRawOrBrief =
      !content ||
      (prevUserContent && content.toLowerCase() === prevUserContent.trim().toLowerCase()) ||
      (prevUserContent && content.length <= prevUserContent.length + 10 && content.includes(prevUserContent)) ||
      content.split(/\s+/).length < 8;

    if (isRawOrBrief) {
      const raw = prevUserContent || content || (typeof msg.content === 'string' ? msg.content : '') || '';
      content = craftBeautifulJournalEntry(raw);
    }
    p.data.content = content;
    const today = new Date().toISOString().split('T')[0];
    p.data.date = p.data.date || today;
    const isBengali = /[\u0980-\u09FF]/.test(content);
    if (!p.data.title || p.data.title.startsWith('Journal: 202')) {
      p.data.title = isBengali ? 'আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত' : `Reflections: ${p.data.date}`;
    }
    p.targetName = p.targetName || p.data.title;
  }
  return { ...msg, actionProposal: p };
}

// GET /api/chats/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chat = await db.chats.findById(req.user!.id, req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    // Sanitize any previously corrupted message proposals
    if (Array.isArray(chat.messages)) {
      let lastUserText = '';
      chat.messages = chat.messages.map((m: any) => {
        if (m.role === 'user') {
          lastUserText = m.content || '';
          return m;
        }
        return sanitizeMessageProposal(m, lastUserText);
      });
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

    const clientDate = (req.body.clientDate && typeof req.body.clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.clientDate))
      ? req.body.clientDate
      : new Date().toISOString().split('T')[0];
    const clientTimezone = req.body.timezone || req.body.clientTimezone;

    // Auto-attach current day's diary entry if in 'diary' mode or discussing diary
    let targetDiary: any = null;
    const isDiaryMode = chat.mode === 'diary' || (Array.isArray(attachments) && attachments.some(a => a.type === 'diary'));
    if (isDiaryMode) {
      const todayStr = clientDate;
      if (chat.linkedResourceId) {
        targetDiary = await db.diaries.findById(req.user!.id, chat.linkedResourceId);
      }
      if (!targetDiary && Array.isArray(attachments)) {
        const diaryAtt = attachments.find(a => a.type === 'diary');
        if (diaryAtt) {
          targetDiary = await db.diaries.findById(req.user!.id, diaryAtt.id);
        }
      }
      if (!targetDiary) {
        targetDiary = await db.diaries.findByDate(req.user!.id, todayStr);
      }

      if (targetDiary) {
        contextSnippets.unshift(`[CURRENT DIARY PAGE FOR DATE: ${targetDiary.date} (Entry ID: ${targetDiary.id || (targetDiary as any)._id})]:
Title: "${targetDiary.title}"
Current Page Content:
${targetDiary.content}

CRITICAL INSTRUCTION FOR DIARY:
The text above is what the user already has written for this day (${targetDiary.date}).
When the user gives a new thought, moment, or instruction to add/update:
- Integrate the new information into this day's single page text.
- If updating or correcting facts, update them in place while keeping the rest of today's record.
- Always provide the full unified daily page in actionProposal.data.content with targetId: "${targetDiary.id || (targetDiary as any)._id}".`);
      } else {
        contextSnippets.unshift(`[CURRENT DIARY STATUS FOR TODAY (${todayStr})]:
No diary page written yet for today. When the user writes their first message for today, create the initial text for today's single page (${todayStr}) in actionProposal.`);
      }
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'diary') {
          const entry = await db.diaries.findById(req.user!.id, att.id);
          if (entry && (!targetDiary || (targetDiary.id || (targetDiary as any)._id) !== att.id)) {
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
      clientDate,
      clientTimezone,
    });

    // 4. Save assistant response with strict JSON unwrapping safeguard
    let replyContent = aiResult.reply || '';
    let finalProposal = aiResult.actionProposal;
    let finalIntent = aiResult.detectedIntent;
    if (typeof replyContent === 'string' && replyContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(replyContent.trim());
        if (parsed.reply && typeof parsed.reply === 'string') {
          replyContent = parsed.reply;
          if (parsed.actionProposal && !finalProposal) finalProposal = parsed.actionProposal;
          if (parsed.detectedIntent && !finalIntent) finalIntent = parsed.detectedIntent;
        }
      } catch (_) {
        const m = replyContent.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        if (m) {
          try {
            replyContent = JSON.parse(`"${m[1]}"`);
          } catch {
            replyContent = m[1];
          }
        }
      }
    }

    const sanitizedObj = sanitizeMessageProposal({ content: replyContent, actionProposal: finalProposal }, content);
    finalProposal = sanitizedObj.actionProposal;

    const assistantMessage = await db.chats.createMessage(req.user!.id, req.params.id, {
      role: 'assistant',
      content: replyContent,
      detectedIntent: finalIntent,
      actionProposal: finalProposal,
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

    let pType = String(proposal.type || '').toLowerCase();
    const isDiaryAction =
      pType.includes('diary') ||
      pType.includes('journal') ||
      !['update_plan', 'add_chapter', 'create_skill'].includes(pType);

    if (isDiaryAction) {
      const todayStr = (req.body.clientDate && typeof req.body.clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.clientDate))
        ? req.body.clientDate
        : new Date().toISOString().split('T')[0];
      let targetDate = dataToUse.date || todayStr;
      if (/202[0-5]/.test(targetDate) || targetDate.includes('YYYY')) {
        targetDate = todayStr;
      }
      const userDiaries = await db.diaries.findMany(req.user!.id);
      let existingForDate = proposal.targetId
        ? await db.diaries.findById(req.user!.id, proposal.targetId)
        : null;

      if (!existingForDate) {
        existingForDate = userDiaries.find((d: any) => d.date === targetDate);
      }

      const contentToSave = (dataToUse.content || dataToUse.text || dataToUse.entry || dataToUse.body || '').trim() || (typeof message.content === 'string' ? message.content : '');

      if (existingForDate) {
        const idToUpdate = existingForDate.id || (existingForDate as any)._id;
        const prevContent = (existingForDate.content || '').trim();
        let finalContent = contentToSave.trim();

        // PRESERVE PREVIOUS TEXT: If text already exists for this date, append new thoughts so earlier writing is never lost
        if (prevContent && finalContent) {
          if (!finalContent.includes(prevContent) && !prevContent.includes(finalContent)) {
            finalContent = `${prevContent}\n\n${finalContent}`;
          } else if (prevContent.includes(finalContent)) {
            finalContent = prevContent;
          }
        } else if (prevContent && !finalContent) {
          finalContent = prevContent;
        }

        createdResource = await db.diaries.update(req.user!.id, idToUpdate, {
          title: existingForDate.title && !existingForDate.title.startsWith('Journal: 202')
            ? existingForDate.title
            : (dataToUse.title || existingForDate.title || `Journal: ${targetDate}`),
          content: finalContent,
          mood: dataToUse.mood || existingForDate.mood || 'thoughtful',
          weather: dataToUse.weather || existingForDate.weather || 'sunny',
          date: targetDate,
        });
      } else {
        createdResource = await db.diaries.create(req.user!.id, {
          title: dataToUse.title || `Journal: ${targetDate}`,
          content: contentToSave,
          mood: dataToUse.mood || 'thoughtful',
          weather: dataToUse.weather || 'sunny',
          tags: dataToUse.tags || ['daily-journal'],
          date: targetDate,
        });
      }
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
