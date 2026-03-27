import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import User from '../models/User';

const router = Router();

// POST /auth/login — called when user opens app / logs in
// Creates user in DB if first time, returns user data
router.post('/login', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { uid, email } = req;

        let user = await User.findOne({ uid });

        if (!user) {
            // First login — create user
            user = await User.create({
                uid,
                email,
                displayName: req.body.displayName ?? '',
                role: 'user',
            });
        }

        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// GET /auth/me — returns current logged in user info
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findOne({ uid: req.uid });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err });
    }
});

export default router;