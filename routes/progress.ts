import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import Progress from '../models/Progress';

const router = Router();

// ─── GET /progress/me ─────────────────────────────────
// Called when user logs in — downloads their full progress
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const progress = await Progress.findOne({ uid: req.uid });

        // If no progress yet, return empty structure
        if (!progress) {
            return res.json({
                uid: req.uid,
                questions: [],
                streak: 0,
                lastActiveDate: null,
                totalPoints: 0,
                lastSyncedAt: null,
            });
        }

        res.json({ progress });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── POST /progress/sync ──────────────────────────────
// Called every time Flutter app opens — uploads local progress diff
// Payload: array of question progress entries
router.post('/sync', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;

        const {
            questions,
            lastActiveDate,
        }: {
            questions: {
                questionId: string;
                status: 'unseen' | 'got_it' | 'review';
                attempts: number;
                correct: number;
                lastSeen: string;
                avgTime: number;
            }[];
            lastActiveDate: string;
        } = req.body;

        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ message: 'questions array is required' });
        }

        // Find or create progress document for this user
        let progress = await Progress.findOne({ uid });

        if (!progress) {
            progress = await Progress.create({
                uid,
                questions: [],
                streak: 0,
                totalPoints: 0,
                lastActiveDate: null,
            });
        }

        // Merge incoming questions into existing progress
        for (const incoming of questions) {
            const existingIndex = progress.questions.findIndex(
                (q) => q.questionId.toString() === incoming.questionId
            );

            if (existingIndex > -1) {
                // Update existing question progress
                // Only update if incoming data is newer/better
                const existing = progress.questions[existingIndex];
                existing.status = incoming.status;
                existing.attempts = Math.max(existing.attempts, incoming.attempts);
                existing.correct = Math.max(existing.correct, incoming.correct);
                existing.lastSeen = new Date(incoming.lastSeen);
                existing.avgTime = incoming.avgTime;
            } else {
                // New question — push it
                progress.questions.push({
                    questionId: incoming.questionId as any,
                    status: incoming.status,
                    attempts: incoming.attempts,
                    correct: incoming.correct,
                    lastSeen: new Date(incoming.lastSeen),
                    avgTime: incoming.avgTime,
                });
            }
        }

        // ─── Streak calculation ────────────────────────────
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastActive = progress.lastActiveDate
            ? new Date(progress.lastActiveDate)
            : null;

        if (lastActive) {
            lastActive.setHours(0, 0, 0, 0);
            const diffDays = Math.floor(
                (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDays === 0) {
                // Same day — no change to streak
            } else if (diffDays === 1) {
                // Consecutive day — increment streak
                progress.streak += 1;
            } else {
                // Gap of more than 1 day — reset streak
                progress.streak = 1;
            }
        } else {
            // First time syncing
            progress.streak = 1;
        }

        // ─── Points calculation ────────────────────────────
        // 10 points per correct answer tracked in this sync
        const newCorrects = questions.reduce((sum, q) => sum + (q.correct ?? 0), 0);
        progress.totalPoints += newCorrects * 10;

        progress.lastActiveDate = new Date(lastActiveDate ?? Date.now());
        progress.lastSyncedAt = new Date();

        await progress.save();

        res.json({
            message: 'Progress synced',
            streak: progress.streak,
            totalPoints: progress.totalPoints,
            lastSyncedAt: progress.lastSyncedAt,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /progress/stats ──────────────────────────────
// Returns summary stats for the client home/stats screen
router.get('/stats', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const progress = await Progress.findOne({ uid: req.uid });

        if (!progress) {
            return res.json({
                total: 0,
                mastered: 0,
                review: 0,
                unseen: 0,
                accuracy: 0,
                avgTime: 0,
                streak: 0,
                points: 0,
            });
        }

        const questions = progress.questions;
        const total = questions.length;
        const mastered = questions.filter((q) => q.status === 'got_it').length;
        const review = questions.filter((q) => q.status === 'review').length;
        const unseen = questions.filter((q) => q.status === 'unseen').length;

        const totalAttempts = questions.reduce((sum, q) => sum + q.attempts, 0);
        const totalCorrect = questions.reduce((sum, q) => sum + q.correct, 0);
        const accuracy = totalAttempts > 0
            ? Math.round((totalCorrect / totalAttempts) * 100)
            : 0;

        const avgTime = total > 0
            ? Math.round(questions.reduce((sum, q) => sum + (q.avgTime ?? 0), 0) / total)
            : 0;

        res.json({
            total,
            mastered,
            review,
            unseen,
            accuracy,
            avgTime,
            streak: progress.streak,
            points: progress.totalPoints,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;