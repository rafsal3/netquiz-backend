import { model, Schema, Document, Types } from "mongoose";

// ─── Sub-document: per-paper configuration ────────────────────────────────────
const PaperSettingSchema = new Schema(
    {
        paperId: { type: Schema.Types.ObjectId, ref: "Paper", required: true },
        questionLimit: { type: Number, required: true, default: 25 },
    },
    { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────
export interface IPaperSetting {
    paperId: Types.ObjectId;
    questionLimit: number;
}

export interface IDailyQuizSettings extends Document {
    uid: string;
    papers: IPaperSetting[];
}

const DailyQuizSettingsSchema = new Schema<IDailyQuizSettings>(
    {
        uid: { type: String, required: true, unique: true },
        papers: { type: [PaperSettingSchema], default: [] },
    },
    { timestamps: true }
);

export default model<IDailyQuizSettings>("DailyQuizSettings", DailyQuizSettingsSchema);
