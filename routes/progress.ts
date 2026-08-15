import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import Progress from '../models/Progress';
import DailyQuiz from '../models/DailyQuiz';

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
                activeDates: [],
                lastActiveDate: null,
                totalPoints: 0,
                level: 1,
                lastDailyQuizDate: "",
                lastSyncedAt: null,
            });
        }
        
        const todayStr = new Date().toISOString().split('T')[0];
        const isDailyQuizCompleted = progress.lastDailyQuizDate === todayStr;

        res.json({ 
            progress: {
                ...progress.toObject(),
                isDailyQuizCompleted
            } 
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── Helper: Update streak and active dates ─────────────────────────────────
export function updateStreakAndActivity(progress: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (!progress.activeDates) {
        progress.activeDates = [];
    }
    if (!progress.activeDates.includes(todayStr)) {
        progress.activeDates.push(todayStr);
    }

    const lastActive = progress.lastActiveDate
        ? new Date(progress.lastActiveDate)
        : null;

    if (lastActive) {
        lastActive.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
            (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 0) {
            // Same day — ensure streak is at least 1
            if (!progress.streak || progress.streak === 0) {
                progress.streak = 1;
            }
        } else if (diffDays === 1) {
            // Consecutive day — increment streak
            progress.streak = (progress.streak || 0) + 1;
        } else {
            // Gap of more than 1 day — reset streak to 1
            progress.streak = 1;
        }
    } else {
        // First active day
        progress.streak = 1;
    }

    progress.lastActiveDate = new Date();
}

// ─── POST /progress/sync ──────────────────────────────
// Called every time client or app syncs practice / quiz progress
// Payload: array of question progress entries
router.post('/sync', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;

        const {
            questions,
            lastActiveDate,
            level,
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
            level?: number;
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
                activeDates: [],
                totalPoints: 0,
                level: 1,
                lastActiveDate: null,
            });
        }

        let pointsDelta = 0;

        // Merge incoming questions into existing progress
        for (const incoming of questions) {
            const existingIndex = progress.questions.findIndex(
                (q) => q.questionId.toString() === incoming.questionId
            );

            const incomingCorrect = incoming.correct ?? 0;

            if (existingIndex > -1) {
                // Update existing question progress
                const existing = progress.questions[existingIndex];
                existing.status = incoming.status;
                existing.attempts = Math.max(existing.attempts, incoming.attempts);
                
                const additionalCorrect = Math.max(0, incomingCorrect - existing.correct);
                pointsDelta += additionalCorrect * 10;
                
                existing.correct = Math.max(existing.correct, incomingCorrect);
                existing.lastSeen = new Date(incoming.lastSeen || new Date());
                existing.avgTime = incoming.avgTime;
            } else {
                // New question — push it
                pointsDelta += incomingCorrect * 10;
                progress.questions.push({
                    questionId: incoming.questionId as any,
                    status: incoming.status,
                    attempts: incoming.attempts,
                    correct: incomingCorrect,
                    lastSeen: new Date(incoming.lastSeen || new Date()),
                    avgTime: incoming.avgTime,
                });
            }
        }

        // ─── Streak & Activity calculation ─────────────────
        updateStreakAndActivity(progress);

        // ─── Points calculation ────────────────────────────
        // 10 points per newly gained correct answer
        progress.totalPoints += pointsDelta;
        progress.lastSyncedAt = new Date();

        // ─── Level calculation ────────────────────────────
        if (level && level > (progress.level || 1)) {
            progress.level = level;
        }

        await progress.save();

        res.json({
            message: 'Progress synced',
            streak: progress.streak,
            activeDates: progress.activeDates,
            totalPoints: progress.totalPoints,
            level: progress.level || 1,
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
                activeDates: [],
                points: 0,
                level: 1,
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

        // Check if streak is still active or expired
        // If lastActiveDate was before yesterday (gap of >= 2 days), current effective streak is 0
        let currentStreak = progress.streak || 0;
        if (progress.lastActiveDate && currentStreak > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const lastActive = new Date(progress.lastActiveDate);
            lastActive.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) {
                // Gap of more than 1 day - streak has broken
                currentStreak = 0;
            }
        }

        // Calculate activity counts per date for heatmap
        const activityMap: Record<string, number> = {};
        if (progress.activeDates && Array.isArray(progress.activeDates)) {
            for (const d of progress.activeDates) {
                activityMap[d] = 1;
            }
        }

        const dailyQuizzes = await DailyQuiz.find({ uid: req.uid }, { date: 1, questions: 1 }).lean();
        for (const dq of dailyQuizzes) {
            if (dq.date) {
                const questionsAnswered = dq.questions ? dq.questions.filter((q: any) => q.solved || (q.attempts && q.attempts > 0)).length : 0;
                activityMap[dq.date] = (activityMap[dq.date] || 0) + Math.max(questionsAnswered, 1);
            }
        }

        res.json({
            total,
            mastered,
            review,
            unseen,
            accuracy,
            avgTime,
            streak: currentStreak,
            activeDates: progress.activeDates || [],
            activityMap,
            points: progress.totalPoints,
            level: progress.level || 1,
            isDailyQuizCompleted: progress.lastDailyQuizDate === new Date().toISOString().split('T')[0],
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /progress/leaderboard ────────────────────────
// Returns a ranked list of users sorted by totalPoints (descending).
// Query params:
//   limit  – max entries to return (default 50, max 200)
// Response includes:
//   leaderboard  – array of ranked entries
//   myRank       – the calling user's rank & stats (always included)
router.get('/leaderboard', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200);

        // Aggregate: sort by totalPoints, join User for profile info
        const leaderboard = await Progress.aggregate([
            {
                $match: { totalPoints: { $gt: 0 } }, // only users who have points
            },
            {
                $sort: { totalPoints: -1 },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'uid',
                    foreignField: 'uid',
                    as: 'userInfo',
                },
            },
            {
                $unwind: {
                    path: '$userInfo',
                    preserveNullAndEmptyArrays: true, // keep users even without a User doc
                },
            },
            {
                $project: {
                    _id: 0,
                    uid: 1,
                    totalPoints: 1,
                    streak: 1,
                    displayName: { $ifNull: ['$userInfo.displayName', 'Anonymous'] },
                    photoURL: { $ifNull: ['$userInfo.photoURL', null] },
                },
            },
        ]);

        // Assign rank (1-based)
        const ranked = leaderboard.map((entry, index) => ({
            rank: index + 1,
            ...entry,
        }));

        // Find calling user's position in the full ranked list
        const myEntry = ranked.find((entry) => entry.uid === req.uid);

        // Return only the top `limit` entries for the leaderboard display
        const topEntries = ranked.slice(0, limit);

        res.json({
            leaderboard: topEntries,
            total: ranked.length,
            myRank: myEntry ?? null, // null if user has 0 points (not in list)
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── Patch /progress/daily-quiz ───────────────────────
// Marks today's daily quiz as completed
router.patch('/daily-quiz', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;
        const todayStr = new Date().toISOString().split('T')[0];

        let progress = await Progress.findOne({ uid });
        if (!progress) {
            progress = await Progress.create({
                uid,
                questions: [],
                streak: 0,
                activeDates: [],
                totalPoints: 0,
                level: 1,
                lastActiveDate: null,
            });
        }

        progress.lastDailyQuizDate = todayStr;
        updateStreakAndActivity(progress);
        await progress.save();

        res.json({
            message: 'Daily quiz status updated',
            lastDailyQuizDate: progress.lastDailyQuizDate,
            isDailyQuizCompleted: true,
            streak: progress.streak,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;