import { NextFunction, Response } from "express";
import { AuthRequest } from "./verifyToken";


export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const adminUids = process.env.ADMIN_UIDS?.split(',') ?? [];
    if (!req.uid || !adminUids.includes(req.uid)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
}