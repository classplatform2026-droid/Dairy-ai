import mongoose from 'mongoose';
import {
  UserModel,
  DiaryEntryModel,
  PlanModel,
  BookModel,
  ChapterModel,
  SkillModel,
  ChatModel,
  MessageModel,
} from './models.js';
import { localStore } from './localStore.js';

let isMongooseConnected = false;

export async function initDatabase(): Promise<{ type: 'mongodb' | 'local'; connected: boolean; message: string }> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    return {
      type: 'local',
      connected: true,
      message: 'Running on embedded persistent JSON store (local file-backed). Configure MONGODB_URI to connect to MongoDB Atlas.',
    };
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    isMongooseConnected = true;
    console.log('[LifeNote DB] Successfully connected to MongoDB cluster.');
    return {
      type: 'mongodb',
      connected: true,
      message: 'Connected to MongoDB cluster.',
    };
  } catch (err: any) {
    console.warn('[LifeNote DB] Could not connect to MONGODB_URI. Falling back to persistent local storage.', err.message);
    isMongooseConnected = false;
    return {
      type: 'local',
      connected: true,
      message: `MongoDB connection attempt failed (${err.message}). Using persistent local storage.`,
    };
  }
}

export function getDatabaseStatus() {
  return {
    isMongo: isMongooseConnected,
    mode: isMongooseConnected ? 'MongoDB / Mongoose' : 'Embedded Persistent Store',
    status: 'healthy',
  };
}

// Unified repository ensuring consistent API and user ownership verification
export const db = {
  // Users
  users: {
    findByEmail: async (email: string) => {
      if (isMongooseConnected) {
        return UserModel.findOne({ email: email.toLowerCase() }).lean();
      }
      return localStore.findUserByEmail(email);
    },
    findById: async (id: string) => {
      if (isMongooseConnected) {
        return UserModel.findById(id).lean();
      }
      return localStore.findUserById(id);
    },
    create: async (data: any) => {
      if (isMongooseConnected) {
        const u = await UserModel.create(data);
        return u.toObject();
      }
      return localStore.createUser(data);
    },
    update: async (id: string, updates: any) => {
      if (isMongooseConnected) {
        return UserModel.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
      }
      return localStore.updateUser(id, updates);
    },
    deletePermanently: async (id: string) => {
      if (isMongooseConnected) {
        await Promise.all([
          UserModel.findByIdAndDelete(id),
          DiaryEntryModel.deleteMany({ userId: id }),
          PlanModel.deleteMany({ userId: id }),
          BookModel.deleteMany({ userId: id }),
          ChapterModel.deleteMany({ userId: id }),
          SkillModel.deleteMany({ userId: id, isSystem: false }),
          ChatModel.deleteMany({ userId: id }),
          MessageModel.deleteMany({ userId: id }),
        ]);
        return true;
      }
      return localStore.deleteUserDataPermanently(id);
    }
  },

  // Diaries
  diaries: {
    findMany: async (userId: string, search?: string, tag?: string, mood?: string) => {
      if (isMongooseConnected) {
        const query: any = { userId };
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } }
          ];
        }
        if (tag) query.tags = tag;
        if (mood) query.mood = mood;
        return DiaryEntryModel.find(query).sort({ date: -1, createdAt: -1 }).lean();
      }
      return localStore.getDiaries(userId, search, tag, mood);
    },
    findById: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        return DiaryEntryModel.findOne({ _id: id, userId }).lean();
      }
      return localStore.getDiaryById(userId, id);
    },
    create: async (userId: string, data: any) => {
      if (isMongooseConnected) {
        const words = (data.content || '').trim().split(/\s+/).filter(Boolean).length;
        const entry = await DiaryEntryModel.create({
          userId,
          title: data.title || 'Untitled Entry',
          content: data.content || '',
          mood: data.mood || 'thoughtful',
          weather: data.weather || 'sunny',
          tags: data.tags || [],
          location: data.location || '',
          date: data.date || new Date().toISOString().split('T')[0],
          wordCount: words,
          favorite: !!data.favorite,
        });
        return entry.toObject();
      }
      return localStore.createDiary(userId, data);
    },
    update: async (userId: string, id: string, updates: any) => {
      if (isMongooseConnected) {
        if (updates.content !== undefined) {
          updates.wordCount = (updates.content || '').trim().split(/\s+/).filter(Boolean).length;
        }
        return DiaryEntryModel.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }).lean();
      }
      return localStore.updateDiary(userId, id, updates);
    },
    delete: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        const res = await DiaryEntryModel.deleteOne({ _id: id, userId });
        return res.deletedCount > 0;
      }
      return localStore.deleteDiary(userId, id);
    }
  },

  // Plans
  plans: {
    findMany: async (userId: string, status?: string) => {
      if (isMongooseConnected) {
        const query: any = { userId };
        if (status && status !== 'all') query.status = status;
        return PlanModel.find(query).sort({ updatedAt: -1 }).lean();
      }
      return localStore.getPlans(userId, status);
    },
    findById: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        return PlanModel.findOne({ _id: id, userId }).lean();
      }
      return localStore.getPlanById(userId, id);
    },
    create: async (userId: string, data: any) => {
      if (isMongooseConnected) {
        const tasks = (data.tasks || []).map((t: any, i: number) => ({
          id: t.id || 'tsk_' + Math.random().toString(36).substr(2, 9),
          title: t.title,
          completed: !!t.completed,
          order: t.order ?? i,
        }));
        const completedCount = tasks.filter((t: any) => t.completed).length;
        const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
        const plan = await PlanModel.create({
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
        });
        return plan.toObject();
      }
      return localStore.createPlan(userId, data);
    },
    update: async (userId: string, id: string, updates: any) => {
      if (isMongooseConnected) {
        const existing = await PlanModel.findOne({ _id: id, userId });
        if (!existing) return null;
        if (updates.tasks) {
          const completedCount = updates.tasks.filter((t: any) => t.completed).length;
          updates.progress = updates.tasks.length > 0 ? Math.round((completedCount / updates.tasks.length) * 100) : 0;
          if (updates.progress === 100 && !updates.status) updates.status = 'completed';
        }
        return PlanModel.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }).lean();
      }
      return localStore.updatePlan(userId, id, updates);
    },
    delete: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        const res = await PlanModel.deleteOne({ _id: id, userId });
        return res.deletedCount > 0;
      }
      return localStore.deletePlan(userId, id);
    }
  },

  // Books
  books: {
    findMany: async (userId: string) => {
      if (isMongooseConnected) {
        const books = await BookModel.find({ userId }).sort({ updatedAt: -1 }).lean();
        const enriched = await Promise.all(books.map(async (book) => {
          const chapters = await ChapterModel.find({ bookId: book._id, userId }).lean();
          const wordCount = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
          return {
            ...book,
            id: book._id.toString(),
            chapterCount: chapters.length,
            wordCount,
          };
        }));
        return enriched;
      }
      return localStore.getBooks(userId);
    },
    findById: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        const book = await BookModel.findOne({ _id: id, userId }).lean();
        if (!book) return null;
        const chapters = await ChapterModel.find({ bookId: id, userId }).sort({ order: 1 }).lean();
        const wordCount = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
        return {
          ...book,
          id: (book as any)._id.toString(),
          chapters: chapters.map(c => ({ ...c, id: c._id.toString() })),
          chapterCount: chapters.length,
          wordCount,
        };
      }
      return localStore.getBookById(userId, id);
    },
    create: async (userId: string, data: any) => {
      if (isMongooseConnected) {
        const book = await BookModel.create({
          userId,
          title: data.title || 'Untitled Book',
          subtitle: data.subtitle || '',
          genre: data.genre || 'Memoir',
          description: data.description || '',
          coverStyle: data.coverStyle || 'classic-dark',
          status: data.status || 'draft',
          wordCount: 0,
        });
        return { ...book.toObject(), id: book._id.toString() };
      }
      return localStore.createBook(userId, data);
    },
    update: async (userId: string, id: string, updates: any) => {
      if (isMongooseConnected) {
        const res = await BookModel.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }).lean();
        return res ? { ...res, id: res._id.toString() } : null;
      }
      return localStore.updateBook(userId, id, updates);
    },
    delete: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        await ChapterModel.deleteMany({ bookId: id, userId });
        const res = await BookModel.deleteOne({ _id: id, userId });
        return res.deletedCount > 0;
      }
      return localStore.deleteBook(userId, id);
    }
  },

  // Chapters
  chapters: {
    findMany: async (userId: string, bookId: string) => {
      if (isMongooseConnected) {
        const list = await ChapterModel.find({ bookId, userId }).sort({ order: 1 }).lean();
        return list.map(c => ({ ...c, id: c._id.toString() }));
      }
      return localStore.getChapters(userId, bookId);
    },
    findById: async (userId: string, chapterId: string) => {
      if (isMongooseConnected) {
        const c = await ChapterModel.findOne({ _id: chapterId, userId }).lean();
        return c ? { ...c, id: c._id.toString() } : null;
      }
      return localStore.getChapterById(userId, chapterId);
    },
    create: async (userId: string, bookId: string, data: any) => {
      if (isMongooseConnected) {
        const count = await ChapterModel.countDocuments({ bookId, userId });
        const words = (data.content || '').trim().split(/\s+/).filter(Boolean).length;
        const chapter = await ChapterModel.create({
          userId,
          bookId,
          title: data.title || `Chapter ${count + 1}`,
          order: data.order ?? count + 1,
          content: data.content || '',
          summary: data.summary || '',
          status: data.status || 'draft',
          wordCount: words,
        });
        return { ...chapter.toObject(), id: chapter._id.toString() };
      }
      return localStore.createChapter(userId, bookId, data);
    },
    update: async (userId: string, chapterId: string, updates: any) => {
      if (isMongooseConnected) {
        if (updates.content !== undefined) {
          updates.wordCount = (updates.content || '').trim().split(/\s+/).filter(Boolean).length;
        }
        const res = await ChapterModel.findOneAndUpdate({ _id: chapterId, userId }, { $set: updates }, { new: true }).lean();
        return res ? { ...res, id: res._id.toString() } : null;
      }
      return localStore.updateChapter(userId, chapterId, updates);
    },
    delete: async (userId: string, chapterId: string) => {
      if (isMongooseConnected) {
        const res = await ChapterModel.deleteOne({ _id: chapterId, userId });
        return res.deletedCount > 0;
      }
      return localStore.deleteChapter(userId, chapterId);
    },
    reorder: async (userId: string, bookId: string, orderedIds: string[]) => {
      if (isMongooseConnected) {
        await Promise.all(
          orderedIds.map((id, index) =>
            ChapterModel.updateOne({ _id: id, bookId, userId }, { $set: { order: index + 1 } })
          )
        );
        const list = await ChapterModel.find({ bookId, userId }).sort({ order: 1 }).lean();
        return list.map(c => ({ ...c, id: c._id.toString() }));
      }
      return localStore.reorderChapters(userId, bookId, orderedIds);
    }
  },

  // Skills
  skills: {
    findMany: async (userId?: string) => {
      if (isMongooseConnected) {
        const query: any = { $or: [{ isSystem: true }] };
        if (userId) query.$or.push({ userId });
        const skills = await SkillModel.find(query).lean();
        return skills.map(s => ({ ...s, id: s._id.toString() }));
      }
      return localStore.getSkills(userId);
    },
    findById: async (id: string, userId?: string) => {
      if (isMongooseConnected) {
        const s = await SkillModel.findOne({
          _id: id,
          $or: [{ isSystem: true }, { userId }]
        }).lean();
        return s ? { ...s, id: s._id.toString() } : null;
      }
      return localStore.getSkillById(id, userId);
    },
    create: async (userId: string, data: any) => {
      if (isMongooseConnected) {
        const skill = await SkillModel.create({
          userId,
          isSystem: false,
          name: data.name,
          category: data.category || 'Writing',
          description: data.description,
          promptTemplate: data.promptTemplate,
          variables: data.variables || ['text'],
          tags: data.tags || [],
          icon: data.icon || 'Sparkles',
        });
        return { ...skill.toObject(), id: skill._id.toString() };
      }
      return localStore.createSkill(userId, data);
    },
    update: async (userId: string, id: string, updates: any) => {
      if (isMongooseConnected) {
        const s = await SkillModel.findOneAndUpdate({ _id: id, userId, isSystem: false }, { $set: updates }, { new: true }).lean();
        return s ? { ...s, id: s._id.toString() } : null;
      }
      return localStore.updateSkill(userId, id, updates);
    },
    delete: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        const res = await SkillModel.deleteOne({ _id: id, userId, isSystem: false });
        return res.deletedCount > 0;
      }
      return localStore.deleteSkill(userId, id);
    }
  },

  // Chats & Messages
  chats: {
    findMany: async (userId: string) => {
      if (isMongooseConnected) {
        const chats = await ChatModel.find({ userId }).sort({ updatedAt: -1 }).lean();
        return chats.map(c => ({ ...c, id: c._id.toString() }));
      }
      return localStore.getChats(userId);
    },
    findById: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        const chat = await ChatModel.findOne({ _id: id, userId }).lean();
        if (!chat) return null;
        const messages = await MessageModel.find({ chatId: id, userId }).sort({ createdAt: 1 }).lean();
        return {
          ...chat,
          id: (chat as any)._id.toString(),
          messages: messages.map(m => ({ ...m, id: m._id.toString() })),
        };
      }
      return localStore.getChatById(userId, id);
    },
    create: async (userId: string, data: any) => {
      if (isMongooseConnected) {
        const chat = await ChatModel.create({
          userId,
          title: data.title || 'New Conversation',
          mode: data.mode || 'default',
          linkedResourceId: data.linkedResourceId,
          linkedResourceType: data.linkedResourceType,
        });
        return { ...chat.toObject(), id: chat._id.toString() };
      }
      return localStore.createChat(userId, data);
    },
    update: async (userId: string, id: string, updates: any) => {
      if (isMongooseConnected) {
        const c = await ChatModel.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }).lean();
        return c ? { ...c, id: c._id.toString() } : null;
      }
      return localStore.updateChat(userId, id, updates);
    },
    delete: async (userId: string, id: string) => {
      if (isMongooseConnected) {
        // Only delete the chat and its messages; never delete referenced resources!
        await MessageModel.deleteMany({ chatId: id, userId });
        const res = await ChatModel.deleteOne({ _id: id, userId });
        return res.deletedCount > 0;
      }
      return localStore.deleteChat(userId, id);
    },
    createMessage: async (userId: string, chatId: string, data: any) => {
      if (isMongooseConnected) {
        const msg = await MessageModel.create({
          userId,
          chatId,
          role: data.role || 'user',
          content: data.content,
          attachments: data.attachments || [],
          skillExecuted: data.skillExecuted,
          detectedIntent: data.detectedIntent,
          actionProposal: data.actionProposal,
        });
        await ChatModel.updateOne({ _id: chatId, userId }, { $set: { updatedAt: new Date() } });
        return { ...msg.toObject(), id: msg._id.toString() };
      }
      return localStore.createMessage(userId, chatId, data);
    },
    updateProposalStatus: async (userId: string, messageId: string, status: 'applied' | 'rejected') => {
      if (isMongooseConnected) {
        const msg = await MessageModel.findOneAndUpdate(
          { _id: messageId, userId },
          { $set: { 'actionProposal.status': status } },
          { new: true }
        ).lean();
        return msg ? { ...msg, id: msg._id.toString() } : null;
      }
      return localStore.updateMessageProposal(userId, messageId, status);
    }
  },

  // Export & Stats
  exportUserData: async (userId: string) => {
    return localStore.exportUserData(userId);
  },
  getDashboardStats: async (userId: string) => {
    return localStore.getDashboardStats(userId);
  }
};
