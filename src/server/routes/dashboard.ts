import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const stats = await db.getDashboardStats(userId);
    const recentDiaries = await db.diaries.findMany(userId);
    const activePlans = await db.plans.findMany(userId);
    const books = await db.books.findMany(userId);
    const recentChats = await db.chats.findMany(userId);

    res.json({
      stats,
      recentDiaries: recentDiaries.slice(0, 5),
      activePlans: activePlans.filter((p: any) => p.status !== 'completed').slice(0, 4),
      books: books.slice(0, 3),
      recentChats: recentChats.slice(0, 4),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

export default router;
