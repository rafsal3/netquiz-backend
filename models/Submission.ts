import { model, Schema, Document, Types } from "mongoose";

export interface ISubmission extends Document {
    submittedBy: string;
    paperId: Types.ObjectId;
    moduleId?: Types.ObjectId;
    subModuleId?: Types.ObjectId;
    text: string;
    imageUrl?: string;
    equation?: string;
    options: { A: string; B: string; C: string; D: string };
    questionOptions?: string;
    correct: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>({
    submittedBy: { type: String, required: true }, // firebase uid
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper' },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module' },
    subModuleId: { type: Schema.Types.ObjectId, ref: 'SubModule' },
    text: String,
    imageUrl: String,
    equation: String,
    options: { A: String, B: String, C: String, D: String },
    questionOptions: { type: String, default: '' },
    correct: { type: String, enum: ['A', 'B', 'C', 'D'] },
    explanation: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: String,
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Link to User model via the 'uid' field
SubmissionSchema.virtual('user', {
    ref: 'User',
    localField: 'submittedBy',
    foreignField: 'uid',
    justOne: true
});

// Link to reviewer user info
SubmissionSchema.virtual('reviewer', {
    ref: 'User',
    localField: 'reviewedBy',
    foreignField: 'uid',
    justOne: true
});

export default model<ISubmission>('Submission', SubmissionSchema);