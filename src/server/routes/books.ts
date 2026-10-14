import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/books
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const books = await db.books.findMany(req.user!.id);
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch books.' });
  }
});

// POST /api/books
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, subtitle, genre, description, coverStyle, status } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Book title is required.' });
      return;
    }

    const book = await db.books.create(req.user!.id, {
      title,
      subtitle,
      genre: genre || 'Memoir',
      description: description || '',
      coverStyle: coverStyle || 'classic-dark',
      status: status || 'draft',
    });

    // Automatically create Chapter 1 for convenience
    await db.chapters.create(req.user!.id, book.id || book._id.toString(), {
      title: 'Chapter 1: The Beginning',
      content: '',
      order: 1,
      status: 'draft',
    });

    const fullBook = await db.books.findById(req.user!.id, book.id || book._id.toString());
    res.status(201).json({ book: fullBook });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create book.' });
  }
});

// GET /api/books/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const book = await db.books.findById(req.user!.id, req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch book.' });
  }
});

// PUT /api/books/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, subtitle, genre, description, coverStyle, status } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (subtitle !== undefined) updates.subtitle = subtitle;
    if (genre !== undefined) updates.genre = genre;
    if (description !== undefined) updates.description = description;
    if (coverStyle !== undefined) updates.coverStyle = coverStyle;
    if (status !== undefined) updates.status = status;

    const updated = await db.books.update(req.user!.id, req.params.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Book not found or unauthorized.' });
      return;
    }

    res.json({ book: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

// DELETE /api/books/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await db.books.delete(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Book not found or unauthorized.' });
      return;
    }
    res.json({ success: true, message: 'Book and its chapters deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});

// POST /api/books/:id/chapters
router.post('/:id/chapters', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, summary, status, order } = req.body;
    const book = await db.books.findById(req.user!.id, req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    const chapter = await db.chapters.create(req.user!.id, req.params.id, {
      title,
      content,
      summary,
      status,
      order,
    });

    res.status(201).json({ chapter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create chapter.' });
  }
});

// PUT /api/books/:id/chapters/reorder
router.put('/:id/chapters/reorder', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds array is required.' });
      return;
    }

    const chapters = await db.chapters.reorder(req.user!.id, req.params.id, orderedIds);
    res.json({ chapters });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder chapters.' });
  }
});

// GET /api/books/:id/chapters/:chapterId
router.get('/:id/chapters/:chapterId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const chapter = await db.chapters.findById(req.user!.id, req.params.chapterId);
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }
    res.json({ chapter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chapter.' });
  }
});

// PUT /api/books/:id/chapters/:chapterId
router.put('/:id/chapters/:chapterId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, summary, status, order } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (summary !== undefined) updates.summary = summary;
    if (status !== undefined) updates.status = status;
    if (order !== undefined) updates.order = order;

    const chapter = await db.chapters.update(req.user!.id, req.params.chapterId, updates);
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found or unauthorized.' });
      return;
    }

    res.json({ chapter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update chapter.' });
  }
});

// DELETE /api/books/:id/chapters/:chapterId
router.delete('/:id/chapters/:chapterId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await db.chapters.delete(req.user!.id, req.params.chapterId);
    if (!deleted) {
      res.status(404).json({ error: 'Chapter not found or unauthorized.' });
      return;
    }
    res.json({ success: true, message: 'Chapter deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chapter.' });
  }
});

export default router;
