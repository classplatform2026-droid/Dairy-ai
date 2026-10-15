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
  action: 'improve' | 'beautify' | 'grammar' | 'expand' | 'shorten' | 'tone' | 'custom' | string;
  tone?: string;
  customPrompt?: string;
  customApiKey?: string;
  model?: string;
}): Promise<string> {
  const { text, action, tone, customPrompt, customApiKey, model } = params;
  try {
    const ai = getGenAIClient(customApiKey);

    let instruction = '';
    if (customPrompt && customPrompt.trim()) {
      instruction = `You are a thoughtful journal editor. Fulfill the following instruction on the provided diary text. Preserve the original language and emotional tone (if the text is in Bengali or Banglish, produce flawless, natural Bengali). Return ONLY the revised text without preamble or quotation marks: "${customPrompt.trim()}"`;
    } else {
      switch (action) {
        case 'grammar':
          instruction = 'You are an expert editor. Fix all spelling, punctuation, and grammatical mistakes while preserving the author\'s original thoughts and emotional voice. If the text is in Bengali or Banglish, produce flawless, natural Bengali (বাংলা). Return only the revised text without preamble or commentary.';
          break;
        case 'improve':
          instruction = 'You are a master essayist. Improve the sentence flow, vocabulary, and clarity of the writing. Maintain the natural voice, emotion, and authenticity. If the text is in Bengali, make the prose lyrical, polished, and graceful. Return only the revised text without commentary.';
          break;
        case 'beautify':
          instruction = 'You are a lyrical, contemplative writer. Beautify the text with evocative prose, refined rhythm, and poetic resonance while keeping it deeply personal and grounded. If in Bengali, write in elegant, evocative Bengali (বাংলা). Return only the revised text.';
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
          instruction = 'Polish and enhance the following text with clarity, elegance, and emotional depth. Return only the result.';
      }
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

export async function synthesizeDiaryPage(params: {
  content: string;
  title?: string;
  date: string;
  customApiKey?: string;
  model?: string;
}): Promise<{
  unifiedContent: string;
  title: string;
  mood: 'thoughtful' | 'peaceful' | 'happy' | 'energetic' | 'reflective';
}> {
  const { content, title, date, customApiKey, model } = params;
  const isBengali = /[\u0980-\u09FF]/.test(content) || /valo|posondo|amar|kori|din|shuru|mon|kotha|vab/i.test(content);

  try {
    const ai = getGenAIClient(customApiKey);

    const prompt = `You are LifeNote AI, a thoughtful and literary diary companion.
The user has recorded multiple thoughts, moments, or entries for the same calendar day (${date}).
Because thoughts were recorded at different times, the text may be scattered, fragmented, or repetitive.

CURRENT DATE: ${date}
CURRENT TITLE: "${title || ''}"
ACCUMULATED RAW DAY TEXT:
"""
${content}
"""

YOUR TASK:
1. READ THE WHOLE PAGE and synthesize all the thoughts, events, reflections, and emotions into ONE continuous, beautifully written, cohesive journal entry.
   - PRESERVE all key events, feelings, lessons, and observations. Do not leave out important personal moments.
   - Weave them into an elegant, naturally flowing first-person narrative ("I" / "আমি").
   - If the writing is in Bengali (বাংলা) or Banglish, produce polished, emotionally rich, literary Bengali (বাংলা).
   - If in English, produce articulate, evocative English.
2. TITLE: Create an evocative, memorable, inspiring title based on the day's themes.
3. MOOD: Analyze the overall emotional arc of the day and choose the single best mood from strictly:
   ["thoughtful", "peaceful", "happy", "energetic", "reflective"].

Return ONLY a valid JSON object matching this schema without markdown code blocks:
{
  "unifiedContent": "The synthesized unified continuous journal entry",
  "title": "Evocative title",
  "mood": "thoughtful"
}`;

    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = (response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);

    const validMoods = ['thoughtful', 'peaceful', 'happy', 'energetic', 'reflective'];
    const chosenMood = validMoods.includes(parsed.mood) ? parsed.mood : 'thoughtful';

    return {
      unifiedContent: (parsed.unifiedContent || content).trim(),
      title: (parsed.title || title || (isBengali ? 'আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত' : `Journal: ${date}`)).trim(),
      mood: chosenMood as any,
    };
  } catch (err) {
    console.warn('[AI Service] synthesizeDiaryPage fallback engaged:', err);

    const lower = content.toLowerCase();
    let fallbackMood: 'thoughtful' | 'peaceful' | 'happy' | 'energetic' | 'reflective' = 'thoughtful';
    if (lower.includes('shanti') || lower.includes('peace') || lower.includes('quiet') || lower.includes('ঘুম') || lower.includes('প্রশান্তি')) {
      fallbackMood = 'peaceful';
    } else if (lower.includes('happy') || lower.includes('khushi') || lower.includes('আনন্দ') || lower.includes('valo') || lower.includes('হাসি')) {
      fallbackMood = 'happy';
    } else if (lower.includes('energy') || lower.includes('কাজ') || lower.includes('goal') || lower.includes('active')) {
      fallbackMood = 'energetic';
    } else if (lower.includes('vab') || lower.includes('reflect') || lower.includes('ভাবনা') || lower.includes('মন')) {
      fallbackMood = 'reflective';
    }

    const cleanTitle = (title && !title.startsWith('Journal: 202'))
      ? title
      : (isBengali ? 'আত্মোপলব্ধি ও দিনের সমন্বিত ভাবনা' : `Reflections: ${date}`);

    return {
      unifiedContent: content.trim(),
      title: cleanTitle,
      mood: fallbackMood,
    };
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

export function craftBeautifulJournalEntry(input: string, _todayStr?: string): string {
  const clean = (input || '').trim();
  const lower = clean.toLowerCase();

  const isBengali = /[\u0980-\u09FF]/.test(clean) ||
    /posondo|valo|kemon|kori|din|mon|amar|bujhi|shuru|achhi|vab|mone|ki|kisu|shokal|raat|kaj|kotha|leka|likhe|jarnal|hypocrisy|nijer|shob|korsi|chilam|korbo|bujhe|somoy|ghorer/i.test(clean);

  // 1. Hypocrisy / Inner Contradiction / Self-criticism
  if (lower.includes('hypocrisy') || lower.includes('দ্বিচারিতা') || lower.includes('ভণ্ডামি') || lower.includes('নিজের সাথে') || lower.includes('contradiction')) {
    if (isBengali) {
      return 'আজকের দিনটি ছিল এক নীরব আত্মোপলব্ধির মুহূর্ত। মনের ভেতরের দ্বিচারিতা ও স্ববিরোধিতাগুলোকে অকপটে স্বীকার করে নেওয়াই প্রকৃত আত্মউন্নয়নের প্রথম ধাপ। জীবনের অনেক আদর্শ আমরা বিশ্বাস করি, কিন্তু বাস্তবতায় অনেক সময় আমাদের কাজের সাথে সেই বিশ্বাসের ব্যবধান থেকে যায়। এই অসঙ্গতি এড়িয়ে না গিয়ে সততার সাথে গ্রহণ করার সাহসই মানুষকে পরিণত করে তোলে। নিজের সীমাবদ্ধতাগুলোকে উপলব্ধি করে সামনে এগিয়ে যাওয়ার এই প্রয়াস জীবনকে আরও অর্থবহ ও খাঁটি করে তুলবে।';
    }
    return 'Today brought a moment of quiet personal reflection and honest contemplation on human contradictions. Acknowledging the gap between our ideals and our daily reality is the very first step of true growth. Rather than judging our shortcomings, recognizing them with honesty allows us to navigate tomorrow with greater mindfulness and intentionality.';
  }

  // 2. Daily Routine / Morning lethargy / Habits
  if (lower.includes('phone') || lower.includes('ঘুম') || lower.includes('shokal') || lower.includes('deri') || lower.includes('woke up') || lower.includes('alosh') || lower.includes('অলসতা') || lower.includes('সময়')) {
    if (isBengali) {
      return 'আজকের সকালটি ভাবনার ভেতর দিয়ে শুরু হলেও, নিজের সময় ও অভ্যাসের প্রতি এক নতুন সচেতনতা তৈরি হয়েছে। জীবনের প্রতিটি মুহূর্তের সঠিক মূল্য অনুধাবন করা এবং অপ্রয়োজনীয় বিভ্রান্তি থেকে নিজেকে সরিয়ে রাখাই মনকে প্রশান্ত করে। প্রতিদিন নিজেকে নতুন করে গড়ার সুযোগ থাকে; আজকের এই আত্মোপলব্ধি আগামী দিনগুলোতে আরও শৃঙ্খলিত ও স্থির হতে সাহায্য করবে।';
    }
    return 'Today began with a quiet reminder about the value of time and intentional habits. Stepping back from early inertia and modern distractions brings a renewed sense of focus. Every day offers a fresh canvas to cultivate discipline, presence, and mindful living.';
  }

  // 3. General thoughtful reflection
  if (isBengali) {
    return 'আজকের দিনটি ছিল এক গভীর আত্মানুসন্ধান ও নীরব অনুভূতির মুহূর্ত। জীবনপ্রবাহের ব্যস্ততার মাঝে নিজের ভেতরের সৎ চিন্তা ও ভাবনার মুখোমুখি হওয়া সত্যি মূল্যবান। বাহ্যিক কোলাহলের চেয়ে মনের ভেতরের প্রশান্তি ও সত্যকে আবিষ্কার করাই দিনটিকে অর্থবহ করে তোলে। আজকের অভিজ্ঞতা ও অনুভূতিগুলোকে স্মৃতির পাতায় ধরে রাখলাম, যা আগামী পথচলায় দিকনির্দেশনা দেবে।';
  }

  return 'Today brought a moment of quiet contemplation and honest personal reflection. Stepping back from the noise of the day to process these thoughts brings clarity and grounded perspective. Capturing these insights allows us to embrace life with greater awareness and deliberate purpose.';
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
      reply: 'আমি ভালো আছি, ধন্যবাদ! আপনার দিনটি কেমন কাটছে?',
      detectedIntent: { type: 'general', explanation: 'ব্যবহারকারী কুশল বিনিময় করেছেন।' },
      actionProposal: undefined,
    };
  }

  if (isEnglishGreeting) {
    return {
      reply: 'Hello! I am doing well, thank you. How is your day going?',
      detectedIntent: { type: 'general', explanation: 'User greeted the assistant.' },
      actionProposal: undefined,
    };
  }

  // 2. Uncertainty / Planning question in Bengali/Banglish
  if (lower.includes('ki korbo') || lower.includes('bujte parsi na') || lower.includes('jani na') || lower.includes('কী করব') || lower.includes('কীভাবে')) {
    return {
      reply: 'দ্বিধা হওয়া স্বাভাবিক! চলুন আজকের জন্য ছোট একটি পরিকল্পনা তৈরি করি।',
      detectedIntent: { type: 'plan', explanation: 'ব্যবহারকারী দিকনির্দেশনা চেয়েছেন।' },
      actionProposal: undefined,
    };
  }

  // 3. User sharing life/daily journal reflection
  const isJournalSharing = mode === 'diary' ||
    lower.includes('দিনটা') || lower.includes('দিনটি') || lower.includes('ঘুম থেকে') || lower.includes('পড়াশোনা') ||
    lower.includes('কাজ করেছি') || lower.includes('গেলাম') || lower.includes('খেললাম') || lower.includes('শিখলাম') ||
    lower.includes('posondo') || lower.includes('পছন্দ') || lower.includes('ভাবছি') ||
    lower.includes('today') || lower.includes('woke up') || lower.includes('project');

  if (isJournalSharing) {
    const isBengali = /[\u0980-\u09FF]/.test(userMessage) || lower.includes('korechi') || lower.includes('valo') || lower.includes('posondo');
    const reply = isBengali
      ? 'আপনার অনুভূতিগুলো সুন্দরভাবে জার্নালে সাজিয়ে লিখে রেখেছি।'
      : 'I have recorded your thoughts into your journal for today.';

    const polishedEntry = craftBeautifulJournalEntry(userMessage, todayStr);
    const title = isBengali ? 'আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত' : `Reflections: ${todayStr}`;

    return {
      reply,
      detectedIntent: { type: 'write', explanation: 'User shared daily reflections for the journal.' },
      actionProposal: {
        type: 'create_diary',
        targetName: title,
        data: {
          title,
          content: polishedEntry,
          date: todayStr,
          mood: 'thoughtful',
          tags: isBengali ? ['আত্মোপলব্ধি', 'অনুভূতি', 'জীবনদর্শন'] : ['daily-log', 'reflection'],
        },
        status: 'pending',
      },
    };
  }

  // 4. Default clean conversational response
  const isBengali = /[\u0980-\u09FF]/.test(userMessage) || lower.includes('amar') || lower.includes('koro');
  return {
    reply: isBengali
      ? 'আপনার চিন্তাটি আমি পেয়েছি। এটি নিয়ে আর কিছু যোগ করতে চান?'
      : 'I received your thought. How would you like to build on this?',
    detectedIntent: { type: 'general', explanation: 'General response.' },
    actionProposal: undefined,
  };
}

function parseAndSanitizeAIResponse(
  rawText: string,
  todayStr: string,
  userMessage?: string,
  mode: string = 'default'
): {
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
    return generateSmartLocalResponse(userMessage || '', mode, todayStr);
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
    let cleanReply = text;
    // Keep reply concise
    if (cleanReply.length > 350) {
      const sentences = cleanReply.split(/(?<=[.?!।\n])\s+/);
      if (sentences.length > 2) {
        cleanReply = sentences.slice(0, 2).join(' ').trim();
      }
    }
    return {
      reply: cleanReply,
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
    const smart = generateSmartLocalResponse(userMessage || '', mode, todayStr);
    reply = smart.reply;
  }

  // STRICT BREVITY ENFORCEMENT: Never allow AI reply to be a massive essay.
  // Keep to 1-2 concise sentences so user does not get overwhelmed.
  if (reply && reply.length > 350) {
    const sentences = reply.split(/(?<=[.?!।\n])\s+/).filter(Boolean);
    if (sentences.length > 2) {
      reply = sentences.slice(0, 2).join(' ').trim();
    }
  }

  // Extract and sanitize actionProposal
  let actionProposal = (parsed.actionProposal || parsed.proposal || parsed.action)
    ? { ...(parsed.actionProposal || parsed.proposal || parsed.action) }
    : undefined;

  // SAFEGUARD: If user message was purely casual greeting or general conversation, do not attach unwanted actionProposal
  const userLower = (userMessage || '').toLowerCase();
  const isCasualGreeting = userLower.includes('kmn aso') || userLower.includes('kemon acho') || userLower === 'hi' || userLower === 'hello';
  if (isCasualGreeting && parsed.detectedIntent?.type === 'general') {
    actionProposal = undefined;
  }

  if (actionProposal) {
    let rawType = String(actionProposal.type || '').toLowerCase().trim();

    // Clean up pipes or corrupted schema strings like "CREATE_DIARY | UPDATE_DIARY | ..."
    if (rawType.includes('|') || !['create_diary', 'update_diary', 'update_plan', 'add_chapter', 'create_skill'].includes(rawType)) {
      if (rawType.includes('diary') || rawType.includes('journal') || mode === 'diary' || parsed.detectedIntent?.type === 'write' || parsed.detectedIntent?.type === 'save') {
        rawType = 'create_diary';
      } else if (rawType.includes('plan') || mode === 'plan' || parsed.detectedIntent?.type === 'plan') {
        rawType = 'update_plan';
      } else if (rawType.includes('chapter') || rawType.includes('book') || mode === 'book') {
        rawType = 'add_chapter';
      } else if (rawType.includes('skill')) {
        rawType = 'create_skill';
      } else {
        rawType = 'create_diary';
      }
    }
    actionProposal.type = rawType;

    if (!actionProposal.data || typeof actionProposal.data !== 'object') {
      actionProposal.data = {};
    }
    const d = actionProposal.data;

    if (actionProposal.type === 'create_diary' || actionProposal.type === 'update_diary') {
      // Strict date enforcement: replace any 2024 or 2025 or placeholder with todayStr
      if (!d.date || d.date.includes('YYYY') || /202[0-5]/.test(d.date)) {
        d.date = todayStr;
      }

      // Extract content from any possible field
      let entryContent = (d.content || d.text || d.entry || d.body || d.journal || d.notes || actionProposal.content || '').trim();

      // Ensure content is an articulate, beautiful reflection.
      // If the model left it blank, or literally echoed the user's raw informal words, or wrote less than 8 words:
      const isRawOrBrief = !entryContent ||
        (userMessage && entryContent.trim().toLowerCase() === userMessage.trim().toLowerCase()) ||
        entryContent.split(/\s+/).length < 8;

      if (isRawOrBrief) {
        entryContent = craftBeautifulJournalEntry(userMessage || entryContent || reply, todayStr);
      }

      // Sanitize title
      const isBengaliEntry = /[\u0980-\u09FF]/.test(entryContent);
      if (!d.title || d.title.includes('YYYY') || /202[0-5]/.test(d.title) || d.title.startsWith('Journal: 202')) {
        d.title = isBengaliEntry ? 'আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত' : `Reflections: ${d.date}`;
      }

      // Sanitize targetName
      if (!actionProposal.targetName || actionProposal.targetName.includes('YYYY') || /202[0-5]/.test(actionProposal.targetName) || actionProposal.targetName.startsWith('Journal: 202')) {
        actionProposal.targetName = d.title;
      }

      // Sanitize date mentions in content header if model hallucinated past dates
      if (typeof entryContent === 'string') {
        entryContent = entryContent.replace(/202[0-5]-\d{2}-\d{2}/g, todayStr);
      }

      d.content = entryContent;
      d.mood = d.mood || 'thoughtful';
      d.tags = Array.isArray(d.tags) && d.tags.length > 0
        ? d.tags
        : (isBengaliEntry ? ['আত্মোপলব্ধি', 'অনুভূতি', 'জীবনদর্শন'] : ['daily-log', 'reflection']);
      actionProposal.status = 'pending';
    } else {
      actionProposal.status = 'pending';
    }
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
      description: 'Short, warm, concise reply in the user\'s language (1 to 2 sentences max). Never write long lectures, essays, or multiple paragraphs.',
    },
    detectedIntent: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ['write', 'improve', 'summarize', 'plan', 'save', 'general'],
          description: 'One of: write, improve, summarize, plan, save, general',
        },
        explanation: { type: Type.STRING, description: 'Brief explanation of intent' },
      },
      required: ['type', 'explanation'],
    },
    actionProposal: {
      type: Type.OBJECT,
      description: 'Action proposal ONLY if saving, planning, or logging. Otherwise null.',
      properties: {
        type: {
          type: Type.STRING,
          enum: ['create_diary', 'update_diary', 'update_plan', 'add_chapter', 'create_skill'],
          description: 'The action type to perform. Choose strictly one.',
        },
        targetId: { type: Type.STRING },
        targetName: { type: Type.STRING },
        data: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'An evocative, inspiring title in Bengali (বাংলা) or English (e.g., "আত্মোপলব্ধি ও মনের গভীর সত্য").',
            },
            content: {
              type: Type.STRING,
              description: 'MANDATORY: Beautifully articulated, lyrical, and polished journal entry expanding on the user\'s thoughts and feelings with emotional depth and literary beauty. NEVER copy-paste the user\'s raw brief words. Write a refined, articulate reflection in Bengali (বাংলা) if user writes in Bengali/Banglish.',
            },
            date: { type: Type.STRING, description: 'Date in YYYY-MM-DD' },
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
- If the user writes in Bengali (বাংলা) or phonetic Bengali (Banglish, e.g. "kmn aso", "ki korbo", "valo", "amar", "posondo kori"), respond in natural, warm Bengali (বাংলা).
- If the user writes in English, reply in articulate, thoughtful English.

CONCISENESS FOR CHAT REPLY (MANDATORY):
- The conversational "reply" MUST BE VERY SHORT (1 to 2 sentences maximum).
- NEVER write long paragraphs, essays, or philosophical lectures in "reply".

JOURNAL CRAFTING CONSTITUTION (CRITICAL):
When the user shares personal reflections, thoughts, emotions, habits, or experiences (even in brief or casual words like "posondo kori", "bujte parsi na"):
1. THE CONVERSATIONAL REPLY:
   - Acknowledge their thought warmly in 1 short sentence in "reply" (e.g. "আপনার অনুভূতিটুকু সত্যি সুন্দর ও খাঁটি; এটি আপনার জার্নালের জন্য চমৎকারভাবে লিখে দিয়েছি।").
2. THE ACTION PROPOSAL (actionProposal.data.content):
   - CRITICAL: NEVER just copy-paste the user's raw brief words or repeat what they typed!
   - Act as an eloquent essayist and master journal companion: transform their raw thoughts into a beautifully crafted, evocative, and deeply reflective journal entry in proper Bengali (বাংলা).
   - Express the psychological insight, emotional depth, and literary beauty of their reflection.
   - Give it an inspiring, poetic title (e.g. "আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত", "নীরব আত্মদর্শন").
   - The user expects the proposal box to contain an elevated, polished AI output that they are proud to keep in their diary.

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
  * In 'actionProposal.data.content', always return the COMPLETE, beautifully unified text for that day's page.

ACTION PROPOSAL RULES (CRITICAL):
- 'actionProposal' must be NULL for:
  * Casual greetings (e.g. "Hi", "Hello", "Tmi kmn aso", "কেমন আছেন")
  * General knowledge questions
  * Banter where no thoughts or tasks need saving
- 'actionProposal' should ONLY be provided when the user shares thoughts, feelings, plans, or asks to log something:
  * type: "create_diary" (for new journal reflection)
  * type: "update_plan" (for goals and tasks)
  * type: "add_chapter" (for book writing)
  * type: "create_skill" (for custom prompt skills)

RESPONSE FORMAT:
Return valid JSON matching this schema:
{
  "reply": "আপনার এই অনুভূতিটুকু সত্যি মূল্যবান; এটি আপনার জার্নালে সুন্দর ভাষায় গুছিয়ে রূপ দিয়েছি।",
  "detectedIntent": {
    "type": "write",
    "explanation": "User shared personal reflections"
  },
  "actionProposal": {
    "type": "create_diary",
    "targetName": "আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত",
    "data": {
      "title": "আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত",
      "content": "মানুষের ভেতরের দ্বিচারিতা আর অভ্যাসের টানাপোড়েন জীবনের এক চিরন্তন সত্য। যা ভালো লাগে বা যা সত্য বলে জানি, অনেক সময় দৈনন্দিন আলস্যের বেড়াজালে তা হারিয়ে যায়। কিন্তু এই নিজের ফাঁকিবাজি বুঝতে পারা এবং তা স্বীকার করতে পারাটাই হলো আত্মউন্নয়নের প্রথম ধাপ। নিজের পছন্দ-অপছন্দ আর সীমাবদ্ধতাগুলোকে ভালোবেসে স্বীকার করে নিয়েই নতুন দিনের সূচনা সম্ভব।",
      "date": "${todayStr}",
      "mood": "thoughtful",
      "tags": ["আত্মোপলব্ধি", "অনুভূতি", "জীবনদর্শন"]
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

    return parseAndSanitizeAIResponse(response.text?.trim() || '', todayStr, lastUserMessage, mode);
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
      return parseAndSanitizeAIResponse(fallbackResponse.text?.trim() || '', todayStr, lastUserMessage, mode);
    } catch (fallbackErr) {
      console.warn('[AI Service] All AI models capacity constrained; engaging smart local fallback:', fallbackErr);
      return generateSmartLocalResponse(lastUserMessage, mode, todayStr, contextText);
    }
  }
}

