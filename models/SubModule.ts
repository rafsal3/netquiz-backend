import { model, Schema } from "mongoose";

const SubModuleSchema = new Schema({
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },

}, { timestamps: true })

export default model('SubModule', SubModuleSchema);