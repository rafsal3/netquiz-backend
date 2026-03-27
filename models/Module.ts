import { model, Schema } from "mongoose";

const ModuleSchema = new Schema({
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },

}, { timestamps: true })

export default model('Module', ModuleSchema);