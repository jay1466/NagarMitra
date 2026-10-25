import { Router } from 'express';
import { slaSweep } from '../services/workflow.js';
import { sendError } from '../utils/http.js';

const router = Router();

// External scheduler hook (e.g. cron-job.org) so reminders still run after the
// free host has been asleep. Protected by the CRON_KEY environment variable.
router.all('/sla-sweep', async (req, res) => {
  const key = process.env.CRON_KEY;
  if (!key || (req.get('x-cron-key') !== key && req.query.key !== key)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    return res.json(await slaSweep());
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;
