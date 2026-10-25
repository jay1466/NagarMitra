import { Router } from 'express';
import Feedback from '../models/Feedback.js';
import { optionalFirebaseAuth } from '../middleware/firebaseAuth.js';
import { sendError } from '../utils/http.js';

const router = Router();

router.post('/', optionalFirebaseAuth(), async (req, res) => {
  try {
    const { type, rating, title, message, contactEmail, appVersion } = req.body || {};
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    const doc = await Feedback.create({
      type,
      rating: Number(rating) || 0,
      title: title.trim(),
      message: message.trim(),
      contactEmail: contactEmail?.trim() || req.user?.email,
      firebaseUid: req.user?.uid,
      appVersion,
    });
    return res.status(201).json({ id: doc._id });
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;
