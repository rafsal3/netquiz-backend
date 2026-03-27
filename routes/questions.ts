import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import { isAdmin } from '../middleware/isAdmin';
import Question from '../models/Question';
import Module from '../models/Module';
import SubModule from '../models/SubModule';
import Paper from '../models/Paper';

const router = Router();

// ─── GET /questions ───────────────────────────────────
// Filters: paperId, moduleId, subModuleId, source (admin/community), uncategorized
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { paperId, moduleId, subModuleId, source, uncategorized } = req.query as any;

        const isValidId = (id: any) => id && typeof id === 'string' && id.length === 24 && Types.ObjectId.isValid(id);

        // If any ID filter is provided but invalid, return empty results early
        if (paperId && !isValidId(paperId)) return res.json({ questions: [] });
        if (moduleId && !isValidId(moduleId)) return res.json({ questions: [] });
        if (subModuleId && !isValidId(subModuleId)) return res.json({ questions: [] });

        const filter: Record<string, any> = {};

        if (paperId) filter.paperId = paperId;
        if (moduleId) filter.moduleId = moduleId;
        if (subModuleId) filter.subModuleId = subModuleId;
        if (source) filter.source = source;

        // uncategorized = questions with no moduleId
        if (uncategorized === 'true') {
            filter.moduleId = { $exists: false };
        }

        const questions = await Question.find(filter)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name')
            .sort({ createdAt: -1 });

        res.json({ questions });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /questions/:id ───────────────────────────────
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const question = await Question.findById(req.params.id)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name');

        if (!question) return res.status(404).json({ message: 'Question not found' });
        res.json({ question });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── POST /questions — admin only ─────────────────────
router.post('/', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        let {
            paperId, moduleId, subModuleId,
            text, imageUrl, equation,
            options, correct, explanation,
        } = req.body;

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

        if (!paperId || !isValidId(paperId)) {
            return res.status(400).json({ message: 'Valid paperId is required' });
        }
        if (!text) {
            return res.status(400).json({ message: 'Question text is required' });
        }
        if (!options) {
            return res.status(400).json({ message: 'Options are required' });
        }
        if (!correct) {
            return res.status(400).json({ message: 'Correct answer index or label is required' });
        }

        const question = await Question.create({
            paperId: paperId,
            moduleId: isValidId(moduleId) ? moduleId : undefined,
            subModuleId: isValidId(subModuleId) ? subModuleId : undefined,
            text,
            imageUrl: imageUrl || undefined,
            equation: equation || undefined,
            options,
            correct,
            explanation: explanation || undefined,
            source: 'admin',
            createdBy: req.uid,
        });

        res.status(201).json({ question });
    } catch (err: any) {
        console.error('Error creating question:', err);
        res.status(500).json({ 
            message: 'Server error', 
            error: err.message || err,
            details: err.errors // Include Mongoose validation details if available
        });
    }
});

// ─── PUT /questions/:id — admin only ──────────────────
router.put('/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const question = await Question.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!question) return res.status(404).json({ message: 'Question not found' });
        res.json({ question });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── DELETE /questions/:id — admin only ───────────────
router.delete('/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await Question.findByIdAndDelete(req.params.id);
        res.json({ message: 'Question deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── GET /questions/download/:paperId ─────────────────
// Returns full nested paper JSON for offline storage in Flutter
router.get('/download/:paperId', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { paperId } = req.params;

        // Get paper info
        const paper = await Paper.findById(paperId);
        if (!paper) return res.status(404).json({ message: 'Paper not found' });

        // Get all modules for this paper
        const modules = await Module.find({ paperId }).sort({ order: 1 });

        // Get all submodules for this paper
        const subModules = await SubModule.find({ paperId }).sort({ order: 1 });

        // Get all questions for this paper
        const questions = await Question.find({ paperId }).lean();

        // Build nested structure
        const result = {
            paper,
            modules: modules.map((mod) => {
                const modSubModules = subModules
                    .filter((sub) => sub.moduleId.toString() === mod._id.toString())
                    .map((sub) => ({
                        ...sub.toObject(),
                        questions: questions.filter(
                            (q) =>
                                q.subModuleId &&
                                q.subModuleId.toString() === sub._id.toString()
                        ),
                    }));

                return {
                    ...mod.toObject(),
                    subModules: modSubModules,
                    // Questions under module but no submodule
                    questions: questions.filter(
                        (q) =>
                            q.moduleId &&
                            q.moduleId.toString() === mod._id.toString() &&
                            !q.subModuleId
                    ),
                };
            }),
            // Questions with no module at all
            uncategorized: questions.filter((q) => !q.moduleId),
        };

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;