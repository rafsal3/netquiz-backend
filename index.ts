import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db';
import './config/firebase';

import authRoutes from './routes/auth';
import curriculumRoutes from './routes/curriculum';
import questionRoutes from './routes/questions';
import submissionRoutes from './routes/submissions';
import progressRoutes from './routes/progress';
import adminRoutes from './routes/admin';

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'UGC Net Quiz API running' });
});

app.use('/auth', authRoutes);
app.use('/curriculum', curriculumRoutes);
app.use('/questions', questionRoutes);
app.use('/submissions', submissionRoutes);
app.use('/progress', progressRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

export default app;