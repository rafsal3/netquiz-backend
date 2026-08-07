import { model, Schema, Document, Types } from "mongoose";

// ─── Sub-document: per-question attempt state ─────────────────────────────────
const DailyQuizQuestionSchema = new Schema(
    {
        questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
        attempts: { type: Number, default: 0 },
        solved: { type: Boolean, default: false },
        solvedAt: { type: Date, default: null },
    },
    { _id: false }
);

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface IDailyQuizQuestion {
    questionId: Types.ObjectId;
    attempts: number;
    solved: boolean;
    solvedAt?: Date | null;
}

export interface IDailyQuiz extends Document {
    uid: string;
    paperId: Types.ObjectId;
    date: string; // 'YYYY-MM-DD'
    completed: boolean;
    questions: IDailyQuizQuestion[];
    createdAt: Date;
    updatedAt: Date;
}

// ─── Main schema ──────────────────────────────────────────────────────────────
const DailyQuizSchema = new Schema<IDailyQuiz>(
    {
        uid: { type: String, required: true },
        paperId: { type: Schema.Types.ObjectId, ref: "Paper", required: true },
        date: { type: String, required: true }, // 'YYYY-MM-DD'
        completed: { type: Boolean, default: false },
        questions: { type: [DailyQuizQuestionSchema], default: [] },
    },
    { timestamps: true }
);

// Enforce one quiz per user per paper per day
DailyQuizSchema.index({ uid: 1, paperId: 1, date: 1 }, { unique: true });

export default model<IDailyQuiz>("DailyQuiz", DailyQuizSchema);
