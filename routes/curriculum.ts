import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import { isAdmin } from '../middleware/isAdmin';
import Paper from '../models/Paper';
import Module from '../models/Module';
import SubModule from '../models/SubModule';
import Question from '../models/Question';


const router = Router();

// ─── PAPERS ───────────────────────────────────────────

// GET /curriculum/papers — public, used by both admin and client
router.get('/papers', async (req, res: Response) => {
    try {
        const papers = await Paper.find().sort({ order: 1 });
        res.json({ papers });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// POST /curriculum/papers — admin only
router.post('/papers', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { name, order } = req.body;
        const paper = await Paper.create({ name, order });
        res.status(201).json({ paper });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// PUT /curriculum/papers/:id — admin only
router.put('/papers/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { name, order } = req.body;
        const updateFields: Record<string, any> = {};
        if (name !== undefined) updateFields.name = name;
        if (order !== undefined) updateFields.order = order;

        const paper = await Paper.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );
        if (!paper) return res.status(404).json({ message: 'Paper not found' });
        res.json({ paper });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// DELETE /curriculum/papers/:id — admin only
// Query: questionsAction = 'delete' | 'uncategorize'
router.delete('/papers/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { questionsAction } = req.query;

        if (!questionsAction || !['delete', 'uncategorize'].includes(questionsAction as string)) {
            return res.status(400).json({ message: 'questionsAction is required (delete or uncategorize)' });
        }

        // 1. Handle Questions
        if (questionsAction === 'delete') {
            await Question.deleteMany({ paperId: id });
        } else if (questionsAction === 'uncategorize') {
            // Unlink from paper, module, submodule
            await Question.updateMany(
                { paperId: id }, 
                { $unset: { paperId: 1, moduleId: 1, subModuleId: 1 } }
            );
        }

        // 2. Cascade delete curriculum elements
        await Module.deleteMany({ paperId: id });
        await SubModule.deleteMany({ paperId: id });

        // 3. Delete Paper
        const paper = await Paper.findByIdAndDelete(id);
        if (!paper) return res.status(404).json({ message: 'Paper not found' });

        res.json({ message: 'Paper and associated curriculum deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── MODULES ──────────────────────────────────────────

// GET /curriculum/modules?paperId=
router.get('/modules', async (req, res: Response) => {
    try {
        const paperId = req.query.paperId as any;

        const parseIds = (idParam: any): string[] => {
            if (!idParam) return [];
            let ids: string[] = [];
            if (Array.isArray(idParam)) {
                ids = idParam as string[];
            } else if (typeof idParam === 'string') {
                ids = idParam.split(',');
            }
            return ids
                .map(id => id.trim())
                .filter(id => id.length === 24 && Types.ObjectId.isValid(id));
        };

        const paperIds = parseIds(paperId);
        
        // If paperId is provided but no valid IDs found, return empty array
        if (paperId && paperIds.length === 0) {
            return res.json({ modules: [] });
        }

        const filter = paperIds.length > 0 ? { paperId: { $in: paperIds } } : {};
        const modules = await Module.find(filter).sort({ order: 1 });
        res.json({ modules });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// POST /curriculum/modules — admin only
router.post('/modules', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { paperId, name, order } = req.body;
        const module = await Module.create({ paperId, name, order });
        res.status(201).json({ module });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// PUT /curriculum/modules/:id — admin only
router.put('/modules/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { name, order, paperId } = req.body;
        const updateFields: Record<string, any> = {};
        if (name !== undefined) updateFields.name = name;
        if (order !== undefined) updateFields.order = order;
        if (paperId !== undefined) updateFields.paperId = paperId;

        const module = await Module.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );
        if (!module) return res.status(404).json({ message: 'Module not found' });
        res.json({ module });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// DELETE /curriculum/modules/:id — admin only
// Query: questionsAction = 'delete' | 'uncategorize'
router.delete('/modules/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { questionsAction } = req.query;

        if (!questionsAction || !['delete', 'uncategorize'].includes(questionsAction as string)) {
            return res.status(400).json({ message: 'questionsAction is required (delete or uncategorize)' });
        }

        // 1. Handle Questions
        if (questionsAction === 'delete') {
            await Question.deleteMany({ moduleId: id });
        } else if (questionsAction === 'uncategorize') {
            // Unlink from module and submodule
            await Question.updateMany(
                { moduleId: id }, 
                { $unset: { moduleId: 1, subModuleId: 1 } }
            );
        }

        // 2. Cascade delete curriculum elements
        await SubModule.deleteMany({ moduleId: id });

        // 3. Delete Module
        const module = await Module.findByIdAndDelete(id);
        if (!module) return res.status(404).json({ message: 'Module not found' });

        res.json({ message: 'Module and associated submodules deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── SUBMODULES ───────────────────────────────────────

// GET /curriculum/submodules?moduleId=
router.get('/submodules', async (req, res: Response) => {
    try {
        const moduleId = req.query.moduleId as any;

        const parseIds = (idParam: any): string[] => {
            if (!idParam) return [];
            let ids: string[] = [];
            if (Array.isArray(idParam)) {
                ids = idParam as string[];
            } else if (typeof idParam === 'string') {
                ids = idParam.split(',');
            }
            return ids
                .map(id => id.trim())
                .filter(id => id.length === 24 && Types.ObjectId.isValid(id));
        };

        const moduleIds = parseIds(moduleId);

        // If moduleId is provided but no valid IDs found, return empty array
        if (moduleId && moduleIds.length === 0) {
            return res.json({ subModules: [] });
        }

        const filter = moduleIds.length > 0 ? { moduleId: { $in: moduleIds } } : {};
        const subModules = await SubModule.find(filter).sort({ order: 1 });
        res.json({ subModules });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// POST /curriculum/submodules — admin only
router.post('/submodules', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { moduleId, paperId, name, order } = req.body;
        const subModule = await SubModule.create({ moduleId, paperId, name, order });
        res.status(201).json({ subModule });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// PUT /curriculum/submodules/:id — admin only
router.put('/submodules/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { name, order, moduleId, paperId } = req.body;
        const updateFields: Record<string, any> = {};
        if (name !== undefined) updateFields.name = name;
        if (order !== undefined) updateFields.order = order;
        if (moduleId !== undefined) updateFields.moduleId = moduleId;
        if (paperId !== undefined) updateFields.paperId = paperId;

        const subModule = await SubModule.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );
        if (!subModule) return res.status(404).json({ message: 'SubModule not found' });
        res.json({ subModule });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// DELETE /curriculum/submodules/:id — admin only
// Query: questionsAction = 'delete' | 'uncategorize'
router.delete('/submodules/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { questionsAction } = req.query;

        if (!questionsAction || !['delete', 'uncategorize'].includes(questionsAction as string)) {
            return res.status(400).json({ message: 'questionsAction is required (delete or uncategorize)' });
        }

        // 1. Handle Questions
        if (questionsAction === 'delete') {
            await Question.deleteMany({ subModuleId: id });
        } else if (questionsAction === 'uncategorize') {
            // Unlink from submodule only
            await Question.updateMany(
                { subModuleId: id }, 
                { $unset: { subModuleId: 1 } }
            );
        }

        // 2. Delete SubModule
        const subModule = await SubModule.findByIdAndDelete(id);
        if (!subModule) return res.status(404).json({ message: 'SubModule not found' });

        res.json({ message: 'SubModule deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;