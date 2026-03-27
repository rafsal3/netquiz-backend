import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import { isAdmin } from '../middleware/isAdmin';
import User from '../models/User';
import Progress from '../models/Progress';

const router = Router();

// All admin routes are protected
router.use(verifyToken, isAdmin);

// ─── GET /admin/users ─────────────────────────────────
// List all users with optional search
router.get('/users', async (req: AuthRequest, res: Response) => {
    try {
        const { search, page = '1', limit = '20' } = req.query;

        const filter: Record<string, any> = {};
        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { displayName: { $regex: search, $options: 'i' } },
            ];
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [users, total] = await Promise.all([
            User.find(filter).skip(skip).limit(limitNum).sort({ createdAt: -1 }),
            User.countDocuments(filter),
        ]);

        res.json({
            users,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /admin/users/:uid ────────────────────────────
// Get single user details
router.get('/users/:uid', async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findOne({ uid: req.params.uid });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── PUT /admin/users/:uid ────────────────────────────
// Update user role or details
router.put('/users/:uid', async (req: AuthRequest, res: Response) => {
    try {
        const { role, displayName } = req.body;

        const user = await User.findOneAndUpdate(
            { uid: req.params.uid },
            { $set: { role, displayName } },
            { new: true }
        );

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── DELETE /admin/users/:uid ─────────────────────────
router.delete('/users/:uid', async (req: AuthRequest, res: Response) => {
    try {
        await User.findOneAndDelete({ uid: req.params.uid });
        // Also delete their progress
        await Progress.findOneAndDelete({ uid: req.params.uid });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /admin/users/:uid/progress ──────────────────
// Detailed progress for a specific user
router.get('/users/:uid/progress', async (req: AuthRequest, res: Response) => {
    try {
        const progress = await Progress.findOne({ uid: req.params.uid })
            .populate('questions.questionId', 'text paperId moduleId');

        if (!progress) {
            return res.json({
                uid: req.params.uid,
                questions: [],
                streak: 0,
                points: 0,
                accuracy: 0,
                avgTime: 0,
                mastered: 0,
                review: 0,
            });
        }

        const questions = progress.questions;
        const total = questions.length;
        const mastered = questions.filter((q) => q.status === 'got_it').length;
        const review = questions.filter((q) => q.status === 'review').length;
        const totalAttempts = questions.reduce((sum, q) => sum + q.attempts, 0);
        const totalCorrect = questions.reduce((sum, q) => sum + q.correct, 0);
        const accuracy = totalAttempts > 0
            ? Math.round((totalCorrect / totalAttempts) * 100)
            : 0;
        const avgTime = total > 0
            ? Math.round(questions.reduce((sum, q) => sum + (q.avgTime ?? 0), 0) / total)
            : 0;

        res.json({
            uid: req.params.uid,
            streak: progress.streak,
            points: progress.totalPoints,
            lastActive: progress.lastActiveDate,
            lastSyncedAt: progress.lastSyncedAt,
            accuracy,
            avgTime,
            mastered,
            review,
            total,
            questions: progress.questions,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /admin/stats ─────────────────────────────────
// Overall platform stats for admin dashboard
router.get('/stats', async (req: AuthRequest, res: Response) => {
    try {
        const [
            totalUsers,
            totalProgress,
        ] = await Promise.all([
            User.countDocuments(),
            Progress.find().lean(),
        ]);

        const totalQuestionsSeen = totalProgress.reduce(
            (sum, p) => sum + p.questions.length, 0
        );
        const totalCorrect = totalProgress.reduce(
            (sum, p) => sum + p.questions.reduce((s, q) => s + q.correct, 0), 0
        );
        const totalAttempts = totalProgress.reduce(
            (sum, p) => sum + p.questions.reduce((s, q) => s + q.attempts, 0), 0
        );
        const overallAccuracy = totalAttempts > 0
            ? Math.round((totalCorrect / totalAttempts) * 100)
            : 0;

        const activeToday = totalProgress.filter((p) => {
            if (!p.lastActiveDate) return false;
            const last = new Date(p.lastActiveDate);
            const today = new Date();
            return (
                last.getDate() === today.getDate() &&
                last.getMonth() === today.getMonth() &&
                last.getFullYear() === today.getFullYear()
            );
        }).length;

        res.json({
            totalUsers,
            activeToday,
            totalQuestionsSeen,
            overallAccuracy,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;