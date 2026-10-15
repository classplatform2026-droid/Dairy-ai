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
      : promptTemplate.includes('{input}')
      ? promptTemplate.replace(/\{input\}/g, text)
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

export async function executeSkillAdvanced(params: {
  promptTemplate: string;
  skillMd?: string;
  input: string;
  variables?: Record<string, string>;
  customApiKey?: string;
  model?: string;
}): Promise<{ output: string; durationMs: number; model: string }> {
  const { promptTemplate, skillMd, input, variables = {}, customApiKey, model } = params;
  const startTime = Date.now();

  try {
    const ai = getGenAIClient(customApiKey);

    let compiledPrompt = promptTemplate || '';

    // If variables provided, replace each {key}
    if (variables && typeof variables === 'object') {
      Object.entries(variables).forEach(([k, v]) => {
        compiledPrompt = compiledPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }

    // Default variable replacements if not already replaced
    if (compiledPrompt.includes('{text}')) {
      compiledPrompt = compiledPrompt.replace(/\{text\}/g, input);
    }
    if (compiledPrompt.includes('{input}')) {
      compiledPrompt = compiledPrompt.replace(/\{input\}/g, input);
    }
    if (!compiledPrompt.includes(input)) {
      compiledPrompt = `${compiledPrompt}\n\nContent to process:\n${input}`;
    }

    // If full SKILL.md is available, ground the model with its constraints and rules
    let promptWithContext = compiledPrompt;
    if (skillMd && skillMd.includes('## Constraints')) {
      promptWithContext = `[EXECUTION SPECIFICATION FOR SKILL]\n${skillMd}\n\n---\n[EXECUTION TASK]\n${compiledPrompt}`;
    }

    const { response, usedModel } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: promptWithContext,
    });

    const durationMs = Date.now() - startTime;
    return {
      output: response.text?.trim() || input,
      durationMs,
      model: usedModel,
    };
  } catch (err) {
    console.warn('[AI Service] Advanced skill execution error:', err);
    return {
      output: `Skill execution encountered an issue. Raw input retained:\n\n${input}`,
      durationMs: Date.now() - startTime,
      model: model || 'gemini-3.8-flash',
    };
  }
}

export async function generateSkillFromConversation(params: {
  prompt: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  currentDraft?: any;
  customApiKey?: string;
  model?: string;
}): Promise<{
  name: string;
  description: string;
  category: string;
  promptTemplate: string;
  variables: string[];
  tags: string[];
  icon: string;
  skillMd: string;
  assistantReply: string;
}> {
  const { prompt, conversationHistory = [], currentDraft, customApiKey, model } = params;

  const systemInstruction = `You are the Master AI Skill Architect in LifeNote AI.
Your job is to help users design, refine, and generate production-grade, reusable AI Skills structured as complete "SKILL.md" documents.

A complete SKILL.md must strictly adhere to this format:
---
name: "Skill Name"
description: "Precise summary of the skill's purpose and value"
category: "Writing" | "Refinement" | "Planning" | "Summarization" | "Creative" | "Analysis"
version: "1.0.0"
inputs:
  - text
tags:
  - tag1
  - tag2
icon: "Sparkles" | "Feather" | "BookOpen" | "Compass" | "CheckCircle" | "ListChecks" | "Moon" | "Sun" | "Coffee" | "Heart" | "Flame"
---

# [Skill Name]

## Purpose
[High-level purpose and reason for this skill]

## Use Cases
- [When to use this skill]
- [Example scenario 2]

## Required Inputs
- \`text\`: [Description of the input]

## Step-by-Step Workflow
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Constraints & Rules
- [Rule 1: e.g. Preserve voice, facts, language]
- [Rule 2: e.g. Output format rules]
- [Rule 3: e.g. Language rules (Bengali/English)]

## Examples
### Example 1
**Input:**
\`\`\`
[Realistic sample input]
\`\`\`

**Output:**
\`\`\`
[Realistic transformed output]
\`\`\`

## Edge Cases
- [How to handle short, noisy, or edge input]

YOUR TASK:
Given the user's message, any conversation history, and current draft:
1. Understand the skill's purpose, use cases, inputs, output expectations, instructions, constraints, and examples.
2. Produce a polished, complete JSON object.
3. In 'assistantReply', provide a short, warm, intelligent conversational response (1-2 sentences) explaining what was crafted or refined, and inviting them to test it in the live workspace.

Return ONLY a valid JSON object matching this schema without markdown code blocks:
{
  "name": "Skill Name",
  "description": "Short description (under 120 chars)",
  "category": "Writing",
  "promptTemplate": "The actual executable instructions with {text} placeholder for the model to follow",
  "variables": ["text"],
  "tags": ["writing", "polish"],
  "icon": "Feather",
  "skillMd": "The complete, pristine SKILL.md markdown text with YAML frontmatter",
  "assistantReply": "Conversational explanation of what was built and prompt to test."
}`;

  const historyText = conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const draftContext = currentDraft ? `\n\nCURRENT DRAFT STATE:\n${JSON.stringify(currentDraft, null, 2)}` : '';

  const fullPrompt = `${systemInstruction}

${draftContext}

=== Conversation History ===
${historyText ? historyText : '(No prior messages)'}

User Request: "${prompt}"

Return ONLY valid JSON:`;

  try {
    const ai = getGenAIClient(customApiKey);
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = (response.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);

    return {
      name: parsed.name || 'Custom Skill',
      description: parsed.description || 'Custom LifeNote AI skill',
      category: parsed.category || 'Writing',
      promptTemplate: parsed.promptTemplate || 'Transform the following text:\n\n"{text}"',
      variables: Array.isArray(parsed.variables) && parsed.variables.length > 0 ? parsed.variables : ['text'],
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['custom'],
      icon: parsed.icon || 'Sparkles',
      skillMd: parsed.skillMd || '',
      assistantReply: parsed.assistantReply || 'I have crafted your skill specification and generated the SKILL.md file.',
    };
  } catch (err) {
    console.warn('[AI Service] generateSkillFromConversation fallback:', err);
    // Smart deterministic fallback
    const cleanName = prompt.slice(0, 32).trim() || 'Custom Skill';
    const fallbackTemplate = `Execute the following task with high precision and clarity:\n${prompt}\n\nInput Content:\n"{text}"`;
    const fallbackMd = `---
name: "${cleanName}"
description: "AI skill designed for: ${prompt.slice(0, 80)}"
category: Writing
version: 1.0.0
inputs:
  - text
tags:
  - custom
icon: Sparkles
---

# ${cleanName}

## Purpose
${prompt}

## Required Inputs
- \`text\`: The raw content to process.

## Step-by-Step Workflow
1. Read and analyze the input text carefully.
2. Apply the desired transformation according to the user's intent.
3. Review for clarity, flow, and faithfulness.
4. Output the result cleanly without conversational commentary.

## Constraints & Rules
- Retain the authentic voice and intent of the input.
- If the text is in Bengali, produce natural, refined Bengali.
- Output ONLY the result.

## Examples
### Example 1
**Input:**
\`\`\`
Sample text
\`\`\`

**Output:**
\`\`\`
Polished transformation
\`\`\`

## Edge Cases
- For empty or ultra-short input, ask for clarification or provide a meaningful reflection.
`;

    return {
      name: cleanName,
      description: `Skill for: ${prompt.slice(0, 70)}...`,
      category: 'Writing',
      promptTemplate: fallbackTemplate,
      variables: ['text'],
      tags: ['custom'],
      icon: 'Sparkles',
      skillMd: fallbackMd,
      assistantReply: 'I have generated your skill structure and SKILL.md. You can now test it with sample inputs or refine its instructions.',
    };
  }
}

export async function refineSkillFromFeedback(params: {
  currentSkillMd: string;
  feedback: string;
  testOutput?: string;
  customApiKey?: string;
  model?: string;
}): Promise<{
  skillMd: string;
  promptTemplate: string;
  description: string;
  explanation: string;
}> {
  const { currentSkillMd, feedback, testOutput, customApiKey, model } = params;

  const prompt = `You are an expert AI Skill Engineer.
A user tested a skill and wants to refine its instructions, workflow, or constraints.

CURRENT SKILL.MD:
"""
${currentSkillMd}
"""

${testOutput ? `RECENT TEST OUTPUT:\n"""\n${testOutput}\n"""\n` : ''}

USER REFINEMENT FEEDBACK:
"${feedback}"

TASK:
1. Update the SKILL.md document to address the user's feedback precisely (e.g. adjust workflow, add/refine rules, improve examples, fix edge cases).
2. Extract the updated executable 'promptTemplate'.
3. Increment or maintain version appropriately.

Return ONLY a valid JSON object matching this schema:
{
  "skillMd": "The updated complete SKILL.md",
  "promptTemplate": "The updated executable prompt template",
  "description": "Updated or current description",
  "explanation": "Brief explanation of what was modified"
}`;

  try {
    const ai = getGenAIClient(customApiKey);
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = (response.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[AI Service] refineSkillFromFeedback fallback:', err);
    return {
      skillMd: currentSkillMd,
      promptTemplate: 'Please execute according to instructions:\n"{text}"',
      description: 'Custom skill',
      explanation: 'Could not automatically refine; please edit the markdown directly.',
    };
  }
}

export async function structureIdeaFromContent(params: {
  content: string;
  category?: string;
  customApiKey?: string;
  model?: string;
}): Promise<{
  title: string;
  category: string;
  tags: string[];
  sections: {
    overview: string;
    problemAndSolution: string;
    targetAudience: string;
    features: string;
    businessModel: string;
    competitors: string;
    implementationPlan: string;
    risks: string;
    improvementOpportunities: string;
  };
  missingQuestions: string[];
  weaknesses: string[];
  suggestedImprovements: string[];
}> {
  const { content, category, customApiKey, model } = params;
  const isBengali = /[\u0980-\u09FF]/.test(content);

  const prompt = `You are a world-class venture architect, product strategist, and startup mentor.
Your task is to take the user's raw thoughts, pitch, conversation, or brainstorm notes about an idea, and organize it into 9 structured, crisp sections.

Raw Idea Content:
"""
${content}
"""

Category Hint (if any): "${category || ''}"

Analyze the idea critically and thoroughly. Return a valid JSON object matching this schema without markdown code blocks:
{
  "title": "A clear, compelling title for the idea (in the language of the input, e.g. Bengali or English)",
  "category": "One of: Tech & AI, Business, Productivity, Creative, Social, Personal, or Other",
  "tags": ["tag1", "tag2", "tag3"],
  "sections": {
    "overview": "High-level summary of what the idea is and its unique value proposition.",
    "problemAndSolution": "The exact pain point being addressed and how this solution uniquely solves it.",
    "targetAudience": "Who will use, purchase, or benefit from this. Specific user personas.",
    "features": "Bullet-point breakdown of key capabilities, workflows, and core features.",
    "businessModel": "How this can be monetized, sustained, or delivered efficiently.",
    "competitors": "Existing alternatives, direct/indirect competitors, and key differentiators.",
    "implementationPlan": "Actionable rollout phases (MVP, validation, launch steps).",
    "risks": "Primary pitfalls, technical roadblocks, or market adoption challenges.",
    "improvementOpportunities": "High-impact ways to expand, strengthen, or refine the idea."
  },
  "missingQuestions": [
    "Key question 1 about missing critical information",
    "Key question 2 about target pricing or distribution"
  ],
  "weaknesses": [
    "Identified potential bottleneck or flaw 1",
    "Identified potential bottleneck or flaw 2"
  ],
  "suggestedImprovements": [
    "Actionable improvement recommendation 1",
    "Actionable improvement recommendation 2"
  ]
}`;

  try {
    const ai = getGenAIClient(customApiKey);
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = (response.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || (isBengali ? 'নতুন আইডিয়া' : 'New Project Idea'),
      category: parsed.category || category || 'Tech & AI',
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['idea'],
      sections: {
        overview: parsed.sections?.overview || content.slice(0, 200),
        problemAndSolution: parsed.sections?.problemAndSolution || '',
        targetAudience: parsed.sections?.targetAudience || '',
        features: parsed.sections?.features || '',
        businessModel: parsed.sections?.businessModel || '',
        competitors: parsed.sections?.competitors || '',
        implementationPlan: parsed.sections?.implementationPlan || '',
        risks: parsed.sections?.risks || '',
        improvementOpportunities: parsed.sections?.improvementOpportunities || '',
      },
      missingQuestions: Array.isArray(parsed.missingQuestions) ? parsed.missingQuestions : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      suggestedImprovements: Array.isArray(parsed.suggestedImprovements) ? parsed.suggestedImprovements : [],
    };
  } catch (err) {
    console.warn('[AI Service] structureIdeaFromContent fallback:', err);
    return {
      title: isBengali ? 'নতুন উদ্ভাবনী আইডিয়া' : 'New Concept',
      category: category || 'Tech & AI',
      tags: ['idea', 'concept'],
      sections: {
        overview: content,
        problemAndSolution: isBengali ? 'সমস্যা ও সমাধানের রূপরেখা প্রস্তুত করা প্রয়োজন।' : 'Identifies a core pain point and addresses it directly.',
        targetAudience: isBengali ? 'সুনির্দিষ্ট ব্যবহারকারী ও লক্ষ্য দল।' : 'Early adopters and active users.',
        features: isBengali ? 'মূল ফিচার ও কর্মপদ্ধতি।' : 'Core product features and key user flows.',
        businessModel: isBengali ? 'ব্যবসায়িক মডেল ও রাজস্ব পরিকল্পনা।' : 'Value-based monetization or subscription.',
        competitors: isBengali ? 'বর্তমান বিকল্প পদ্ধতি ও প্রতিযোগী।' : 'Existing alternatives and competitors.',
        implementationPlan: isBengali ? 'প্রাথমিক ধাপ: প্রোটোটাইপ তৈরি ও যাচাই।' : 'Phase 1: MVP build & rapid user testing.',
        risks: isBengali ? 'সম্ভাব্য ঝুঁকি ও চ্যালেঞ্জ।' : 'Adoption barriers and technical dependencies.',
        improvementOpportunities: isBengali ? 'ভবিষ্যৎ উন্নয়নের সুযোগ।' : 'High-impact feature expansions.',
      },
      missingQuestions: isBengali
        ? ['এই আইডিয়াটির প্রধান টার্গেট অডিয়েন্স কারা?', 'মনোটাইজেশন বা আয়ের উৎস কী হবে?']
        : ['Who is the primary paying customer?', 'What is your competitive moat?'],
      weaknesses: isBengali
        ? ['বাজার যাচাই ও ব্যবহারকারীর ফিডব্যাক সংগ্রহ করা প্রয়োজন।']
        : ['Needs clear initial validation and distribution strategy.'],
      suggestedImprovements: isBengali
        ? ['প্রথম ধাপে একটি ছোট MVP তৈরি করে যাচাই করুন।']
        : ['Start with a tightly scoped MVP to test core assumptions.'],
    };
  }
}

export async function analyzeIdeaAndSuggestImprovements(params: {
  idea: any;
  customApiKey?: string;
  model?: string;
}): Promise<{
  critique: string;
  weaknesses: string[];
  missingQuestions: string[];
  suggestedImprovements: string[];
  nextSteps: string[];
}> {
  const { idea, customApiKey, model } = params;

  const ideaSummary = `
Title: ${idea.title || 'Untitled'}
Category: ${idea.category || 'General'}
Tags: ${(idea.tags || []).join(', ')}
Sections:
- Overview: ${idea.sections?.overview || 'N/A'}
- Problem & Solution: ${idea.sections?.problemAndSolution || 'N/A'}
- Target Audience: ${idea.sections?.targetAudience || 'N/A'}
- Features: ${idea.sections?.features || 'N/A'}
- Business Model: ${idea.sections?.businessModel || 'N/A'}
- Competitors: ${idea.sections?.competitors || 'N/A'}
- Implementation Plan: ${idea.sections?.implementationPlan || 'N/A'}
- Risks: ${idea.sections?.risks || 'N/A'}
- Improvement Opportunities: ${idea.sections?.improvementOpportunities || 'N/A'}
`;

  const prompt = `You are a seasoned startup advisor and product architect.
Analyze the following idea objectively. Provide constructive critique, identify weak spots, ask probing questions on missing information, and propose actionable improvements.

IDEA DETAILS:
${ideaSummary}

Return ONLY valid JSON matching this schema:
{
  "critique": "A concise 2-sentence executive summary of the idea's potential and current maturity.",
  "weaknesses": [
    "Specific vulnerability or unvalidated assumption 1",
    "Specific vulnerability 2"
  ],
  "missingQuestions": [
    "Critical question 1 that the founder must answer",
    "Critical question 2"
  ],
  "suggestedImprovements": [
    "High-leverage improvement 1",
    "High-leverage improvement 2"
  ],
  "nextSteps": [
    "Actionable step 1 to execute this week",
    "Actionable step 2"
  ]
}`;

  try {
    const ai = getGenAIClient(customApiKey);
    const { response } = await generateWithFallback(ai, model || 'gemini-3.8-flash', {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = (response.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[AI Service] analyzeIdeaAndSuggestImprovements fallback:', err);
    return {
      critique: 'The idea has strong foundations but requires sharper user validation and clear differentiation.',
      weaknesses: [
        'Value proposition needs to be tested with real end-users.',
        'Distribution and user acquisition channel is currently unspecified.'
      ],
      missingQuestions: [
        'What is the single most urgent pain point that forces users to pay or switch?',
        'How will you acquire your first 50 engaged users at zero cost?'
      ],
      suggestedImprovements: [
        'Narrow down the MVP to the single core killer feature before expanding.',
        'Define a measurable metric for user success in week 1.'
      ],
      nextSteps: [
        'Conduct 5 discovery interviews with target users.',
        'Build a clickable prototype or landing page to gauge real interest.'
      ]
    };
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
  detectedIntent: { type: 'write' | 'improve' | 'summarize' | 'plan' | 'save' | 'idea' | 'general'; explanation: string };
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

  // 4. User sharing or discussing a business/product/project idea
  const isIdeaSharing = mode === 'idea' ||
    lower.includes('idea') || lower.includes('আইডিয়া') || lower.includes('startup') ||
    lower.includes('app banate') || lower.includes('product') || lower.includes('ব্যবসা') ||
    lower.includes('concept') || lower.includes('platform');

  if (isIdeaSharing) {
    const isBengali = /[\u0980-\u09FF]/.test(userMessage) || lower.includes('amar') || lower.includes('koro');
    const title = isBengali ? 'নতুন উদ্ভাবনী প্রজেক্ট আইডিয়া' : 'Innovative Project Idea';
    return {
      reply: isBengali
        ? 'আপনার আইডিয়াটি বিশ্লেষণ করে ৯টি প্রধান সেকশনে গুছিয়ে দিয়েছি। কোন বিষয়টি আরও স্পষ্ট করতে চান?'
        : 'I have structured your idea across the 9 core sections. Review the preview below.',
      detectedIntent: { type: 'idea', explanation: 'User discussed a project or business idea.' },
      actionProposal: {
        type: 'create_idea',
        targetName: title,
        data: {
          title,
          category: 'Tech & AI',
          tags: isBengali ? ['আইডিয়া', 'উদ্ভাবন'] : ['idea', 'concept'],
          sections: {
            overview: userMessage,
            problemAndSolution: isBengali ? 'সমস্যা ও সমাধানের রূপরেখা।' : 'Identifies a core pain point and offers an accessible, structured solution.',
            targetAudience: isBengali ? 'প্রাথমিক ব্যবহারকারী ও সুবিধাভোগী।' : 'Early adopters, thinkers, and domain practitioners.',
            features: isBengali ? 'মূল ফিচার ও কর্মপদ্ধতি।' : 'Core workflow automation, structured documentation, and real-time validation.',
            businessModel: isBengali ? 'ব্যবসায়িক রূপরেখা ও রাজস্ব মডেল।' : 'Value-driven freemium or direct subscription with premium capabilities.',
            competitors: isBengali ? 'বিদ্যমান প্রতিযোগী ও বিকল্প।' : 'Traditional manual workflows and generic tools.',
            implementationPlan: isBengali ? 'প্রথম ধাপ: MVP তৈরি ও ব্যবহারকারী যাচাই।' : 'Phase 1: Minimal viable prototype; Phase 2: User feedback; Phase 3: Launch.',
            risks: isBengali ? 'সম্ভাব্য ঝুঁকি ও গ্রহণ করার চ্যালেঞ্জ।' : 'Adoption friction and technical complexity.',
            improvementOpportunities: isBengali ? 'ভবিষ্যৎ উন্নয়ন ও সম্প্রসারণ।' : 'Integrate collaborative workflows and automated analytics.',
          },
        },
        status: 'pending',
      },
    };
  }

  // 5. Default clean conversational response
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
  detectedIntent: { type: 'write' | 'improve' | 'summarize' | 'plan' | 'save' | 'idea' | 'general'; explanation: string };
  actionProposal?: {
    type: 'create_diary' | 'update_diary' | 'update_plan' | 'add_chapter' | 'create_skill' | 'replace_content' | 'create_idea' | 'update_idea';
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
    if (rawType.includes('|') || !['create_diary', 'update_diary', 'update_plan', 'add_chapter', 'create_skill', 'create_idea', 'update_idea'].includes(rawType)) {
      if (rawType.includes('idea') || mode === 'idea' || parsed.detectedIntent?.type === 'idea') {
        rawType = 'create_idea';
      } else if (rawType.includes('diary') || rawType.includes('journal') || mode === 'diary' || parsed.detectedIntent?.type === 'write' || parsed.detectedIntent?.type === 'save') {
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

    if (actionProposal.type === 'create_idea' || actionProposal.type === 'update_idea') {
      const isBengali = /[\u0980-\u09FF]/.test(userMessage || reply);
      const fallbackTitle = isBengali ? 'নতুন উদ্ভাবনী প্রজেক্ট আইডিয়া' : 'New Project Idea';
      const title = (d.title || d.ideaTitle || actionProposal.targetName || fallbackTitle).trim();
      d.title = title;
      actionProposal.targetName = title;
      d.category = d.category || 'Tech & AI';
      d.tags = Array.isArray(d.tags) && d.tags.length > 0 ? d.tags : (isBengali ? ['আইডিয়া', 'উদ্ভাবন'] : ['idea', 'concept']);

      const sec = d.sections || {};
      d.sections = {
        overview: (sec.overview || d.overview || userMessage || '').trim(),
        problemAndSolution: (sec.problemAndSolution || d.problemAndSolution || '').trim(),
        targetAudience: (sec.targetAudience || d.targetAudience || '').trim(),
        features: (sec.features || d.features || '').trim(),
        businessModel: (sec.businessModel || d.businessModel || '').trim(),
        competitors: (sec.competitors || d.competitors || '').trim(),
        implementationPlan: (sec.implementationPlan || d.implementationPlan || '').trim(),
        risks: (sec.risks || d.risks || '').trim(),
        improvementOpportunities: (sec.improvementOpportunities || d.improvementOpportunities || '').trim(),
      };
      actionProposal.status = 'pending';
    } else if (actionProposal.type === 'create_diary' || actionProposal.type === 'update_diary') {
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
          enum: ['write', 'improve', 'summarize', 'plan', 'save', 'idea', 'general'],
          description: 'One of: write, improve, summarize, plan, save, idea, general',
        },
        explanation: { type: Type.STRING, description: 'Brief explanation of intent' },
      },
      required: ['type', 'explanation'],
    },
    actionProposal: {
      type: Type.OBJECT,
      description: 'Action proposal ONLY if saving, planning, structuring an idea, or logging. Otherwise null.',
      properties: {
        type: {
          type: Type.STRING,
          enum: ['create_diary', 'update_diary', 'update_plan', 'add_chapter', 'create_skill', 'create_idea', 'update_idea'],
          description: 'The action type to perform. Choose strictly one.',
        },
        targetId: { type: Type.STRING },
        targetName: { type: Type.STRING },
        data: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Title for diary or idea in Bengali or English.',
            },
            category: { type: Type.STRING, description: 'Category for idea or plan.' },
            content: {
              type: Type.STRING,
              description: 'Polished journal entry for create_diary.',
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
            sections: {
              type: Type.OBJECT,
              properties: {
                overview: { type: Type.STRING },
                problemAndSolution: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                features: { type: Type.STRING },
                businessModel: { type: Type.STRING },
                competitors: { type: Type.STRING },
                implementationPlan: { type: Type.STRING },
                risks: { type: Type.STRING },
                improvementOpportunities: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  },
  required: ['reply', 'detectedIntent'],
};

export async function chatWithContext(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  mode: 'default' | 'diary' | 'book' | 'plan' | 'idea';
  contextText?: string;
  attachments?: Array<{ type: string; id: string; title: string }>;
  customApiKey?: string;
  model?: string;
  clientDate?: string;
  clientTimezone?: string;
}): Promise<{
  reply: string;
  detectedIntent: { type: 'write' | 'improve' | 'summarize' | 'plan' | 'save' | 'idea' | 'general'; explanation: string };
  actionProposal?: {
    type: 'create_diary' | 'update_diary' | 'update_plan' | 'add_chapter' | 'create_skill' | 'replace_content' | 'create_idea' | 'update_idea';
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

IDEAS MODULE CONSTITUTION:
When the user discusses, pitches, or brainstorms a business, product, app, startup, or creative idea:
1. Detect intent as 'idea'.
2. Provide a 'create_idea' or 'update_idea' action proposal.
3. Organize the unstructured discussion into the 9 structured sections in actionProposal.data.sections:
   - overview, problemAndSolution, targetAudience, features, businessModel, competitors, implementationPlan, risks, improvementOpportunities.
4. In 'reply', keep it strictly 1-2 short sentences: ask a pointed question if vital info (e.g. monetization, target user) is missing, or suggest a high-impact improvement.

CURRENT MODE: ${mode.toUpperCase()}
Available Saved Context:
${contextText ? contextText : '(No attached resources)'}

Attachments: ${attachments && attachments.length > 0 ? attachments.map(a => `${a.type.toUpperCase()}: "${a.title}"`).join(', ') : 'None'}

ACTION PROPOSAL RULES (CRITICAL):
- 'actionProposal' must be NULL for:
  * Casual greetings (e.g. "Hi", "Hello", "Tmi kmn aso", "কেমন আছেন")
  * General knowledge questions
  * Banter where no thoughts or tasks need saving
- 'actionProposal' should ONLY be provided when the user shares thoughts, feelings, plans, ideas, or asks to log something:
  * type: "create_diary" (for new journal reflection)
  * type: "create_idea" (for new startup/product/project idea)
  * type: "update_idea" (for existing idea enhancements)
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

