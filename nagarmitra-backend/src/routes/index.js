import { Router } from 'express';
import healthRouter from './health.js';
import complaintsRouter from './complaints.js';
import mediaRouter from './media.js';
import communityRouter from './community.js';
import usersRouter from './users.js';
import analyticsRouter from './analytics.js';
import { requireUser, requireRole } from '../middleware/firebaseAuth.js';
import detectRouter from './detect.js';
import feedbackRouter from './feedback.js';
import metaRouter from './meta.js';
import adminRouter from './admin.js';
import jobsRouter from './jobs.js';
import clientErrorsRouter from './clientErrors.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/complaints', complaintsRouter);
router.use('/media', mediaRouter);
router.use('/community', communityRouter);
router.use('/users', usersRouter);
// Raw analytics/export (incl. reporter emails) is for the super admin only
router.use('/analytics', requireUser(), requireRole('super_admin'), analyticsRouter);
router.use('/detect', detectRouter);
router.use('/feedback', feedbackRouter);
router.use('/meta', metaRouter);
router.use('/admin', adminRouter);
router.use('/jobs', jobsRouter);
router.use('/client-errors', clientErrorsRouter);

export default router;
