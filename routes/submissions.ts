import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import { isAdmin } from '../middleware/isAdmin';
import Submission from '../models/Submission';
import Question from '../models/Question';

const router = Router();

// ─── POST /submissions ────────────────────────────────
// Any logged in user can submit a community question
router.post('/', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        let {
            paperId, moduleId, subModuleId,
            text, imageUrl, equation,
            options, correct, explanation,
        } = req.body as any;

        // Handle conversion if options is an array
        if (Array.isArray(options)) {
            options = {
                A: options[0] || '',
                B: options[1] || '',
                C: options[2] || '',
                D: options[3] || '',
            };
        }

        // Handle conversion if correct is a number (0-3)
        if (typeof correct === 'number') {
            const mapping = ['A', 'B', 'C', 'D'];
            correct = mapping[correct] || 'A';
        }

        const isValidId = (id: any) => id && typeof id === 'string' && id.length === 24 && Types.ObjectId.isValid(id);

        if (!paperId || !text || !correct || !options) {
            return res.status(400).json({ message: 'paperId, text, options and correct are required' });
        }

        const submission = await Submission.create({
            submittedBy: req.uid,
            paperId: isValidId(paperId) ? paperId : undefined,
            moduleId: isValidId(moduleId) ? moduleId : undefined,
            subModuleId: isValidId(subModuleId) ? subModuleId : undefined,
            text,
            imageUrl: imageUrl || undefined,
            equation: equation || undefined,
            options,
            correct,
            explanation: explanation || undefined,
            status: 'pending',
        });

        res.status(201).json({ submission });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /submissions ─────────────────────────────────
// Filters: status (pending/approved/rejected), paperId
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { status, paperId, page = '1', limit = '20' } = req.query as any;

        const filter: Record<string, any> = {};
        if (status) filter.status = status;
        if (paperId) filter.paperId = paperId;

        // Check if user is admin
        const adminUids = process.env.ADMIN_UIDS?.split(',') ?? [];
        const isUserAdmin = req.uid && adminUids.includes(req.uid);

        // If not admin, only show their own submissions
        if (!isUserAdmin) {
            filter.submittedBy = req.uid;
        }

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = req.query.limit !== undefined ? parseInt(limit as string, 10) : 20;
        const skip = (pageNum - 1) * limitNum;

        const query = Submission.find(filter)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name')
            .populate('user', 'displayName email')
            .populate('reviewer', 'displayName email')
            .sort({ createdAt: -1 });

        if (limitNum > 0) {
            query.skip(skip).limit(limitNum);
        }

        const [submissions, total] = await Promise.all([
            query,
            Submission.countDocuments(filter)
        ]);

        res.json({
            submissions,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /submissions/:id ────────────────────────────
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const submission = await Submission.findById(req.params.id)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name')
            .populate('user', 'displayName email')
            .populate('reviewer', 'displayName email');

        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        // Check if user is admin
        const adminUids = process.env.ADMIN_UIDS?.split(',') ?? [];
        const isUserAdmin = req.uid && adminUids.includes(req.uid);

        // Allow if admin or if the user is the one who submitted it
        if (!isUserAdmin && submission.submittedBy !== req.uid) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view this submission' });
        }

        res.json({ submission });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── PUT /submissions/:id — admin edit before approving ─
router.put('/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const submission = await Submission.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!submission) return res.status(404).json({ message: 'Submission not found' });
        res.json({ submission });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── PUT /submissions/:id/approve — admin only ────────
// Approves submission and copies it into the questions collection
router.put('/:id/approve', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        if (submission.status === 'approved') {
            return res.status(400).json({ message: 'Already approved' });
        }

        // Copy into questions collection as community question
        const question = await Question.create({
            paperId: submission.paperId,
            moduleId: submission.moduleId,
            subModuleId: submission.subModuleId,
            text: submission.text,
            imageUrl: submission.imageUrl,
            equation: submission.equation,
            options: submission.options,
            correct: submission.correct,
            explanation: submission.explanation,
            source: 'community',
            createdBy: submission.submittedBy,
        } as any);

        // Mark submission as approved
        submission.status = 'approved';
        submission.reviewedBy = req.uid;
        await submission.save();

        res.json({ message: 'Submission approved', question });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── PUT /submissions/:id/reject — admin only ─────────
router.put('/:id/reject', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        if (submission.status === 'rejected') {
            return res.status(400).json({ message: 'Already rejected' });
        }

        submission.status = 'rejected';
        submission.reviewedBy = req.uid;
        await submission.save();

        res.json({ message: 'Submission rejected', submission });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── DELETE /submissions/:id — admin only ─────────────
router.delete('/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await Submission.findByIdAndDelete(req.params.id);
        res.json({ message: 'Submission deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;