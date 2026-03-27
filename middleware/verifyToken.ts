import { Request, Response, NextFunction } from "express";
import admin from "../config/firebase";


export interface AuthRequest extends Request {
    uid?: string;
    email?: string;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) return res.status(401).json({ message: "No token" })

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.uid = decoded.uid;
        req.email = decoded.email;
        next();

    } catch {
        res.status(401).json({ message: "Invalid token" })
    }
}