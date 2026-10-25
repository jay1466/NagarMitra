import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['general', 'bug', 'feature', 'improvement'], default: 'general' },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 2000 },
    contactEmail: { type: String, maxlength: 200 },
    firebaseUid: { type: String, index: true },
    appVersion: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Feedback', FeedbackSchema);
