import { GoogleGenAI } from '@google/genai';

function getGenAIClient(customApiKey?: string): GoogleGenAI {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured in environment or user settings.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient executor with model fallback on 503 / temporary capacity issues
async function generateWithFallback(
  ai: GoogleGenAI,
  preferredModel: string = 'gemini-3.8-flash',
  generateParams: { contents: any; config?: any }
) {
  const fallbackModels = [
    preferredModel || 'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  const modelsToTry = Array.from(new Set(fallbackModels));
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents: generateParams.contents,
        config: generateParams.config,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after 25000ms on model ${model}`)), 25000)
      );
      const response = (await Promise.race([callPromise, timeoutPromise])) as any;
      return { response, usedModel: model };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || '';
      console.warn(`[AI Service] Attempt with model ${model} failed: ${errMsg.slice(0, 100)}. Retrying fallback...`);
    }
  }

  throw lastError;
}

export async function testAIConnection(customApiKey?: string, model: string = 'gemini-3.8-flash'): Promise<{ success: boolean; message: string; model: string }> {
  try {
    const ai = getGenAIClient(customApiKey);
    const { response, usedModel } = await generateWithFallback(ai, model, {
      contents: 'Respond with the single word: "Connected"',
    });
    const text = response.text?.trim() || '';
    return {
      success: true,
      message: text ? `Success: AI responded with "${text}"` : 'AI connection established.',
      model: usedModel,
    };
  } catch (err: any) {
    console.error('[AI Service] Test connection failed:', err);
    return {
      success: false,
      message: err.message || 'Failed to connect to AI provider.',
      model: model || 'gemini-3.8-flash',
    };
  }
}

export async function transformText(params: {
  text: string;
  action: 'improve' | 'beautify' | 'grammar' | 'expand' | 'shorten' | 'tone';
  tone?: string;
  customApiKey?: string;
  model?: string;
}): Promise<string> {
  const { text, action, tone, customApiKey, model } = params;
  const ai = getGenAIClient(customApiKey);

  let instruction = '';
  switch (action) {
    case 'grammar':
      instruction = 'You are an expert editor. Fix all spelling, punctuation, and grammatical mistakes while preserving the author\'s original thoughts and emotional voice. Return only the revised text without preamble or commentary.';
      break;
    case 'improve':
      instruction = 'You are a master essayist. Improve the sentence flow, vocabulary, and clarity of the writing. Maintain the natural voice, emotion, and authenticity. Return only the revised text without commentary.';
      break;
    case 'beautify':
      instruction = 'You are a lyrical, contemplative writer. Beautify the text with evocative prose, refined rhythm, and poetic resonance while keeping it deeply personal and grounded. Return only the revised text.';
      break;
    case 'expand':
      instruction = 'You are an insightful journal editor. Deepen and expand upon the thoughts in the text by exploring underlying feelings, sensory details, and reflections, maintaining the author\'s point of view. Return only the expanded text.';
      break;
    case 'shorten':
      instruction = 'You are a minimalist editor. Distill the text down to its most potent, concise essence. Eliminate redundant filler words while retaining the emotional core. Return only the shortened text.';
      break;
    case 'tone':
      instruction = `You are an expert writer. Rewrite the following text with a "${tone || 'reflective'}" tone while keeping the underlying message intact. Return only the rewritten text.`;
      break;
    default:
      instruction = 'Polish and enhance the following text with clarity and elegance. Return only the result.';
  }

  const prompt = `${instruction}\n\nOriginal Text:\n${text}`;
  const { response } = await generateWithFallback(ai, model || 'gemini-3.1-flash-lite', {
    contents: prompt,
  });

  return response.text?.trim() || text;
}

export async function generatePlanBreakdown(params: {
  goal: string;
  category?: string;
  customApiKey?: string;
  model?: string;
}): Promise<{ title: string; description: string; tasks: { title: string; order: number }[]; notes: string }> {
  const { goal, category, customApiKey, model } = params;
  const ai = getGenAIClient(customApiKey);

  const prompt = `Break down the following goal or project into a clear, actionable plan.
Goal: "${goal}"
Category: "${category || 'Personal'}"

Return ONLY a valid JSON object matching this schema without markdown code blocks:
{
  "title": "Concise plan title",
  "description": "Brief summary of the plan's purpose and scope",
  "tasks": [
    { "title": "Specific actionable step 1", "order": 1 },
    { "title": "Specific actionable step 2", "order": 2 },
    { "title": "Specific actionable step 3", "order": 3 }
  ],
  "notes": "Helpful tips, milestones, or considerations"
}`;

  try {
    const { response } = await generateWithFallback(ai, model || 'gemini-3.1-flash-lite', {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text?.trim() || '{}';
    return JSON.parse(raw);
  } catch {
    return {
      title: goal,
      description: 'Action plan created from goal',
      tasks: [
        { title: 'Define immediate next steps', order: 1 },
        { title: 'Gather necessary resources', order: 2 },
        { title: 'Execute primary milestone', order: 3 },
      ],
      notes: 'Review progress periodically.',
    };
  }
}

export async function executeSkillPrompt(params: {
  promptTemplate: string;
  text: string;
  customApiKey?: string;
  model?: string;
}): Promise<string> {
  const { promptTemplate, text, customApiKey, model } = params;
  const ai = getGenAIClient(customApiKey);

  const finalPrompt = promptTemplate.includes('{text}')
    ? promptTemplate.replace(/\{text\}/g, text)
    : `${promptTemplate}\n\nContent:\n${text}`;

  const { response } = await generateWithFallback(ai, model || 'gemini-3.1-flash-lite', {
    contents: finalPrompt,
  });

  return response.text?.trim() || '';
}

export async function chatWithContext(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  mode: 'default' | 'diary' | 'book' | 'plan';
  contextText?: string;
  attachments?: Array<{ type: string; id: string; title: string }>;
  customApiKey?: string;
  model?: string;
}): Promise<{
  reply: string;
  detectedIntent: { type: 'write' | 'improve' | 'summarize' | 'plan' | 'save' | 'general'; explanation: string };
  actionProposal?: {
    type: 'create_diary' | 'update_plan' | 'add_chapter' | 'create_skill' | 'replace_content';
    targetId?: string;
    targetName?: string;
    data: any;
    status: 'pending';
  };
}> {
  const { messages, mode, contextText, attachments, customApiKey, model } = params;
  const ai = getGenAIClient(customApiKey);

  const lastUserMessage = messages[messages.length - 1]?.content || '';

  const systemPrompt = `You are LifeNote AI, an intelligent, minimalist writing companion and life organizer.
Current Mode: ${mode.toUpperCase()}
Available Saved Context:
${contextText ? contextText : '(No attached resources)'}

Attachments: ${attachments && attachments.length > 0 ? attachments.map(a => `${a.type.toUpperCase()}: "${a.title}"`).join(', ') : 'None'}

CORE DIARY CONSTITUTION (CRITICAL):
A Diary/Journal is strictly organized by DATE. Each calendar day has ONE single continuous page (not chapters or standalone topic titles).
When Mode is DIARY or when the conversation is about a diary entry:
1. Every message the user sends contributes to that specific day's single page.
2. If previous text for this day is provided in context (e.g., '[TODAY\'S EXISTING DIARY PAGE]' or '[EXISTING DIARY ENTRY]'):
   - When the user gives new thoughts or events, integrate and append them into the existing text for today in natural chronological flow.
   - When the user asks to update, correct, or refine previous information (e.g., changing times, names, details, or tone), update that specific part while preserving the rest of today's page.
   - In 'actionProposal', always return the COMPLETE, unified text for that day's page so far.
   - Use 'type': 'update_diary' (or 'create_diary' if no entry existed yet) with 'targetId' set to the existing entry's ID.

Your responsibilities:
1. Provide thoughtful, beautifully crafted, and empathetic responses.
2. Analyze user intent: classify it into one of: 'write', 'improve', 'summarize', 'plan', 'save', 'general'.
3. CRITICAL SAFEGUARD: You NEVER overwrite or create persistent user content automatically. If the user asks to save, log a diary entry, add tasks to a plan, or write a book chapter, formulate an "actionProposal" with an editable preview so the user can review and approve before anything is saved.
4. Output your answer in JSON format with this exact structure:
{
  "reply": "Your markdown-formatted conversational answer or explanation to the user.",
  "detectedIntent": {
    "type": "write | improve | summarize | plan | save | general",
    "explanation": "Brief 1-sentence reason for this intent"
  },
  "actionProposal": null OR {
    "type": "create_diary | update_diary | update_plan | add_chapter | create_skill",
    "targetId": "ID of resource if updating an existing one, else omit",
    "targetName": "Name or title of the target",
    "data": {
      // For create_diary / update_diary: { "title": "Journal: YYYY-MM-DD", "content": "Full integrated text for today...", "date": "YYYY-MM-DD", "mood": "thoughtful", "tags": [...] }
      // For update_plan: { "planTitle": "...", "newTasks": ["task 1", "task 2"], "notes": "..." }
      // For add_chapter: { "chapterTitle": "...", "content": "..." }
      // For create_skill: { "name": "...", "description": "...", "promptTemplate": "..." }
    }
  }
}`;

  const conversationHistory = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const fullPrompt = `${systemPrompt}\n\n=== Conversation History ===\n${conversationHistory}\n\nRespond with valid JSON:`;

  try {
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return {
      reply: parsed.reply || 'I have processed your request.',
      detectedIntent: parsed.detectedIntent || { type: 'general', explanation: 'General conversational inquiry' },
      actionProposal: parsed.actionProposal ? { ...parsed.actionProposal, status: 'pending' } : undefined,
    };
  } catch (err) {
    console.error('[AI Service] Chat with context error:', err);
    try {
      const { response: fallbackResponse } = await generateWithFallback(ai, model || 'gemini-3.1-flash-lite', {
        contents: `${systemPrompt}\n\nUser: ${lastUserMessage}\n\nProvide your response directly:`,
      });
      return {
        reply: fallbackResponse.text?.trim() || 'I heard your request. How would you like to proceed?',
        detectedIntent: { type: 'general', explanation: 'Conversation' },
      };
    } catch {
      return {
        reply: 'LifeNote AI is ready. How can I assist with your writing or planning today?',
        detectedIntent: { type: 'general', explanation: 'Ready' },
      };
    }
  }
}
