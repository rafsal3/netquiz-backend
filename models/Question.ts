import { model, Schema, Document, Types } from "mongoose";

export interface IQuestion extends Document {
    paperId: Types.ObjectId;
    moduleId?: Types.ObjectId;
    subModuleId?: Types.ObjectId;
    text: string;
    imageUrl?: string;
    equation?: string;
    options: { A: string; B: string; C: string; D: string };
    correct: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
    source: 'admin' | 'community';
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module' },
    subModuleId: { type: Schema.Types.ObjectId, ref: 'SubModule' },
    text: { type: String, required: true },
    imageUrl: String,
    equation: String,
    options: { A: String, B: String, C: String, D: String },
    correct: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    explanation: String,
    source: { type: String, enum: ['admin', 'community'], default: 'admin' },
    createdBy: String, //firebase uid
}, { timestamps: true })

export default model<IQuestion>('Question', QuestionSchema);