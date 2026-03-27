import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import User from '../models/User';

const router = Router();

// POST /auth/login or /auth/sync — called when user opens app / logs in
// Creates user in DB if first time, updates if existing, and returns user data
const syncUser = async (req: AuthRequest, res: Response) => {
    try {
        const { uid, email } = req;
        const { displayName } = req.body;

        if (!uid) return res.status(401).json({ message: 'No UID found in token' });

        let user = await User.findOne({ uid });

        const adminUids = process.env.ADMIN_UIDS?.split(',') ?? [];
        const role = uid && adminUids.includes(uid) ? 'admin' : 'user';

        if (!user) {
            // First login — create user
            user = await User.create({
                uid,
                email,
                displayName: displayName ?? '',
                role: role,
            });
            console.log(`New user created: ${uid}`);
        } else {
            // Update existing user info
            user.email = email || user.email;
            if (displayName) user.displayName = displayName;
            
            // Only update role if it's currently 'user' but they are in the admin list
            if (user.role === 'user' && role === 'admin') {
                user.role = 'admin';
            }
            
            await user.save();
        }

        res.json({ user });
    } catch (err) {
        console.error('Auth Sync Error:', err);
        res.status(500).json({ message: 'Server error', error: err });
    }
};

router.post('/login', verifyToken, syncUser);
router.post('/sync', verifyToken, syncUser);

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