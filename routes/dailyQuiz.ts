import { Router, Response } from "express";
import { Types } from "mongoose";
import { verifyToken, AuthRequest } from "../middleware/verifyToken";
import DailyQuizSettings from "../models/DailyQuizSettings";
import DailyQuiz from "../models/DailyQuiz";
import Question from "../models/Question";

const router = Router();

// ─── Helper: today's date string ─────────────────────────────────────────────
function todayStr(): string {
    return new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'
}

// ─── Helper: select questions for a daily quiz ────────────────────────────────
// Isolated so it can be improved later (difficulty filtering, AI, etc.)
// Strategy:
//   1. Fetch all admin-approved questions for this paper.
//   2. Look at the last 7 days of daily quizzes for this user+paper to find
//      recently used questionIds.
//   3. Prefer questions NOT in that recent set.
//   4. If not enough fresh ones, pad with questions from the recent set.
//   5. Shuffle and return `limit` items.
async function selectQuestions(
    uid: string,
    paperId: string,
    limit: number
): Promise<Types.ObjectId[]> {
    // 1. All questions for this paper (admin-approved)
    const allQuestions = await Question.find(
        { paperId: new Types.ObjectId(paperId), source: "admin" },
        { _id: 1 }
    ).lean();

    if (allQuestions.length === 0) return [];

    // 2. Recently used question IDs (last 7 days of daily quizzes)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const recentQuizzes = await DailyQuiz.find(
        {
            uid,
            paperId: new Types.ObjectId(paperId),
            date: { $gte: sevenDaysAgoStr },
        },
        { "questions.questionId": 1 }
    ).lean();

    const recentIds = new Set<string>(
        recentQuizzes.flatMap((q) =>
            q.questions.map((qq) => qq.questionId.toString())
        )
    );

    // 3. Split into fresh and recently-used pools
    const freshPool = allQuestions.filter(
        (q) => !recentIds.has(q._id.toString())
    );
    const usedPool = allQuestions.filter((q) =>
        recentIds.has(q._id.toString())
    );

    // 4. Shuffle helper
    const shuffle = <T>(arr: T[]): T[] =>
        arr
            .map((item) => ({ item, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ item }) => item);

    const shuffledFresh = shuffle(freshPool);
    const shuffledUsed = shuffle(usedPool);

    // 5. Fill up to `limit` preferring fresh questions
    const combined = [...shuffledFresh, ...shuffledUsed].slice(0, limit);
    return combined.map((q) => q._id as Types.ObjectId);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-quiz/settings
// Returns the authenticated user's quiz preferences (papers + limits).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/settings", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const settings = await DailyQuizSettings.findOne({ uid: req.uid }).populate(
            "papers.paperId",
            "name order"
        );

        if (!settings) {
            return res.json({ uid: req.uid, papers: [] });
        }

        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /daily-quiz/settings
// Saves or replaces the user's selected papers and question limits.
// Body: { papers: [{ paperId: string, questionLimit: number }] }
// ─────────────────────────────────────────────────────────────────────────────
router.put("/settings", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { papers } = req.body as {
            papers: { paperId: string; questionLimit: number }[];
        };

        if (!Array.isArray(papers)) {
            return res.status(400).json({ message: "papers array is required" });
        }

        // Validate each entry
        for (const p of papers) {
            if (!p.paperId || typeof p.questionLimit !== "number" || p.questionLimit < 1) {
                return res.status(400).json({
                    message: "Each paper must have a valid paperId and questionLimit >= 1",
                });
            }
        }

        const settings = await DailyQuizSettings.findOneAndUpdate(
            { uid: req.uid },
            {
                $set: {
                    papers: papers.map((p) => ({
                        paperId: new Types.ObjectId(p.paperId),
                        questionLimit: p.questionLimit,
                    })),
                },
            },
            { new: true, upsert: true }
        ).populate("papers.paperId", "name order");

        res.json({ message: "Settings saved", settings });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-quiz
// Returns today's quiz cards for every paper the user has selected.
// If a quiz for a paper hasn't been started yet, that card shows status "not_started".
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;
        const today = todayStr();

        const settings = await DailyQuizSettings.findOne({ uid }).populate<{
            papers: { paperId: { _id: Types.ObjectId; name: string; order: number }; questionLimit: number }[];
        }>("papers.paperId", "name order");

        if (!settings || settings.papers.length === 0) {
            return res.json({ date: today, quizzes: [] });
        }

        // Fetch existing daily quizzes for today
        const paperIds = settings.papers.map((p) => p.paperId._id);
        const existingQuizzes = await DailyQuiz.find({
            uid,
            paperId: { $in: paperIds },
            date: today,
        }).lean();

        const quizMap = new Map(
            existingQuizzes.map((q) => [q.paperId.toString(), q])
        );

        const quizzes = settings.papers.map((paperSetting) => {
            const paperId = paperSetting.paperId._id.toString();
            const existing = quizMap.get(paperId);

            const solvedCount = existing
                ? existing.questions.filter((q) => q.solved).length
                : 0;
            const totalCount = existing ? existing.questions.length : paperSetting.questionLimit;

            return {
                paperId,
                paperName: paperSetting.paperId.name,
                questionLimit: paperSetting.questionLimit,
                status: !existing
                    ? "not_started"
                    : existing.completed
                        ? "completed"
                        : "in_progress",
                solvedCount,
                totalCount,
                completed: existing?.completed ?? false,
            };
        });

        res.json({ date: today, quizzes });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /daily-quiz/:paperId/start
// Creates today's quiz for the given paper if it doesn't already exist.
// Idempotent — returns the existing quiz if already generated today.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:paperId/start", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;
        const { paperId } = req.params;
        const today = todayStr();

        // Check if quiz already exists for today
        const existing = await DailyQuiz.findOne({ uid, paperId, date: today }).populate(
            "questions.questionId"
        );

        if (existing) {
            return res.json({ message: "Quiz already generated", quiz: existing, alreadyExists: true });
        }

        // Look up the question limit from settings
        const settings = await DailyQuizSettings.findOne({ uid });
        if (!settings) {
            return res.status(400).json({ message: "No daily quiz settings found. Please configure settings first." });
        }

        const paperSetting = settings.papers.find(
            (p) => p.paperId.toString() === paperId
        );
        if (!paperSetting) {
            return res.status(400).json({ message: "This paper is not in your daily quiz settings." });
        }

        // Select questions using the isolated helper
        const questionIds = await selectQuestions(uid, paperId, paperSetting.questionLimit);

        if (questionIds.length === 0) {
            return res.status(404).json({ message: "No questions found for this paper." });
        }

        // Create and persist the quiz
        const quiz = await DailyQuiz.create({
            uid,
            paperId: new Types.ObjectId(paperId),
            date: today,
            completed: false,
            questions: questionIds.map((qId) => ({
                questionId: qId,
                attempts: 0,
                solved: false,
                solvedAt: null,
            })),
        });

        // Return with populated question data
        const populated = await DailyQuiz.findById(quiz._id).populate("questions.questionId");

        res.status(201).json({ message: "Quiz created", quiz: populated, alreadyExists: false });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /daily-quiz/:paperId/answer
// Submits an answer for one question in today's quiz.
// Body: { questionId: string, answer: 'A' | 'B' | 'C' | 'D' }
// Returns: { correct: boolean, correctAnswer: string, solved: boolean, attempts: number }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:paperId/answer", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;
        const { paperId } = req.params;
        const { questionId, answer } = req.body as {
            questionId: string;
            answer: "A" | "B" | "C" | "D";
        };

        if (!questionId || !answer) {
            return res.status(400).json({ message: "questionId and answer are required" });
        }

        const today = todayStr();

        // Find today's quiz
        const quiz = await DailyQuiz.findOne({ uid, paperId, date: today });
        if (!quiz) {
            return res.status(404).json({ message: "No quiz found for today. Start the quiz first." });
        }

        // Find the question entry in the quiz
        const qEntry = quiz.questions.find(
            (q) => q.questionId.toString() === questionId
        );
        if (!qEntry) {
            return res.status(404).json({ message: "Question not found in today's quiz." });
        }

        // Fetch the correct answer from the Question document
        const questionDoc = await Question.findById(questionId, { correct: 1 }).lean();
        if (!questionDoc) {
            return res.status(404).json({ message: "Question document not found." });
        }

        const isCorrect = answer === questionDoc.correct;

        // Update attempts (always) and solved state (only on correct)
        qEntry.attempts += 1;
        if (isCorrect && !qEntry.solved) {
            qEntry.solved = true;
            qEntry.solvedAt = new Date();
        }

        // Check if the whole quiz is now complete
        const allSolved = quiz.questions.every((q) => q.solved);
        quiz.completed = allSolved;

        await quiz.save();

        res.json({
            correct: isCorrect,
            correctAnswer: questionDoc.correct,
            solved: qEntry.solved,
            attempts: qEntry.attempts,
            quizCompleted: allSolved,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-quiz/:paperId/status
// Returns today's quiz status for a specific paper.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:paperId/status", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.uid!;
        const { paperId } = req.params;
        const today = todayStr();

        const quiz = await DailyQuiz.findOne({ uid, paperId, date: today }).lean();

        if (!quiz) {
            return res.json({
                date: today,
                paperId,
                status: "not_started",
                completed: false,
                solvedCount: 0,
                remainingCount: 0,
                totalCount: 0,
                questions: [],
            });
        }

        const solvedCount = quiz.questions.filter((q) => q.solved).length;
        const totalCount = quiz.questions.length;
        const remainingCount = totalCount - solvedCount;

        res.json({
            date: today,
            paperId,
            status: quiz.completed ? "completed" : solvedCount > 0 ? "in_progress" : "not_started",
            completed: quiz.completed,
            solvedCount,
            remainingCount,
            totalCount,
            questions: quiz.questions.map((q) => ({
                questionId: q.questionId,
                attempts: q.attempts,
                solved: q.solved,
                solvedAt: q.solvedAt,
            })),
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});

export default router;
