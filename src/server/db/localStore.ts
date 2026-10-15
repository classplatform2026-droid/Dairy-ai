import fs from 'fs';
import path from 'path';

export interface DatabaseState {
  users: any[];
  diaries: any[];
  plans: any[];
  books: any[];
  chapters: any[];
  skills: any[];
  chats: any[];
  messages: any[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'lifenote_db.json');

const INITIAL_SKILLS = [
  {
    id: 'sys-skill-prose-polish',
    isSystem: true,
    name: 'Prose Polisher',
    category: 'Writing',
    description: 'Elevate vocabulary, cadence, and elegance without losing your original voice.',
    promptTemplate: 'Please polish the following personal writing. Retain the core emotion and thoughts, but enhance the sentence flow, cadence, and vocabulary for literary quality:\n\n"{text}"',
    variables: ['text'],
    tags: ['writing', 'polish', 'elegance'],
    icon: 'Feather',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sys-skill-grammar-style',
    isSystem: true,
    name: 'Grammar & Clarity Fixer',
    category: 'Refinement',
    description: 'Correct typos, punctuation, syntactic friction, and awkward sentence structures.',
    promptTemplate: 'Fix all grammatical mistakes, spelling errors, and punctuation flaws in the following text. Keep the tone natural and clear without changing the underlying meaning:\n\n"{text}"',
    variables: ['text'],
    tags: ['grammar', 'clarity', 'proofing'],
    icon: 'CheckCircle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sys-skill-weekly-retro',
    isSystem: true,
    name: 'Retrospective Extractor',
    category: 'Summarization',
    description: 'Extract key themes, emotional highlights, wins, and reflections from your journal entries.',
    promptTemplate: 'Analyze the following journal entry or notes. Extract: 1) Core Themes, 2) Key Emotional Highlights, 3) Notable Accomplishments/Wins, and 4) Actionable Insights for Tomorrow:\n\n"{text}"',
    variables: ['text'],
    tags: ['reflection', 'journal', 'insights'],
    icon: 'Compass',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sys-skill-action-harvest',
    isSystem: true,
    name: 'Action Item Harvester',
    category: 'Planning',
    description: 'Find implicit tasks, commitments, and deadlines buried in your reflections.',
    promptTemplate: 'Read through the text below and extract any concrete action items, pending tasks, or commitments. Format them as a concise checklist with suggested priorities (High/Medium/Low):\n\n"{text}"',
    variables: ['text'],
    tags: ['tasks', 'planning', 'action'],
    icon: 'ListChecks',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sys-skill-chapter-outline',
    isSystem: true,
    name: 'Chapter Outliner',
    category: 'Creative',
    description: 'Transform raw journal entries or story concepts into a structured book chapter.',
    promptTemplate: 'Transform the following notes or thoughts into a structured book chapter. Provide: 1) Chapter Title, 2) Narrative Arc Hook, 3) 3-4 Key Beats/Scenes, and 4) Closing Reflection:\n\n"{text}"',
    variables: ['text'],
    tags: ['book', 'chapters', 'storytelling'],
    icon: 'BookOpen',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sys-skill-poetic',
    isSystem: true,
    name: 'Poetic Metaphorist',
    category: 'Creative',
    description: 'Reimagine thoughts through subtle metaphors, evocative imagery, and lyrical prose.',
    promptTemplate: 'Re-envision the following passage with poetic resonance. Use natural, contemplative imagery and subtle metaphors while keeping the emotional heart sincere:\n\n"{text}"',
    variables: ['text'],
    tags: ['poetry', 'creative', 'lyrical'],
    icon: 'Sparkles',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

class LocalStore {
  private state: DatabaseState = {
    users: [],
    diaries: [],
    plans: [],
    books: [],
    chapters: [],
    skills: [...INITIAL_SKILLS],
    chats: [],
    messages: []
  };
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.state = {
          users: parsed.users || [],
          diaries: parsed.diaries || [],
          plans: parsed.plans || [],
          books: parsed.books || [],
          chapters: parsed.chapters || [],
          skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : [...INITIAL_SKILLS],
          chats: parsed.chats || [],
          messages: parsed.messages || [],
        };
        // Ensure default system skills exist
        for (const sys of INITIAL_SKILLS) {
          if (!this.state.skills.some(s => s.id === sys.id)) {
            this.state.skills.unshift(sys);
          }
        }
      } else {
        this.persist();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[LocalStore] Error loading database file:', err);
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[LocalStore] Error saving database file:', err);
    }
  }

  public generateId(): string {
    return 'id_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }

  // --- Users ---
  public async findUserByEmail(email: string) {
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public async findUserById(id: string) {
    return this.state.users.find(u => u.id === id || u._id === id) || null;
  }

  public async createUser(data: any) {
    const user = {
      id: this.generateId(),
      ...data,
      isEmailVerified: data.isEmailVerified ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.users.push(user);
    this.persist();
    return user;
  }

  public async updateUser(id: string, updates: any) {
    const idx = this.state.users.findIndex(u => u.id === id || u._id === id);
    if (idx === -1) return null;
    this.state.users[idx] = {
      ...this.state.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.state.users[idx];
  }

  // --- Diaries ---
  public async getDiaries(userId: string, search?: string, tag?: string, mood?: string) {
    let items = this.state.diaries.filter(d => d.userId === userId);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(d => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q));
    }
    if (tag) {
      items = items.filter(d => Array.isArray(d.tags) && d.tags.includes(tag));
    }
    if (mood) {
      items = items.filter(d => d.mood === mood);
    }
    return items.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }

  public async getDiaryById(userId: string, id: string) {
    return this.state.diaries.find(d => (d.id === id || d._id === id) && d.userId === userId) || null;
  }

  public async getDiaryByDate(userId: string, date: string) {
    const targetDate = String(date).split('T')[0].trim();
    return this.state.diaries.find(d => d.userId === userId && String(d.date).split('T')[0].trim() === targetDate) || null;
  }

  public async createDiary(userId: string, data: any) {
    const targetDate = data.date ? String(data.date).split('T')[0].trim() : new Date().toISOString().split('T')[0];
    
    // Check if an entry for this date already exists for this user
    const existing = this.state.diaries.find(d => d.userId === userId && String(d.date).split('T')[0].trim() === targetDate);
    if (existing) {
      return this.updateDiary(userId, existing.id || existing._id, {
        ...data,
        date: targetDate,
      });
    }

    const words = (data.content || '').trim().split(/\s+/).filter(Boolean).length;
    const entry = {
      id: this.generateId(),
      userId,
      title: data.title || `Journal: ${targetDate}`,
      content: data.content || '',
      mood: data.mood || 'thoughtful',
      weather: data.weather || 'sunny',
      tags: data.tags || [],
      location: data.location || '',
      date: targetDate,
      wordCount: words,
      favorite: !!data.favorite,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.diaries.push(entry);
    this.persist();
    return entry;
  }

  public async updateDiary(userId: string, id: string, updates: any) {
    const idx = this.state.diaries.findIndex(d => (d.id === id || d._id === id) && d.userId === userId);
    if (idx === -1) return null;
    const content = updates.content !== undefined ? updates.content : this.state.diaries[idx].content;
    const wordCount = (content || '').trim().split(/\s+/).filter(Boolean).length;
    this.state.diaries[idx] = {
      ...this.state.diaries[idx],
      ...updates,
      wordCount,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.state.diaries[idx];
  }

  public async deleteDiary(userId: string, id: string) {
    const idx = this.state.diaries.findIndex(d => (d.id === id || d._id === id) && d.userId === userId);
    if (idx === -1) return false;
    this.state.diaries.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Plans ---
  public async getPlans(userId: string, status?: string) {
    let items = this.state.plans.filter(p => p.userId === userId);
    if (status && status !== 'all') {
      items = items.filter(p => p.status === status);
    }
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getPlanById(userId: string, id: string) {
    return this.state.plans.find(p => (p.id === id || p._id === id) && p.userId === userId) || null;
  }

  public async createPlan(userId: string, data: any) {
    const tasks = (data.tasks || []).map((t: any, i: number) => ({
      id: t.id || this.generateId(),
      title: t.title,
      completed: !!t.completed,
      order: t.order ?? i,
    }));
    const completedTasks = tasks.filter((t: any) => t.completed).length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const plan = {
      id: this.generateId(),
      userId,
      title: data.title || 'Untitled Plan',
      description: data.description || '',
      category: data.category || 'Personal',
      priority: data.priority || 'medium',
      deadline: data.deadline || '',
      status: data.status || (progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending'),
      tasks,
      notes: data.notes || '',
      progress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.plans.push(plan);
    this.persist();
    return plan;
  }

  public async updatePlan(userId: string, id: string, updates: any) {
    const idx = this.state.plans.findIndex(p => (p.id === id || p._id === id) && p.userId === userId);
    if (idx === -1) return null;
    const existing = this.state.plans[idx];
    const tasks = updates.tasks !== undefined ? updates.tasks : existing.tasks;
    const completedTasks = (tasks || []).filter((t: any) => t.completed).length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    let status = updates.status !== undefined ? updates.status : existing.status;
    if (progress === 100 && status !== 'completed') status = 'completed';
    else if (progress < 100 && status === 'completed') status = 'in_progress';

    this.state.plans[idx] = {
      ...existing,
      ...updates,
      tasks,
      progress,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.state.plans[idx];
  }

  public async deletePlan(userId: string, id: string) {
    const idx = this.state.plans.findIndex(p => (p.id === id || p._id === id) && p.userId === userId);
    if (idx === -1) return false;
    this.state.plans.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Books & Chapters ---
  public async getBooks(userId: string) {
    const books = this.state.books.filter(b => b.userId === userId);
    return books.map(book => {
      const bookChapters = this.state.chapters.filter(c => c.bookId === (book.id || book._id));
      const wordCount = bookChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
      return {
        ...book,
        chapterCount: bookChapters.length,
        wordCount,
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getBookById(userId: string, id: string) {
    const book = this.state.books.find(b => (b.id === id || b._id === id) && b.userId === userId);
    if (!book) return null;
    const chapters = this.state.chapters
      .filter(c => c.bookId === (book.id || book._id))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const wordCount = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
    return {
      ...book,
      chapters,
      chapterCount: chapters.length,
      wordCount,
    };
  }

  public async createBook(userId: string, data: any) {
    const book = {
      id: this.generateId(),
      userId,
      title: data.title || 'Untitled Book',
      subtitle: data.subtitle || '',
      genre: data.genre || 'Memoir',
      description: data.description || '',
      coverStyle: data.coverStyle || 'classic-dark',
      status: data.status || 'draft',
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.books.push(book);
    this.persist();
    return book;
  }

  public async updateBook(userId: string, id: string, updates: any) {
    const idx = this.state.books.findIndex(b => (b.id === id || b._id === id) && b.userId === userId);
    if (idx === -1) return null;
    this.state.books[idx] = {
      ...this.state.books[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.state.books[idx];
  }

  public async deleteBook(userId: string, id: string) {
    const idx = this.state.books.findIndex(b => (b.id === id || b._id === id) && b.userId === userId);
    if (idx === -1) return false;
    const targetId = this.state.books[idx].id || this.state.books[idx]._id;
    this.state.books.splice(idx, 1);
    // Also delete linked chapters
    this.state.chapters = this.state.chapters.filter(c => c.bookId !== targetId);
    this.persist();
    return true;
  }

  // --- Chapters ---
  public async getChapters(userId: string, bookId: string) {
    return this.state.chapters
      .filter(c => c.bookId === bookId && c.userId === userId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  public async getChapterById(userId: string, chapterId: string) {
    return this.state.chapters.find(c => (c.id === chapterId || c._id === chapterId) && c.userId === userId) || null;
  }

  public async createChapter(userId: string, bookId: string, data: any) {
    const existing = this.state.chapters.filter(c => c.bookId === bookId);
    const words = (data.content || '').trim().split(/\s+/).filter(Boolean).length;
    const chapter = {
      id: this.generateId(),
      userId,
      bookId,
      title: data.title || `Chapter ${existing.length + 1}`,
      order: data.order ?? existing.length + 1,
      content: data.content || '',
      summary: data.summary || '',
      status: data.status || 'draft',
      wordCount: words,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.chapters.push(chapter);
    this.persist();
    return chapter;
  }

  public async updateChapter(userId: string, chapterId: string, updates: any) {
    const idx = this.state.chapters.findIndex(c => (c.id === chapterId || c._id === chapterId) && c.userId === userId);
    if (idx === -1) return null;
    const content = updates.content !== undefined ? updates.content : this.state.chapters[idx].content;
    const wordCount = (content || '').trim().split(/\s+/).filter(Boolean).length;
    this.state.chapters[idx] = {
      ...this.state.chapters[idx],
      ...updates,
      wordCount,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.state.chapters[idx];
  }

  public async deleteChapter(userId: string, chapterId: string) {
    const idx = this.state.chapters.findIndex(c => (c.id === chapterId || c._id === chapterId) && c.userId === userId);
    if (idx === -1) return false;
    this.state.chapters.splice(idx, 1);
    this.persist();
    return true;
  }

  public async reorderChapters(userId: string, bookId: string, orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const ch = this.state.chapters.find(c => (c.id === id || c._id === id) && c.userId === userId && c.bookId === bookId);
      if (ch) {
        ch.order = index + 1;
        ch.updatedAt = new Date().toISOString();
      }
    });
    this.persist();
    return this.getChapters(userId, bookId);
  }

  // --- Skills ---
  public async getSkills(userId?: string) {
    const list = this.state.skills.filter(s => s.isSystem || (userId && s.userId === userId));
    return list.map(s => {
      if (!s.skillMd) {
        s.skillMd = this.generateDefaultSkillMd(s);
      }
      if (!s.version) {
        s.version = 1;
      }
      return s;
    });
  }

  public async getSkillById(id: string, userId?: string) {
    const s = this.state.skills.find(item => (item.id === id || item._id === id) && (item.isSystem || item.userId === userId));
    if (!s) return null;
    if (!s.skillMd) {
      s.skillMd = this.generateDefaultSkillMd(s);
    }
    if (!s.version) {
      s.version = 1;
    }
    return s;
  }

  private generateDefaultSkillMd(s: any): string {
    const vars = Array.isArray(s.variables) && s.variables.length > 0 ? s.variables : ['text'];
    const tags = Array.isArray(s.tags) && s.tags.length > 0 ? s.tags : [s.category ? s.category.toLowerCase() : 'custom'];
    return `---
name: "${(s.name || 'Custom Skill').replace(/"/g, '\\"')}"
description: "${(s.description || '').replace(/"/g, '\\"')}"
category: "${s.category || 'Writing'}"
version: "1.0.0"
inputs:
${vars.map((v: string) => `  - ${v}`).join('\n')}
tags:
${tags.map((t: string) => `  - ${t}`).join('\n')}
icon: "${s.icon || 'Sparkles'}"
---

# ${s.name || 'Custom Skill'}

## Purpose
${s.description || 'Custom cognitive skill for LifeNote AI.'}

## Use Cases
- Personal journaling and reflective writing
- Structured text enhancement and clarity refinement

## Required Inputs
${vars.map((v: string) => `- \`${v}\`: Input text to be transformed according to instructions.`).join('\n')}

## Step-by-Step Workflow
1. Analyze the core message, tone, and intended impact of the input text.
2. Apply the specialized cognitive prompt template:
\`\`\`
${s.promptTemplate || 'Transform the text.'}
\`\`\`
3. Refine for stylistic harmony and verify all constraints.
4. Output the result cleanly.

## Constraints & Rules
- Preserve the authentic thoughts, facts, and voice of the author.
- If the original text is in Bengali or Banglish, produce polished, natural Bengali.
- Output ONLY the refined result without unnecessary conversational preamble.

## Examples
### Example 1
**Input:**
\`\`\`
Sample text provided for processing.
\`\`\`

**Output:**
\`\`\`
Refined transformation matching ${s.name}.
\`\`\`

## Edge Cases
- When input is brief, deepen the insight thoughtfully while retaining accuracy.
`;
  }

  public async createSkill(userId: string, data: any) {
    const now = new Date().toISOString();
    const vars = data.variables && data.variables.length > 0 ? data.variables : ['text'];
    const skillMd = data.skillMd || this.generateDefaultSkillMd({
      name: data.name,
      description: data.description,
      category: data.category,
      promptTemplate: data.promptTemplate,
      variables: vars,
      tags: data.tags,
      icon: data.icon,
    });

    const skill = {
      id: this.generateId(),
      userId,
      isSystem: false,
      name: data.name,
      category: data.category || 'Writing',
      description: data.description,
      skillMd,
      promptTemplate: data.promptTemplate,
      variables: vars,
      tags: data.tags || [],
      icon: data.icon || 'Sparkles',
      version: 1,
      versionHistory: [
        {
          version: 1,
          skillMd,
          promptTemplate: data.promptTemplate,
          changeNote: 'Initial skill creation',
          savedAt: now,
        }
      ],
      executionHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.state.skills.push(skill);
    this.persist();
    return skill;
  }

  public async updateSkill(userId: string, id: string, updates: any) {
    const idx = this.state.skills.findIndex(s => (s.id === id || s._id === id) && s.userId === userId && !s.isSystem);
    if (idx === -1) return null;
    const existing = this.state.skills[idx];
    const now = new Date().toISOString();

    const isMajorChange = updates.skillMd !== undefined && updates.skillMd !== existing.skillMd;
    const newVersion = isMajorChange ? (existing.version || 1) + 1 : (existing.version || 1);

    const versionHistory = [...(existing.versionHistory || [])];
    if (isMajorChange) {
      versionHistory.unshift({
        version: newVersion,
        skillMd: updates.skillMd,
        promptTemplate: updates.promptTemplate || existing.promptTemplate,
        changeNote: updates.changeNote || `Updated to version ${newVersion}`,
        savedAt: now,
      });
    }

    this.state.skills[idx] = {
      ...existing,
      ...updates,
      version: newVersion,
      versionHistory,
      updatedAt: now,
    };
    this.persist();
    return this.state.skills[idx];
  }

  public async recordSkillExecution(userId: string, id: string, execution: {
    input: string;
    output: string;
    model: string;
    durationMs: number;
    status: string;
  }) {
    const idx = this.state.skills.findIndex(s => (s.id === id || s._id === id) && (s.isSystem || s.userId === userId));
    if (idx === -1) return null;

    const entry = {
      id: 'exec_' + Math.random().toString(36).substr(2, 9),
      ...execution,
      executedAt: new Date().toISOString(),
    };

    const currentHistory = this.state.skills[idx].executionHistory || [];
    // Keep last 30 execution logs
    this.state.skills[idx].executionHistory = [entry, ...currentHistory].slice(0, 30);
    this.persist();
    return entry;
  }

  public async restoreSkillVersion(userId: string, id: string, versionNumber: number) {
    const idx = this.state.skills.findIndex(s => (s.id === id || s._id === id) && s.userId === userId && !s.isSystem);
    if (idx === -1) return null;
    const skill = this.state.skills[idx];
    const targetSnapshot = (skill.versionHistory || []).find((v: any) => v.version === versionNumber);
    if (!targetSnapshot) return null;

    const now = new Date().toISOString();
    const restoredVersion = (skill.version || 1) + 1;

    skill.versionHistory.unshift({
      version: restoredVersion,
      skillMd: targetSnapshot.skillMd,
      promptTemplate: targetSnapshot.promptTemplate,
      changeNote: `Restored from version ${versionNumber}`,
      savedAt: now,
    });

    skill.skillMd = targetSnapshot.skillMd;
    skill.promptTemplate = targetSnapshot.promptTemplate;
    skill.version = restoredVersion;
    skill.updatedAt = now;

    this.persist();
    return skill;
  }

  public async deleteSkill(userId: string, id: string) {
    const idx = this.state.skills.findIndex(s => (s.id === id || s._id === id) && s.userId === userId && !s.isSystem);
    if (idx === -1) return false;
    this.state.skills.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Chats & Messages ---
  public async getChats(userId: string) {
    return this.state.chats
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getChatById(userId: string, id: string) {
    const chat = this.state.chats.find(c => (c.id === id || c._id === id) && c.userId === userId);
    if (!chat) return null;
    const messages = this.state.messages
      .filter(m => m.chatId === (chat.id || chat._id) && m.userId === userId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return {
      ...chat,
      messages,
    };
  }

  public async createChat(userId: string, data: any) {
    const chat = {
      id: this.generateId(),
      userId,
      title: data.title || 'New Conversation',
      mode: data.mode || 'default',
      linkedResourceId: data.linkedResourceId,
      linkedResourceType: data.linkedResourceType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.chats.unshift(chat);
    this.persist();
    return chat;
  }

  public async updateChat(userId: string, id: string, updates: any) {
    const idx = this.state.chats.findIndex(c => (c.id === id || c._id === id) && c.userId === userId);
    if (idx === -1) return null;
    this.state.chats[idx] = {
      ...this.state.chats[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.state.chats[idx];
  }

  public async deleteChat(userId: string, id: string) {
    const idx = this.state.chats.findIndex(c => (c.id === id || c._id === id) && c.userId === userId);
    if (idx === -1) return false;
    const chatId = this.state.chats[idx].id || this.state.chats[idx]._id;
    this.state.chats.splice(idx, 1);
    // Delete only messages of this chat. CRITICAL: Never delete linked resources (books, diaries, plans)
    this.state.messages = this.state.messages.filter(m => m.chatId !== chatId);
    this.persist();
    return true;
  }

  public async createMessage(userId: string, chatId: string, data: any) {
    const message = {
      id: this.generateId(),
      userId,
      chatId,
      role: data.role || 'user',
      content: data.content,
      attachments: data.attachments || [],
      skillExecuted: data.skillExecuted,
      detectedIntent: data.detectedIntent,
      actionProposal: data.actionProposal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.messages.push(message);

    // Touch chat updatedAt
    const chat = this.state.chats.find(c => (c.id === chatId || c._id === chatId) && c.userId === userId);
    if (chat) {
      chat.updatedAt = new Date().toISOString();
      if (chat.title === 'New Conversation' && data.role === 'user') {
        chat.title = data.content.slice(0, 36) + (data.content.length > 36 ? '...' : '');
      }
    }

    this.persist();
    return message;
  }

  public async updateMessageProposal(userId: string, messageId: string, status: 'applied' | 'rejected') {
    const msg = this.state.messages.find(m => (m.id === messageId || m._id === messageId) && m.userId === userId);
    if (!msg || !msg.actionProposal) return null;
    msg.actionProposal.status = status;
    msg.updatedAt = new Date().toISOString();
    this.persist();
    return msg;
  }

  // --- Full User Data Export & Permanent Deletion ---
  public async exportUserData(userId: string) {
    const user = await this.findUserById(userId);
    const diaries = this.state.diaries.filter(d => d.userId === userId);
    const plans = this.state.plans.filter(p => p.userId === userId);
    const books = this.state.books.filter(b => b.userId === userId);
    const chapters = this.state.chapters.filter(c => c.userId === userId);
    const skills = this.state.skills.filter(s => s.userId === userId && !s.isSystem);
    const chats = this.state.chats.filter(c => c.userId === userId);
    const messages = this.state.messages.filter(m => m.userId === userId);

    return {
      exportedAt: new Date().toISOString(),
      user: {
        name: user?.name,
        email: user?.email,
        bio: user?.bio,
        writingPreference: user?.writingPreference,
        theme: user?.theme,
        createdAt: user?.createdAt,
      },
      diaries,
      plans,
      books,
      chapters,
      skills,
      chats,
      messages,
    };
  }

  public async deleteUserDataPermanently(userId: string) {
    this.state.users = this.state.users.filter(u => u.id !== userId && u._id !== userId);
    this.state.diaries = this.state.diaries.filter(d => d.userId !== userId);
    this.state.plans = this.state.plans.filter(p => p.userId !== userId);
    this.state.books = this.state.books.filter(b => b.userId !== userId);
    this.state.chapters = this.state.chapters.filter(c => c.userId !== userId);
    this.state.skills = this.state.skills.filter(s => s.userId !== userId);
    this.state.chats = this.state.chats.filter(c => c.userId !== userId);
    this.state.messages = this.state.messages.filter(m => m.userId !== userId);
    this.persist();
    return true;
  }

  // --- Global Stats for Dashboard ---
  public async getDashboardStats(userId: string) {
    const diaries = this.state.diaries.filter(d => d.userId === userId);
    const plans = this.state.plans.filter(p => p.userId === userId);
    const books = this.state.books.filter(b => b.userId === userId);
    const chapters = this.state.chapters.filter(c => c.userId === userId);

    const totalDiaryWords = diaries.reduce((acc, d) => acc + (d.wordCount || 0), 0);
    const totalBookWords = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);

    const allTasks = plans.flatMap(p => p.tasks || []);
    const completedTasks = allTasks.filter(t => t.completed).length;

    return {
      totalEntries: diaries.length,
      totalPlans: plans.length,
      totalBooks: books.length,
      totalChapters: chapters.length,
      totalWords: totalDiaryWords + totalBookWords,
      totalTasks: allTasks.length,
      completedTasks,
      completionRate: allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0,
    };
  }
}

export const localStore = new LocalStore();
