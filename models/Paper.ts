import { model, Schema } from "mongoose";

const PaperSchema = new Schema({
    name: { type: String, required: true },
    order: { type: Number, default: 0 },

}, { timestamps: true })

export default model('Paper', PaperSchema);