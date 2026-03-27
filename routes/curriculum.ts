import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import { isAdmin } from '../middleware/isAdmin';
import Paper from '../models/Paper';
import Module from '../models/Module';
import SubModule from '../models/SubModule';

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
        const paper = await Paper.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!paper) return res.status(404).json({ message: 'Paper not found' });
        res.json({ paper });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// DELETE /curriculum/papers/:id — admin only
router.delete('/papers/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await Paper.findByIdAndDelete(req.params.id);
        res.json({ message: 'Paper deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── MODULES ──────────────────────────────────────────

// GET /curriculum/modules?paperId=
router.get('/modules', async (req, res: Response) => {
    try {
        const paperId = req.query.paperId as string;
        
        // If paperId is provided but invalid (e.g. "[object Object]"), return empty array
        if (paperId && (!Types.ObjectId.isValid(paperId) || paperId.length !== 24)) {
            return res.json({ modules: [] });
        }

        const filter = paperId ? { paperId } : {};
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
        const module = await Module.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!module) return res.status(404).json({ message: 'Module not found' });
        res.json({ module });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// DELETE /curriculum/modules/:id — admin only
router.delete('/modules/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await Module.findByIdAndDelete(req.params.id);
        res.json({ message: 'Module deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// ─── SUBMODULES ───────────────────────────────────────

// GET /curriculum/submodules?moduleId=
router.get('/submodules', async (req, res: Response) => {
    try {
        const moduleId = req.query.moduleId as string;

        // If moduleId is provided but invalid (e.g. "[object Object]"), return empty array
        if (moduleId && (!Types.ObjectId.isValid(moduleId) || moduleId.length !== 24)) {
            return res.json({ subModules: [] });
        }

        const filter = moduleId ? { moduleId } : {};
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
        const subModule = await SubModule.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!subModule) return res.status(404).json({ message: 'SubModule not found' });
        res.json({ subModule });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// DELETE /curriculum/submodules/:id — admin only
router.delete('/submodules/:id', verifyToken, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await SubModule.findByIdAndDelete(req.params.id);
        res.json({ message: 'SubModule deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;