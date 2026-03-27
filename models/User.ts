import { model, Schema } from "mongoose";

const UserSchema = new Schema({
    uid: { type: String, required: true, unique: true },
    email: String,
    displayName: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: Date, default: Date.now },
});

export default model('User', UserSchema);
