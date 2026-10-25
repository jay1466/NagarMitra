import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import ClientError from '../models/ClientError.js';
import { requireUser, requireRole } from '../middleware/firebaseAuth.js';
import { sendError } from '../utils/http.js';

const router = Router();

// Anonymous on purpose: the app may crash before anyone has logged in
router.post('/', rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
  try {
    const b = req.body || {};
    const clip = (v, n) => (v == null ? undefined : String(v).slice(0, n));
    await ClientError.create({
      kind: clip(b.kind, 50),
      fatal: !!b.fatal,
      message: clip(b.message, 1000),
      stack: clip(b.stack, 4000),
      screen: clip(b.screen, 100),
      appVersion: clip(b.appVersion, 20),
      platform: clip(b.platform, 40),
      device: clip(b.device, 100),
    });
    return res.status(204).end();
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/', requireUser(), requireRole('super_admin'), async (_req, res) => {
  try {
    const errors = await ClientError.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ errors });
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;
