export interface User {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  bio?: string;
  writingPreference?: string;
  theme?: string;
  aiProvider?: string;
  selectedModel?: string;
  hasCustomKey?: boolean;
  verificationCode?: string;
}

export interface DiaryEntry {
  id: string;
  _id?: string;
  userId: string;
  title: string;
  content: string;
  mood: 'calm' | 'inspired' | 'grateful' | 'melancholy' | 'energetic' | 'thoughtful' | string;
  weather: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'night' | 'windy' | string;
  tags: string[];
  location?: string;
  date: string;
  wordCount: number;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface Plan {
  id: string;
  _id?: string;
  userId: string;
  title: string;
  description: string;
  category: 'Work' | 'Personal' | 'Health' | 'Creative' | 'Learning' | string;
  priority: 'low' | 'medium' | 'high';
  deadline?: string;
  status: 'pending' | 'in_progress' | 'completed';
  tasks: TaskItem[];
  notes?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  _id?: string;
  userId: string;
  bookId: string;
  title: string;
  order: number;
  content: string;
  summary?: string;
  status: 'draft' | 'revised' | 'final';
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  _id?: string;
  userId: string;
  title: string;
  subtitle?: string;
  genre: string;
  description: string;
  coverStyle: string;
  status: 'draft' | 'in_progress' | 'completed';
  wordCount: number;
  chapterCount?: number;
  chapters?: Chapter[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillVersion {
  version: number;
  skillMd: string;
  promptTemplate: string;
  changeNote?: string;
  savedAt: string;
}

export interface SkillExecution {
  id: string;
  input: string;
  output: string;
  model: string;
  durationMs: number;
  status: 'success' | 'failed';
  executedAt: string;
}

export interface Skill {
  id: string;
  _id?: string;
  userId?: string;
  isSystem: boolean;
  name: string;
  category: 'Writing' | 'Refinement' | 'Planning' | 'Summarization' | 'Creative' | 'Analysis' | string;
  description: string;
  skillMd?: string;
  promptTemplate: string;
  variables: string[];
  tags: string[];
  icon: string;
  version?: number;
  versionHistory?: SkillVersion[];
  executionHistory?: SkillExecution[];
  createdAt: string;
  updatedAt: string;
}

export interface IdeaSections {
  overview: string;
  problemAndSolution: string;
  targetAudience: string;
  features: string;
  businessModel: string;
  competitors: string;
  implementationPlan: string;
  risks: string;
  improvementOpportunities: string;
}

export interface IdeaVersion {
  version: number;
  title: string;
  category: string;
  status: string;
  sections: IdeaSections;
  tags: string[];
  changeNote?: string;
  savedAt: string;
}

export interface Idea {
  id: string;
  _id?: string;
  userId: string;
  title: string;
  category: 'Tech & AI' | 'Business' | 'Productivity' | 'Creative' | 'Social' | 'Personal' | string;
  status: 'draft' | 'active' | 'validated' | 'archived' | 'implemented';
  tags: string[];
  sections: IdeaSections;
  chatId?: string;
  version: number;
  versionHistory?: IdeaVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  type: 'book' | 'chapter' | 'plan' | 'skill' | 'diary' | 'idea';
  id: string;
  title: string;
}

export interface ActionProposal {
  type: 'create_diary' | 'update_diary' | 'update_plan' | 'add_chapter' | 'create_skill' | 'replace_content' | 'create_idea' | 'update_idea';
  targetId?: string;
  targetName?: string;
  data: any;
  status: 'pending' | 'applied' | 'rejected';
}

export interface Message {
  id: string;
  _id?: string;
  userId: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  skillExecuted?: { skillId: string; skillName: string };
  detectedIntent?: { type: string; explanation: string };
  actionProposal?: ActionProposal;
  createdAt: string;
}

export interface Chat {
  id: string;
  _id?: string;
  userId: string;
  title: string;
  mode: 'default' | 'diary' | 'book' | 'plan' | 'idea';
  linkedResourceId?: string;
  linkedResourceType?: string;
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalEntries: number;
  totalPlans: number;
  totalBooks: number;
  totalChapters: number;
  totalIdeas?: number;
  totalWords: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}
