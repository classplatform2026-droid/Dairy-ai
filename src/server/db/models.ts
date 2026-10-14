import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  verificationCode?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  bio?: string;
  writingPreference?: string;
  theme?: string;
  aiProvider?: string;
  customApiKeyEncrypted?: string;
  selectedModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  bio: { type: String, default: '' },
  writingPreference: { type: String, default: 'reflective' },
  theme: { type: String, default: 'minimal-light' },
  aiProvider: { type: String, default: 'gemini' },
  customApiKeyEncrypted: { type: String, default: '' },
  selectedModel: { type: String, default: 'gemini-3.8-flash' },
}, { timestamps: true });

export interface IDiaryEntry extends Document {
  userId: string;
  title: string;
  content: string;
  mood: string;
  weather: string;
  tags: string[];
  location?: string;
  date: string;
  wordCount: number;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DiaryEntrySchema = new Schema<IDiaryEntry>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  mood: { type: String, default: 'thoughtful' },
  weather: { type: String, default: 'sunny' },
  tags: { type: [String], default: [] },
  location: { type: String, default: '' },
  date: { type: String, required: true, index: true },
  wordCount: { type: Number, default: 0 },
  favorite: { type: Boolean, default: false },
}, { timestamps: true });

DiaryEntrySchema.index({ userId: 1, date: -1 });

export interface ITaskItem {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface IPlan extends Document {
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  deadline?: string;
  status: string;
  tasks: ITaskItem[];
  notes?: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Personal' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  deadline: { type: String },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  tasks: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  }],
  notes: { type: String, default: '' },
  progress: { type: Number, default: 0 },
}, { timestamps: true });

PlanSchema.index({ userId: 1, status: 1 });

export interface IBook extends Document {
  userId: string;
  title: string;
  subtitle?: string;
  genre: string;
  description: string;
  coverStyle: string;
  status: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  genre: { type: String, default: 'Memoir' },
  description: { type: String, default: '' },
  coverStyle: { type: String, default: 'classic-dark' },
  status: { type: String, enum: ['draft', 'in_progress', 'completed'], default: 'draft' },
  wordCount: { type: Number, default: 0 },
}, { timestamps: true });

export interface IChapter extends Document {
  userId: string;
  bookId: string;
  title: string;
  order: number;
  content: string;
  summary?: string;
  status: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChapterSchema = new Schema<IChapter>({
  userId: { type: String, required: true, index: true },
  bookId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  order: { type: Number, default: 1 },
  content: { type: String, default: '' },
  summary: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'revised', 'final'], default: 'draft' },
  wordCount: { type: Number, default: 0 },
}, { timestamps: true });

ChapterSchema.index({ bookId: 1, order: 1 });

export interface ISkill extends Document {
  userId?: string;
  isSystem: boolean;
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  variables: string[];
  tags: string[];
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

const SkillSchema = new Schema<ISkill>({
  userId: { type: String, index: true },
  isSystem: { type: Boolean, default: false },
  name: { type: String, required: true },
  category: { type: String, default: 'Writing' },
  description: { type: String, required: true },
  promptTemplate: { type: String, required: true },
  variables: { type: [String], default: ['text'] },
  tags: { type: [String], default: [] },
  icon: { type: String, default: 'Sparkles' },
}, { timestamps: true });

export interface IChat extends Document {
  userId: string;
  title: string;
  mode: string;
  linkedResourceId?: string;
  linkedResourceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>({
  userId: { type: String, required: true, index: true },
  title: { type: String, default: 'New Conversation' },
  mode: { type: String, enum: ['default', 'diary', 'book', 'plan'], default: 'default' },
  linkedResourceId: { type: String },
  linkedResourceType: { type: String },
}, { timestamps: true });

export interface IAttachment {
  type: 'book' | 'chapter' | 'plan' | 'skill' | 'diary';
  id: string;
  title: string;
}

export interface IActionProposal {
  type: 'create_diary' | 'update_plan' | 'add_chapter' | 'create_skill' | 'replace_content';
  targetId?: string;
  targetName?: string;
  data: any;
  status: 'pending' | 'applied' | 'rejected';
}

export interface IMessage extends Document {
  userId: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: IAttachment[];
  skillExecuted?: { skillId: string; skillName: string };
  detectedIntent?: { type: string; explanation: string };
  actionProposal?: IActionProposal;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  userId: { type: String, required: true, index: true },
  chatId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  attachments: [{
    type: { type: String },
    id: { type: String },
    title: { type: String }
  }],
  skillExecuted: {
    skillId: { type: String },
    skillName: { type: String }
  },
  detectedIntent: {
    type: { type: String },
    explanation: { type: String }
  },
  actionProposal: {
    type: { type: String },
    targetId: { type: String },
    targetName: { type: String },
    data: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['pending', 'applied', 'rejected'], default: 'pending' }
  }
}, { timestamps: true });

MessageSchema.index({ chatId: 1, createdAt: 1 });

// Avoid model overwrite errors in development restarts
export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const DiaryEntryModel = mongoose.models.DiaryEntry || mongoose.model<IDiaryEntry>('DiaryEntry', DiaryEntrySchema);
export const PlanModel = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema);
export const BookModel = mongoose.models.Book || mongoose.model<IBook>('Book', BookSchema);
export const ChapterModel = mongoose.models.Chapter || mongoose.model<IChapter>('Chapter', ChapterSchema);
export const SkillModel = mongoose.models.Skill || mongoose.model<ISkill>('Skill', SkillSchema);
export const ChatModel = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);
export const MessageModel = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
