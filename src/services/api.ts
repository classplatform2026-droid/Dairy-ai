import { Idea, IdeaSections } from '../types/index.js';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('lifenote_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('lifenote_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('lifenote_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    signup: (data: { name: string; email: string; password: string }) =>
      request<{ token: string; user: any }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () =>
      request<{ user: any }>('/auth/me'),
    verifyEmail: (code: string) =>
      request<{ success: boolean; message: string; user: any }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ code }) }),
    requestPasswordReset: (email: string) =>
      request<{ success: boolean; message: string; resetCode?: string }>('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (data: { email: string; code: string; newPassword: string }) =>
      request<{ success: boolean; message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    updateProfile: (data: any) =>
      request<{ success: boolean; user: any }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    updateSecurity: (data: { currentPassword: string; newPassword: string }) =>
      request<{ success: boolean; message: string }>('/auth/security', { method: 'PUT', body: JSON.stringify(data) }),
    updateAIConfig: (data: { aiProvider?: string; selectedModel?: string; customApiKey?: string }) =>
      request<{ success: boolean; message: string; aiConfig: any }>('/auth/ai-config', { method: 'PUT', body: JSON.stringify(data) }),
    testAI: (model?: string) =>
      request<{ success: boolean; message: string; model: string }>('/auth/test-ai', { method: 'POST', body: JSON.stringify({ model }) }),
    exportData: () =>
      request<any>('/auth/export-data', { method: 'POST' }),
    deleteAccount: () =>
      request<{ success: boolean; message: string }>('/auth/account', { method: 'DELETE' }),
  },

  // Dashboard
  dashboard: {
    get: () =>
      request<{ stats: any; recentDiaries: any[]; activePlans: any[]; books: any[]; recentChats: any[] }>('/dashboard'),
  },

  // Diaries
  diaries: {
    list: (params?: { search?: string; tag?: string; mood?: string }) => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.tag) query.append('tag', params.tag);
      if (params?.mood) query.append('mood', params.mood);
      const qs = query.toString();
      return request<{ entries: any[] }>(`/diaries${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) =>
      request<{ entry: any }>(`/diaries/${id}`),
    getByDate: (date: string) =>
      request<{ entry: any }>(`/diaries/by-date/${date}`),
    create: (data: any) =>
      request<{ entry: any }>('/diaries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ entry: any }>(`/diaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/diaries/${id}`, { method: 'DELETE' }),
    aiRefine: (id: string, data: { action: string; tone?: string; customText?: string }) =>
      request<{ original: string; refined: string; action: string }>(`/diaries/${id}/ai-refine`, { method: 'POST', body: JSON.stringify(data) }),
    aiUpdatePage: (data: { date: string; currentContent: string; userMessage: string }) =>
      request<{ date: string; updatedContent: string; explanation: string; entry?: any }>('/diaries/ai-update-page', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    synthesizePage: (data: { content: string; title?: string; date?: string; id?: string; autoSave?: boolean }) =>
      request<{ unifiedContent: string; title: string; mood: string; savedEntry?: any }>('/diaries/synthesize-page', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Plans
  plans: {
    list: (status?: string) =>
      request<{ plans: any[] }>(`/plans${status ? `?status=${status}` : ''}`),
    get: (id: string) =>
      request<{ plan: any }>(`/plans/${id}`),
    create: (data: any) =>
      request<{ plan: any }>('/plans', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ plan: any }>(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/plans/${id}`, { method: 'DELETE' }),
    aiBreakdown: (goal: string, category?: string) =>
      request<{ breakdown: any }>('/plans/ai-breakdown', { method: 'POST', body: JSON.stringify({ goal, category }) }),
  },

  // Books & Chapters
  books: {
    list: () =>
      request<{ books: any[] }>('/books'),
    get: (id: string) =>
      request<{ book: any }>(`/books/${id}`),
    create: (data: any) =>
      request<{ book: any }>('/books', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ book: any }>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/books/${id}`, { method: 'DELETE' }),
    createChapter: (bookId: string, data: any) =>
      request<{ chapter: any }>(`/books/${bookId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
    updateChapter: (bookId: string, chapterId: string, data: any) =>
      request<{ chapter: any }>(`/books/${bookId}/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteChapter: (bookId: string, chapterId: string) =>
      request<{ success: boolean }>(`/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' }),
    reorderChapters: (bookId: string, orderedIds: string[]) =>
      request<{ chapters: any[] }>(`/books/${bookId}/chapters/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
  },

  // Skills
  skills: {
    list: () =>
      request<{ skills: any[] }>('/skills'),
    get: (id: string) =>
      request<{ skill: any }>(`/skills/${id}`),
    create: (data: any) =>
      request<{ skill: any }>('/skills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ skill: any }>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/skills/${id}`, { method: 'DELETE' }),
    execute: (id: string, text: string) =>
      request<{ skillId: string; skillName: string; output: string; durationMs?: number; model?: string }>(`/skills/${id}/execute`, { method: 'POST', body: JSON.stringify({ text }) }),
    generateSpec: (data: { prompt: string; conversationHistory?: any[]; currentDraft?: any }) =>
      request<{
        name: string;
        description: string;
        category: string;
        promptTemplate: string;
        variables: string[];
        tags: string[];
        icon: string;
        skillMd: string;
        assistantReply: string;
      }>('/skills/generate-spec', { method: 'POST', body: JSON.stringify(data) }),
    refineSpec: (data: { skillMd: string; feedback: string; testOutput?: string }) =>
      request<{
        skillMd: string;
        promptTemplate: string;
        description: string;
        explanation: string;
      }>('/skills/refine-spec', { method: 'POST', body: JSON.stringify(data) }),
    testDraft: (data: { promptTemplate?: string; skillMd?: string; input: string; variables?: Record<string, string> }) =>
      request<{ output: string; durationMs: number; model: string }>('/skills/test-draft', { method: 'POST', body: JSON.stringify(data) }),
    test: (id: string, data: { input: string; variables?: Record<string, string> }) =>
      request<{ output: string; durationMs: number; model: string; logEntry?: any }>(`/skills/${id}/test`, { method: 'POST', body: JSON.stringify(data) }),
    restoreVersion: (id: string, versionNumber: number) =>
      request<{ success: boolean; skill: any }>(`/skills/${id}/restore-version/${versionNumber}`, { method: 'POST' }),
    parseMarkdown: (markdown: string) =>
      request<{
        name: string;
        description: string;
        category: string;
        icon: string;
        tags: string[];
        variables: string[];
        promptTemplate: string;
        skillMd: string;
      }>('/skills/parse-markdown', { method: 'POST', body: JSON.stringify({ markdown }) }),
  },

  // Ideas
  ideas: {
    list: (params?: { status?: string; category?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append('status', params.status);
      if (params?.category) q.append('category', params.category);
      if (params?.search) q.append('search', params.search);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ ideas: Idea[] }>(`/ideas${queryStr}`);
    },
    get: (id: string) =>
      request<{ idea: Idea }>(`/ideas/${id}`),
    create: (data: Partial<Idea>) =>
      request<{ idea: Idea }>('/ideas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Idea> & { changeNote?: string }) =>
      request<{ idea: Idea }>(`/ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: string) =>
      request<{ idea: Idea }>(`/ideas/${id}/archive`, { method: 'PATCH' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/ideas/${id}`, { method: 'DELETE' }),
    structureFromText: (data: { content: string; category?: string }) =>
      request<{
        structured: {
          title: string;
          category: string;
          tags: string[];
          sections: IdeaSections;
          missingQuestions: string[];
          weaknesses: string[];
          suggestedImprovements: string[];
        };
      }>('/ideas/structure-from-text', { method: 'POST', body: JSON.stringify(data) }),
    analyze: (idea: Partial<Idea>) =>
      request<{
        analysis: {
          critique: string;
          weaknesses: string[];
          missingQuestions: string[];
          suggestedImprovements: string[];
          nextSteps: string[];
        };
      }>('/ideas/analyze', { method: 'POST', body: JSON.stringify({ idea }) }),
  },

  // Chats
  chats: {
    list: () =>
      request<{ chats: any[] }>('/chats'),
    get: (id: string) =>
      request<{ chat: any }>(`/chats/${id}`),
    create: (data: { title?: string; mode?: string; linkedResourceId?: string; linkedResourceType?: string }) =>
      request<{ chat: any }>('/chats', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ chat: any }>(`/chats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/chats/${id}`, { method: 'DELETE' }),
    sendMessage: (id: string, data: { content: string; attachments?: any[]; skillId?: string; clientDate?: string; timezone?: string }) =>
      request<{ userMessage: any; assistantMessage: any }>(`/chats/${id}/messages`, { method: 'POST', body: JSON.stringify(data) }),
    applyAction: (chatId: string, messageId: string, actionData?: any, clientDate?: string) =>
      request<{ success: boolean; message: string; createdResource: any }>(`/chats/${chatId}/messages/${messageId}/apply-action`, { method: 'POST', body: JSON.stringify({ actionData, clientDate }) }),
  },

  // AI Direct
  ai: {
    transformText: (text: string, action: string, tone?: string, customPrompt?: string) =>
      request<{ output: string; original: string; action: string }>('/ai/transform-text', { method: 'POST', body: JSON.stringify({ text, action, tone, customPrompt }) }),
    generatePlan: (goal: string, category?: string) =>
      request<{ plan: any }>('/ai/generate-plan', { method: 'POST', body: JSON.stringify({ goal, category }) }),
    executeSkill: (promptTemplate: string, text: string) =>
      request<{ output: string }>('/ai/execute-skill', { method: 'POST', body: JSON.stringify({ promptTemplate, text }) }),
    getModels: () =>
      request<{ models: any[] }>('/ai/models'),
  },

  // Health
  health: () =>
    request<{ status: string; database: any; ai: any }>('/health'),
};
