import { Router, Response } from 'express';
import { db } from '../db/connection.js';
import { hashPassword, comparePassword, generateToken, encryptSecret, decryptSecret } from '../utils/crypto.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { testAIConnection } from '../services/ai.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req, res): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existing = await db.users.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await db.users.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      isEmailVerified: false,
      verificationCode,
      bio: 'Lifelong learner & reflective thinker.',
      writingPreference: 'reflective',
      theme: 'minimal-light',
      aiProvider: 'gemini',
      selectedModel: 'gemini-3.1-flash-lite',
    });

    const token = generateToken({
      id: user.id || user._id.toString(),
      email: user.email,
      name: user.name,
    });

    // Create a welcoming first diary entry
    await db.diaries.create(user.id || user._id.toString(), {
      title: 'First Page of a New Chapter',
      content: 'Welcome to LifeNote AI. This is your personal sanctuary for unfiltered thoughts, strategic life plans, creative book manuscripts, and AI-assisted reflection.\n\nTake a breath. Every great thought begins with a single line.',
      mood: 'inspired',
      weather: 'sunny',
      tags: ['beginning', 'reflection'],
      favorite: true,
      date: new Date().toISOString().split('T')[0],
    });

    // Create a starter plan
    await db.plans.create(user.id || user._id.toString(), {
      title: 'Life Foundation & Daily Cadence',
      description: 'Establish daily mindfulness, writing habits, and clear personal goals.',
      category: 'Personal',
      priority: 'high',
      tasks: [
        { title: 'Write first journal entry in LifeNote AI', completed: true, order: 1 },
        { title: 'Explore AI writing refinement tools', completed: false, order: 2 },
        { title: 'Create a custom skill in the Skills Library', completed: false, order: 3 },
      ],
      notes: 'Consistency over perfection.',
      status: 'in_progress',
    });

    res.status(201).json({
      token,
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        bio: user.bio,
        writingPreference: user.writingPreference,
        aiProvider: user.aiProvider,
        selectedModel: user.selectedModel,
        hasCustomKey: false,
        verificationCode, // Provided for easy UI verification test
      },
    });
  } catch (err: any) {
    console.error('[Auth Route] Signup error:', err);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken({
      id: user.id || user._id.toString(),
      email: user.email,
      name: user.name,
    });

    res.json({
      token,
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        bio: user.bio,
        writingPreference: user.writingPreference,
        aiProvider: user.aiProvider,
        selectedModel: user.selectedModel,
        hasCustomKey: !!user.customApiKeyEncrypted,
      },
    });
  } catch (err: any) {
    console.error('[Auth Route] Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await db.users.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        bio: user.bio,
        writingPreference: user.writingPreference,
        aiProvider: user.aiProvider,
        selectedModel: user.selectedModel,
        hasCustomKey: !!user.customApiKeyEncrypted,
        verificationCode: user.verificationCode,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const user = await db.users.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (code && user.verificationCode && code.trim() !== user.verificationCode) {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    const updated = await db.users.update(req.user!.id, {
      isEmailVerified: true,
      verificationCode: null,
    });

    res.json({
      success: true,
      message: 'Email address successfully verified.',
      user: {
        id: updated.id || updated._id.toString(),
        name: updated.name,
        email: updated.email,
        isEmailVerified: true,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// POST /api/auth/request-password-reset
router.post('/request-password-reset', async (req, res): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      // Do not reveal user existence
      res.json({ success: true, message: 'If an account exists, a reset code was generated.' });
      return;
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await db.users.update(user.id || user._id.toString(), {
      resetToken,
      resetTokenExpiry: expiry,
    });

    res.json({
      success: true,
      message: 'Password reset code generated.',
      resetCode: resetToken, // Exposed in demo/applet environment for seamless testing
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request password reset.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, reset code, and new password are required.' });
      return;
    }

    const user = await db.users.findByEmail(email);
    if (!user || user.resetToken !== code.trim()) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.users.update(user.id || user._id.toString(), {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    });

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, bio, writingPreference, theme } = req.body;
    const updates: any = {};
    if (name) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio;
    if (writingPreference) updates.writingPreference = writingPreference;
    if (theme) updates.theme = theme;

    const user = await db.users.update(req.user!.id, updates);
    res.json({
      success: true,
      user: {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        bio: user.bio,
        writingPreference: user.writingPreference,
        theme: user.theme,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/security (Change password)
router.put('/security', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    const user = await db.users.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.users.update(req.user!.id, { passwordHash });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// PUT /api/auth/ai-config
router.put('/ai-config', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { aiProvider, selectedModel, customApiKey } = req.body;
    const updates: any = {};

    if (aiProvider) updates.aiProvider = aiProvider;
    if (selectedModel) updates.selectedModel = selectedModel;
    if (customApiKey !== undefined) {
      updates.customApiKeyEncrypted = customApiKey ? encryptSecret(customApiKey.trim()) : '';
    }

    const user = await db.users.update(req.user!.id, updates);

    res.json({
      success: true,
      message: 'AI configuration saved.',
      aiConfig: {
        aiProvider: user.aiProvider,
        selectedModel: user.selectedModel,
        hasCustomKey: !!user.customApiKeyEncrypted,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update AI configuration.' });
  }
});

// POST /api/auth/test-ai
router.post('/test-ai', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await db.users.findById(req.user!.id);
    const customKey = user?.customApiKeyEncrypted ? decryptSecret(user.customApiKeyEncrypted) : undefined;
    const model = req.body.model || user?.selectedModel || 'gemini-3.8-flash';

    const result = await testAIConnection(customKey, model);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'AI test failed.' });
  }
});

// POST /api/auth/export-data
router.post('/export-data', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = await db.exportUserData(req.user!.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data.' });
  }
});

// DELETE /api/auth/account
router.delete('/account', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await db.users.deletePermanently(req.user!.id);
    res.json({ success: true, message: 'Account and all associated data permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;
