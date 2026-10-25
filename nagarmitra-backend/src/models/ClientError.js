import mongoose from 'mongoose';

// Errors reported by the mobile app (kept 30 days)
const ClientErrorSchema = new mongoose.Schema(
  {
    kind: { type: String, maxlength: 50 },
    fatal: { type: Boolean, default: false },
    message: { type: String, maxlength: 1000 },
    stack: { type: String, maxlength: 4000 },
    screen: { type: String, maxlength: 100 },
    appVersion: { type: String, maxlength: 20 },
    platform: { type: String, maxlength: 40 },
    device: { type: String, maxlength: 100 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
  },
  { versionKey: false }
);

export default mongoose.model('ClientError', ClientErrorSchema);
