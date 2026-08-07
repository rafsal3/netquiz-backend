import { Router, Response, Request } from 'express';
import { verifyToken, AuthRequest } from '../middleware/verifyToken';
import User from '../models/User';
import admin from '../config/firebase';

const router = Router();

// POST /auth/register — register a user using email/password
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // 1. Create user in Firebase
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName ?? '',
        });

        // 2. Create user in MongoDB
        const adminUids = process.env.ADMIN_UIDS?.split(',') ?? [];
        const role = userRecord.uid && adminUids.includes(userRecord.uid) ? 'admin' : 'user';

        const user = await User.create({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName ?? '',
            photoURL: userRecord.photoURL ?? '',
            role: role,
        });

        // 3. Authenticate user to get tokens if FIREBASE_API_KEY is available
        let idToken: string | undefined;
        let refreshToken: string | undefined;
        let expiresIn: string | undefined;

        const apiKey = process.env.FIREBASE_API_KEY;
        if (apiKey) {
            try {
                const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
                    method: 'POST',
                    body: JSON.stringify({ email, password, returnSecureToken: true }),
                    headers: { 'Content-Type': 'application/json' },
                });
                const data: any = await response.json();
                if (response.ok) {
                    idToken = data.idToken;
                    refreshToken = data.refreshToken;
                    expiresIn = data.expiresIn;
                }
            } catch (tokenErr) {
                console.warn('Post-registration token fetch warning:', tokenErr);
            }
        }

        res.status(201).json({ 
            message: 'User registered successfully', 
            uid: userRecord.uid,
            user,
            ...(idToken && { idToken }),
            ...(refreshToken && { refreshToken }),
            ...(expiresIn && { expiresIn }),
        });
    } catch (err: any) {
        console.error('Registration Error:', err);
        res.status(400).json({ message: 'Registration failed', error: err.message });
    }
});

// POST /auth/login — login with email/password to get an ID Token
// Note: Requires FIREBASE_API_KEY in .env
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const apiKey = process.env.FIREBASE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ message: 'Server configuration error: FIREBASE_API_KEY is missing' });
        }

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Call Firebase REST API to authenticate
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: 'POST',
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            headers: { 'Content-Type': 'application/json' },
        });

        const data: any = await response.json();

        if (!response.ok) {
            return res.status(401).json({ message: 'Login failed', error: data.error?.message });
        }

        // Fetch user from DB to return with the token
        const user = await User.findOne({ uid: data.localId });

        res.json({
            idToken: data.idToken,
            refreshToken: data.refreshToken,
            expiresIn: data.expiresIn,
            user: user
        });
    } catch (err: any) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Login failed', error: err.message });
    }
});

// POST /auth/login/google-sync or /auth/sync — existing sync for Google OAuth
// Creates user in DB if first time, updates if existing, and returns user data
const syncUser = async (req: AuthRequest, res: Response) => {
    try {
        const { uid, email } = req;
        const { displayName, photoURL } = req.body;

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
                photoURL: photoURL ?? '',
                role: role,
            });
            console.log(`New user created: ${uid}`);
        } else {
            // Update existing user info
            user.email = email || user.email;
            if (displayName) user.displayName = displayName;
            if (photoURL) user.photoURL = photoURL;
            
            // Only update role if it's currently 'user' but they are in the admin list
            if (user.role === 'user' && role === 'admin') {
                user.role = 'admin';
            }
            
            await user.save();
        }

        res.json({ 
            user,
            refreshToken: req.body.refreshToken || null 
        });
    } catch (err) {
        console.error('Auth Sync Error:', err);
        res.status(500).json({ message: 'Server error', error: err });
    }
};

// POST /auth/refresh — refresh an expired ID token using a refresh token
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;
        const apiKey = process.env.FIREBASE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ message: 'Server configuration error: FIREBASE_API_KEY is missing' });
        }

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token is required' });
        }

        // Call Firebase Secure Token service to refresh the token
        const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        const data: any = await response.json();

        if (!response.ok) {
            return res.status(401).json({ message: 'Token refresh failed', error: data.error?.message });
        }

        res.json({
            idToken: data.id_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
        });
    } catch (err: any) {
        console.error('Refresh Error:', err);
        res.status(500).json({ message: 'Refresh failed', error: err.message });
    }
});

router.post('/sync', verifyToken, syncUser);

// PATCH /auth/profile — update user profile (name, photoURL, password)
router.patch('/profile', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { displayName, photoURL, password } = req.body;
        const uid = req.uid;

        if (!uid) return res.status(401).json({ message: 'No UID found in token' });

        // 1. Update in Firebase
        const updateData: any = {};
        if (displayName) updateData.displayName = displayName;
        if (photoURL) updateData.photoURL = photoURL;
        if (password) updateData.password = password;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No fields provided for update' });
        }

        await admin.auth().updateUser(uid, updateData);

        // 2. Update in MongoDB
        const user = await User.findOneAndUpdate(
            { uid },
            { 
                $set: { 
                    ...(displayName && { displayName }), 
                    ...(photoURL && { photoURL }) 
                } 
            },
            { new: true }
        );

        res.json({ 
            message: 'Profile updated successfully', 
            user 
        });
    } catch (err: any) {
        console.error('Profile Update Error:', err);
        res.status(500).json({ message: 'Profile update failed', error: err.message });
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