import { GoogleGenAI, Type } from '@google/genai';

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resilient executor with exponential backoff, jitter, and multi-model fallback on 503 / 429 capacity spikes
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
    for (let attempt = 0; attempt < 3; attempt++) {
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
        const msg = String(err?.message || '');
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('demand') || msg.includes('quota') || msg.includes('capacity');
        if (isTransient) {
          // Exponential backoff with jitter (800ms, 1600ms) without logging noisy console.error
          console.warn(`[AI Service] Capacity high on ${model} (attempt ${attempt + 1}/3), backing off...`);
          await sleep(800 * Math.pow(1.8, attempt) + Math.random() * 300);
        } else {
          // Non-transient error or unsupported param on this model; advance to next model
          break;
        }
      }
    }
    await sleep(250);
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
    const msg = String(err?.message || '');
    const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('demand');
    return {
      success: false,
      message: isTransient
        ? 'Gemini servers are experiencing high demand. System is operating with automatic local resilience.'
        : msg || 'Failed to connect to AI provider.',
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
  try {
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
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: prompt,
    });

    return response.text?.trim() || text;
  } catch (err) {
    console.warn('[AI Service] Transform text fallback to original text:', err);
    return text;
  }
}

export async function generatePlanBreakdown(params: {
  goal: string;
  category?: string;
  customApiKey?: string;
  model?: string;
}): Promise<{ title: string; description: string; tasks: { title: string; order: number }[]; notes: string }> {
  const { goal, category, customApiKey, model } = params;
  try {
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

    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
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
      description: `Action plan for: ${goal}`,
      tasks: [
        { title: 'Define immediate next steps', order: 1 },
        { title: 'Gather necessary resources & setup', order: 2 },
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
  try {
    const ai = getGenAIClient(customApiKey);

    const finalPrompt = promptTemplate.includes('{text}')
      ? promptTemplate.replace(/\{text\}/g, text)
      : `${promptTemplate}\n\nContent:\n${text}`;

    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: finalPrompt,
    });

    return response.text?.trim() || text;
  } catch (err) {
    console.warn('[AI Service] Skill prompt execution error, returning text:', err);
    return text;
  }
}

// Smart local fallback when all Gemini models face external 503 / 429 demand spikes
function generateSmartLocalResponse(
  userMessage: string,
  mode: string,
  todayStr: string,
  _contextText?: string
): {
  reply: string;
  detectedIntent: { type: 'write' | 'improve' | 'summarize' | 'plan' | 'save' | 'general'; explanation: string };
  actionProposal?: any;
} {
  const lower = (userMessage || '').toLowerCase();
  
  // 1. Casual Bengali/Banglish greetings or check-in
  const isBengaliGreeting = lower.includes('kmn aso') || lower.includes('kemon') || lower.includes('valo') ||
    lower.includes('সালাম') || lower.includes('কেমন') || lower.includes('tmi kmn');
  const isEnglishGreeting = lower === 'hi' || lower === 'hello' || lower.startsWith('hi ') || lower.startsWith('hello ') || lower.includes('how are you');

  if (isBengaliGreeting) {
    return {
      reply: 'আমি বেশ ভালো আছি, ধন্যবাদ! আপনার আজকের দিনটি কেমন কাটছে? নতুন কোনো চিন্তা, অনুভূতি বা পরিকল্পনা লিখে রাখতে চান?',
      detectedIntent: { type: 'general', explanation: 'ব্যবহারকারী কুশল বিনিময় করেছেন।' },
      actionProposal: undefined,
    };
  }

  if (isEnglishGreeting) {
    return {
      reply: 'Hello! I am doing well, thank you. How is your day going? Would you like to capture today\'s thoughts or work on a plan?',
      detectedIntent: { type: 'general', explanation: 'User greeted the assistant.' },
      actionProposal: undefined,
    };
  }

  // 2. Uncertainty / Planning question in Bengali/Banglish
  if (lower.includes('ki korbo') || lower.includes('bujte parsi na') || lower.includes('jani na') || lower.includes('কী করব') || lower.includes('কীভাবে')) {
    return {
      reply: 'শুরুতে কিছুটা দ্বিধা বা অনিশ্চয়তা থাকা খুব স্বাভাবিক। সবকিছু একবারে সমাধান করতে না গিয়ে ছোট ছোট ধাপে এগিয়ে যাওয়া সবচেয়ে ভালো কৌশল।\n\nআপনি যদি কোনো নতুন বিষয় বা প্রোগ্রামিং নিয়ে শুরু করতে চান, তবে আজ ছোট কোনো সহজ অংশ দিয়ে শুরু করা যায়। আপনি কি আজকের জন্য ছোট একটি পরিকল্পনা তৈরি করতে চান?',
      detectedIntent: { type: 'plan', explanation: 'ব্যবহারকারী দ্বিধাদ্বন্দ্ব প্রকাশ করেছেন এবং দিকনির্দেশনা চেয়েছেন।' },
      actionProposal: undefined,
    };
  }

  // 3. User sharing life/daily journal reflection
  const isJournalSharing = mode === 'diary' ||
    lower.includes('দিনটা') || lower.includes('দিনটি') || lower.includes('ঘুম থেকে') || lower.includes('পড়াশোনা') ||
    lower.includes('কাজ করেছি') || lower.includes('গেলাম') || lower.includes('খেললাম') || lower.includes('শিখলাম') ||
    lower.includes('today') || lower.includes('woke up') || lower.includes('project');

  if (isJournalSharing) {
    const isBengali = /[\u0980-\u09FF]/.test(userMessage) || lower.includes('korechi') || lower.includes('valo');
    const reply = isBengali
      ? 'আপনার আজকের মুহূর্ত ও চিন্তাভাবনাগুলো জেনে খুব ভালো লাগল! প্রতিদিনের এই ছোট ছোট অর্জনগুলোই বড় পরিবর্তনের ভিত্তি। আমি আপনার আজকের অনুভূতিগুলো ডায়েরির পাতায় সংরক্ষণ করার জন্য প্রস্তুত করেছি।'
      : 'Thank you for sharing your thoughts and reflections from today. I have organized them into your daily journal entry for today.';

    return {
      reply,
      detectedIntent: { type: 'write', explanation: 'User shared daily reflections for the journal.' },
      actionProposal: {
        type: 'create_diary',
        targetName: `Journal: ${todayStr}`,
        data: {
          title: `Journal: ${todayStr}`,
          content: userMessage,
          date: todayStr,
          mood: 'positive',
          tags: ['daily-log', 'reflection'],
        },
        status: 'pending',
      },
    };
  }

  // 4. Default clean conversational response
  const isBengali = /[\u0980-\u09FF]/.test(userMessage) || lower.includes('amar') || lower.includes('koro');
  return {
    reply: isBengali
      ? 'আমি আপনার বার্তাটি পেয়েছি। আপনার চিন্তা, লেখা বা দৈনন্দিন পরিকল্পনা সুন্দরভাবে গুছিয়ে রাখতে আমি সাহায্য করতে প্রস্তুত। আপনি কি আর কিছু যোগ করতে চান?'
      : 'I have received your thoughts. How would you like to build on this together?',
    detectedIntent: { type: 'general', explanation: 'General response.' },
    actionProposal: undefined,
  };
}

function parseAndSanitizeAIResponse(rawText: string, todayStr: string, userMessage?: string): {
  reply: string;
  detectedIntent: { type: 'write' | 'improve' | 'summarize' | 'plan' | 'save' | 'general'; explanation: string };
  actionProposal?: {
    type: 'create_diary' | 'update_plan' | 'add_chapter' | 'create_skill' | 'replace_content';
    targetId?: string;
    targetName?: string;
    data: any;
    status: 'pending';
  };
} {
  if (!rawText) {
    return generateSmartLocalResponse(userMessage || '', 'default', todayStr);
  }

  let text = rawText.trim();
  // Strip markdown code fences if wrapped
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Attempt extraction of balanced { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch {
        // Regex extraction for reply field
        const replyMatch = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        if (replyMatch) {
          try {
            parsed = { reply: JSON.parse(`"${replyMatch[1]}"`) };
          } catch {
            parsed = { reply: replyMatch[1] };
          }
        }
      }
    }
  }

  // If not parsed as JSON, treat raw text as conversational reply directly
  if (!parsed || typeof parsed !== 'object') {
    return {
      reply: text,
      detectedIntent: { type: 'general', explanation: 'Conversation' },
      actionProposal: undefined,
    };
  }

  // Extract clean conversational reply text across possible keys
  let reply = '';
  const possibleReplyKeys = ['reply', 'response', 'content', 'message', 'text', 'answer', 'output'];
  for (const key of possibleReplyKeys) {
    if (typeof parsed[key] === 'string' && parsed[key].trim()) {
      reply = parsed[key].trim();
      break;
    }
  }

  // If reply itself contains stringified JSON or markdown JSON fence, unwrap it
  if (reply.startsWith('{') && (reply.includes('"reply"') || reply.includes('"message"'))) {
    try {
      const nested = JSON.parse(reply);
      for (const key of possibleReplyKeys) {
        if (typeof nested[key] === 'string' && nested[key].trim()) {
          reply = nested[key].trim();
          break;
        }
      }
      if (nested.actionProposal && !parsed.actionProposal) {
        parsed.actionProposal = nested.actionProposal;
      }
    } catch {
      // Keep reply
    }
  }

  // Strip accidental ```json fences inside reply
  if (reply.startsWith('```json')) {
    reply = reply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  if (!reply) {
    const smart = generateSmartLocalResponse(userMessage || '', 'default', todayStr);
    reply = smart.reply;
  }

  // Extract and sanitize actionProposal
  let actionProposal = (parsed.actionProposal || parsed.proposal || parsed.action) ? { ...(parsed.actionProposal || parsed.proposal || parsed.action) } : undefined;

  // SAFEGUARD: If user message was purely casual greeting or general conversation, do not attach unwanted actionProposal
  const userLower = (userMessage || '').toLowerCase();
  const isCasualGreeting = userLower.includes('kmn aso') || userLower.includes('kemon acho') || userLower === 'hi' || userLower === 'hello';
  if (isCasualGreeting && parsed.detectedIntent?.type === 'general') {
    actionProposal = undefined;
  }

  if (actionProposal && (actionProposal.type === 'create_diary' || actionProposal.type === 'update_diary')) {
    if (!actionProposal.data) actionProposal.data = {};
    const d = actionProposal.data;

    // Strict date enforcement: replace any 2024 or 2025 or placeholder with todayStr
    if (!d.date || d.date.includes('YYYY') || /202[0-5]/.test(d.date)) {
      d.date = todayStr;
    }

    // Sanitize title
    if (!d.title || d.title.includes('YYYY') || /202[0-5]/.test(d.title) || d.title.startsWith('Journal: 202')) {
      d.title = `Journal: ${d.date}`;
    }

    // Sanitize targetName
    if (!actionProposal.targetName || actionProposal.targetName.includes('YYYY') || /202[0-5]/.test(actionProposal.targetName)) {
      actionProposal.targetName = d.title;
    }

    // Sanitize date mentions in content header if model hallucinated past dates
    if (typeof d.content === 'string') {
      d.content = d.content.replace(/202[0-5]-\d{2}-\d{2}/g, todayStr);
    }

    actionProposal.status = 'pending';
  } else if (actionProposal) {
    actionProposal.status = 'pending';
  }

  return {
    reply,
    detectedIntent: parsed.detectedIntent || { type: 'general', explanation: 'Conversational response' },
    actionProposal,
  };
}

const chatResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Conversational, thoughtful, markdown-formatted response directly answering the user in their language.',
    },
    detectedIntent: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, description: 'One of: write, improve, summarize, plan, save, general' },
        explanation: { type: Type.STRING, description: 'Brief explanation of intent' },
      },
      required: ['type', 'explanation'],
    },
    actionProposal: {
      type: Type.OBJECT,
      description: 'Action proposal ONLY if saving, planning, or logging. Otherwise null.',
      properties: {
        type: { type: Type.STRING, description: 'create_diary, update_diary, update_plan, add_chapter, create_skill' },
        targetId: { type: Type.STRING },
        targetName: { type: Type.STRING },
        data: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            date: { type: Type.STRING },
            mood: { type: Type.STRING },
            weather: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            planTitle: { type: Type.STRING },
            newTasks: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING },
            chapterTitle: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            promptTemplate: { type: Type.STRING },
          },
        },
      },
    },
  },
  required: ['reply', 'detectedIntent'],
};

export async function chatWithContext(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  mode: 'default' | 'diary' | 'book' | 'plan';
  contextText?: string;
  attachments?: Array<{ type: string; id: string; title: string }>;
  customApiKey?: string;
  model?: string;
  clientDate?: string;
  clientTimezone?: string;
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
  const { messages, mode, contextText, attachments, customApiKey, model, clientDate, clientTimezone } = params;
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  // Authoritative date: user's client date if valid YYYY-MM-DD, otherwise server local date
  const todayStr = (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate))
    ? clientDate
    : new Date().toISOString().split('T')[0];

  const dateObj = new Date(`${todayStr}T12:00:00Z`);
  const dayOfWeek = isNaN(dateObj.getTime())
    ? 'Wednesday'
    : dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  const systemPrompt = `You are LifeNote AI, a thoughtful, minimalist writing companion and life organizer.

CURRENT CALENDAR DATE (CRITICAL):
- Today's Date: "${todayStr}" (${dayOfWeek})
- Current Year: 2026
- User Timezone: ${clientTimezone || 'User Local Time'}
- RULE: Never output or hallucinate past dates (e.g. 2024, 2025). When referring to today, strictly use "${todayStr}".

LANGUAGE & TONE:
- Adapt immediately to the user's language and dialect.
- If the user writes in Bengali (বাংলা) or phonetic Bengali (Banglish, e.g. "kmn aso", "ki korbo", "valo", "amar"), respond in natural, warm, and supportive Bengali (বাংলা).
- If the user writes in English, reply in articulate, thoughtful English.
- Be genuine, empathetic, and constructive.

CURRENT MODE: ${mode.toUpperCase()}
Available Saved Context:
${contextText ? contextText : '(No attached resources)'}

Attachments: ${attachments && attachments.length > 0 ? attachments.map(a => `${a.type.toUpperCase()}: "${a.title}"`).join(', ') : 'None'}

DIARY CONSTITUTION:
A Diary/Journal is strictly organized by DATE. Each calendar day has ONE single continuous page.
- Today's date is strictly "${todayStr}".
- If existing text for today is shown in context:
  * When the user gives new thoughts or daily moments, integrate them seamlessly into today's single record.
  * When the user corrects or refines details, update them in place while keeping the rest of today's page intact.
  * In 'actionProposal.data.content', always return the COMPLETE, unified text for that day's page so far.

ACTION PROPOSAL RULES (CRITICAL):
- 'actionProposal' must be NULL for:
  * Casual greetings (e.g. "Hi", "Hello", "Tmi kmn aso", "কেমন আছেন")
  * General questions or explanations (e.g. "What is Java?", "How to write well?")
  * Conversational banter or reflections where the user has NOT provided content to log or asked to save/record.
- 'actionProposal' should ONLY be provided when:
  * The user provides thoughts or moments for their journal (type: 'create_diary' or 'update_diary').
  * The user asks to create or update plan tasks (type: 'update_plan').
  * The user asks to draft/add a book chapter (type: 'add_chapter').
  * The user asks to save a custom AI skill (type: 'create_skill').

RESPONSE FORMAT:
Return valid JSON matching this schema:
{
  "reply": "Conversational markdown-formatted answer to the user in their language. NEVER leave blank. NEVER put raw JSON codeblocks here.",
  "detectedIntent": {
    "type": "write | improve | summarize | plan | save | general",
    "explanation": "Brief 1-sentence reason"
  },
  "actionProposal": null OR {
    "type": "create_diary | update_diary | update_plan | add_chapter | create_skill",
    "targetId": "ID if updating existing entry, else omit",
    "targetName": "Journal: ${todayStr}",
    "data": {
      "title": "Journal: ${todayStr}",
      "content": "Integrated text...",
      "date": "${todayStr}",
      "mood": "positive | thoughtful | motivated | calm | tired | creative",
      "tags": ["daily-log", "reflection"]
    }
  }
}`;

  const conversationHistory = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const fullPrompt = `${systemPrompt}\n\n=== Conversation History ===\n${conversationHistory}\n\nRespond with valid JSON:`;

  try {
    const ai = getGenAIClient(customApiKey);
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: chatResponseSchema,
      },
    });

    return parseAndSanitizeAIResponse(response.text?.trim() || '', todayStr, lastUserMessage);
  } catch (err) {
    console.warn('[AI Service] Primary structured generation warning, trying fallback:', err);
    try {
      const ai = getGenAIClient(customApiKey);
      const { response: fallbackResponse } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
        contents: `${systemPrompt}\n\nUser: ${lastUserMessage}\n\nRespond with valid JSON:`,
        config: {
          responseMimeType: 'application/json',
        },
      });
      return parseAndSanitizeAIResponse(fallbackResponse.text?.trim() || '', todayStr, lastUserMessage);
    } catch (fallbackErr) {
      console.warn('[AI Service] All AI models capacity constrained; engaging smart local fallback:', fallbackErr);
      return generateSmartLocalResponse(lastUserMessage, mode, todayStr, contextText);
    }
  }
}
