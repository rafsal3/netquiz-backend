import { model, Schema } from "mongoose";

const QuestionProgressSchema = new Schema({
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    status: { type: String, enum: ['unseen', 'got_it', 'review'], default: 'unseen' },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    lastSeen: Date,
    avgTime: Number, //ms

}, { _id: false })

const ProgressSchema = new Schema({
    uid: { type: String, required: true, unique: true },
    questions: [QuestionProgressSchema],
    streak: { type: Number, default: 0 },
    activeDates: { type: [String], default: [] }, // Array of 'YYYY-MM-DD'
    lastActiveDate: Date,
    totalPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    lastDailyQuizDate: { type: String, default: "" }, // 'YYYY-MM-DD' format
    lastSyncedAt: Date,
}, { timestamps: true });

export default model('Progress', ProgressSchema);