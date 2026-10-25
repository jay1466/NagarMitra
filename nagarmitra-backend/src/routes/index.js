import { Router } from 'express';
import healthRouter from './health.js';
import complaintsRouter from './complaints.js';
import mediaRouter from './media.js';
import communityRouter from './community.js';
import usersRouter from './users.js';
import analyticsRouter from './analytics.js';
import detectRouter from './detect.js';
import feedbackRouter from './feedback.js';
import metaRouter from './meta.js';
import adminRouter from './admin.js';
import jobsRouter from './jobs.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/complaints', complaintsRouter);
router.use('/media', mediaRouter);
router.use('/community', communityRouter);
router.use('/users', usersRouter);
router.use('/analytics', analyticsRouter);
router.use('/detect', detectRouter);
router.use('/feedback', feedbackRouter);
router.use('/meta', metaRouter);
router.use('/admin', adminRouter);
router.use('/jobs', jobsRouter);

export default router;
