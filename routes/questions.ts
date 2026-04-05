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
        const { paperId, moduleId, subModuleId, source, uncategorized, page = '1', limit = '20' } = req.query as any;

        const parseIds = (idParam: any): string[] => {
            if (!idParam) return [];
            let ids: string[] = [];
            if (Array.isArray(idParam)) {
                ids = idParam;
            } else if (typeof idParam === 'string') {
                ids = idParam.split(',');
            }
            return ids
                .map(id => id.trim())
                .filter(id => id.length === 24 && Types.ObjectId.isValid(id));
        };

        const paperIds = parseIds(paperId);
        const moduleIds = parseIds(moduleId);
        const subModuleIds = parseIds(subModuleId);

        // If a filter was intended but no valid IDs found, return empty (consistent with previous behavior)
        if (paperId && paperIds.length === 0) return res.json({ questions: [] });
        if (moduleId && moduleIds.length === 0) return res.json({ questions: [] });
        if (subModuleId && subModuleIds.length === 0) return res.json({ questions: [] });

        const filter: Record<string, any> = {};

        if (paperIds.length > 0) filter.paperId = { $in: paperIds };
        if (moduleIds.length > 0) filter.moduleId = { $in: moduleIds };
        if (subModuleIds.length > 0) filter.subModuleId = { $in: subModuleIds };
        
        if (source) filter.source = source;

        // uncategorized = questions with no moduleId
        if (uncategorized === 'true') {
            filter.moduleId = { $exists: false };
        }

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = req.query.limit !== undefined ? parseInt(limit as string, 10) : 20;
        const skip = (pageNum - 1) * limitNum;

        const query = Question.find(filter)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name')
            .populate('user', 'displayName email role')
            .sort({ createdAt: -1 });
            
        if (limitNum > 0) {
            query.skip(skip).limit(limitNum);
        }

        const [questions, total] = await Promise.all([
            query,
            Question.countDocuments(filter)
        ]);

        res.json({ 
            questions,
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

// ─── GET /questions/search ───────────────────────────
// Search questions by text
router.get('/search', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { q, page = '1', limit = '50' } = req.query as any;
        if (!q || typeof q !== 'string') {
            return res.json({ questions: [] });
        }

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = req.query.limit !== undefined ? parseInt(limit as string, 10) : 50;
        const skip = (pageNum - 1) * limitNum;
        
        const filter = { text: { $regex: q, $options: 'i' } };

        const query = Question.find(filter)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name')
            .populate('user', 'displayName email role');
            
        if (limitNum > 0) {
            query.skip(skip).limit(limitNum);
        }

        const [questions, total] = await Promise.all([
            query,
            Question.countDocuments(filter)
        ]);

        res.json({ 
            questions,
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

// ─── GET /questions/:id ───────────────────────────────
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid question ID' });
        }
        const question = await Question.findById(id)
            .populate('paperId', 'name')
            .populate('moduleId', 'name')
            .populate('subModuleId', 'name')
            .populate('user', 'displayName email role');

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
            options, questionOptions, correct, explanation,
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

        // Handle conversion if questionOptions is an array (join with newlines)
        if (Array.isArray(questionOptions)) {
            questionOptions = questionOptions.join('\n');
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
            questionOptions: questionOptions || undefined,
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

// ─── POST /questions/bulk — admin only ────────────────
router.post('/bulk', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { questions } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'A non-empty array of questions is required' });
        }

        const isValidId = (id: any) => id && typeof id === 'string' && id.length === 24 && Types.ObjectId.isValid(id);

        const preparedQuestions = questions.map((q: any) => {
            let options = q.options;
            let questionOptions = q.questionOptions;
            let correct = q.correct;
            
            // Handle conversion if options is an array
            if (Array.isArray(options)) {
                options = {
                    A: options[0] || '',
                    B: options[1] || '',
                    C: options[2] || '',
                    D: options[3] || '',
                };
            }

            // Handle conversion if questionOptions is an array
            if (Array.isArray(questionOptions)) {
                questionOptions = questionOptions.join('\n');
            }

            // Handle conversion if correct is a number (0-3)
            if (typeof correct === 'number') {
                const mapping = ['A', 'B', 'C', 'D'];
                correct = mapping[correct] || 'A';
            }

            // For strict validation of required fields:
            if (!q.paperId || !isValidId(q.paperId)) {
                throw new Error(`Valid paperId is required for question: "${q.text || 'Unknown'}"`);
            }
            if (!q.text) {
                throw new Error('Question text is required for all questions');
            }
            if (!options) {
                throw new Error(`Options are required for question: "${q.text}"`);
            }
            if (!correct) {
                throw new Error(`Correct answer is required for question: "${q.text}"`);
            }

            return {
                paperId: q.paperId,
                moduleId: isValidId(q.moduleId) ? q.moduleId : undefined,
                subModuleId: isValidId(q.subModuleId) ? q.subModuleId : undefined,
                text: q.text,
                imageUrl: q.imageUrl || undefined,
                equation: q.equation || undefined,
                options,
                questionOptions: questionOptions || undefined,
                correct,
                explanation: q.explanation || undefined,
                source: 'admin',
                createdBy: req.uid,
            };
        });

        // Insert all prepared questions
        const results = await Question.insertMany(preparedQuestions);

        res.status(201).json({ 
            message: 'Bulk questions added successfully',
            count: results.length,
            questions: results 
        });
    } catch (err: any) {
        console.error('Error in bulk upload:', err);
        res.status(400).json({
            message: 'Bulk upload failed',
            error: err.message || err,
            details: err.errors
        });
    }
});

// ─── PUT /questions/:id — admin only ──────────────────
router.put('/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const updateData = { ...req.body };
        
        // Handle conversion if options is an array
        if (Array.isArray(updateData.options)) {
            updateData.options = {
                A: updateData.options[0] || '',
                B: updateData.options[1] || '',
                C: updateData.options[2] || '',
                D: updateData.options[3] || '',
            };
        }

        // Handle conversion if questionOptions is an array
        if (Array.isArray(updateData.questionOptions)) {
            updateData.questionOptions = updateData.questionOptions.join('\n');
        }

        // Handle conversion if correct is a number (0-3)
        if (typeof updateData.correct === 'number') {
            const mapping = ['A', 'B', 'C', 'D'];
            updateData.correct = mapping[updateData.correct] || 'A';
        }

        const question = await Question.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
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