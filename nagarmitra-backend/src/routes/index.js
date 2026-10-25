import { Router } from 'express';
import healthRouter from './health.js';
import complaintsRouter from './complaints.js';
import mediaRouter from './media.js';
import communityRouter from './community.js';
import usersRouter from './users.js';
import analyticsRouter from './analytics.js';
import detectRouter from './detect.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/complaints', complaintsRouter);
router.use('/media', mediaRouter);
router.use('/community', communityRouter);
router.use('/users', usersRouter);
router.use('/analytics', analyticsRouter);
router.use('/detect', detectRouter);

export default router;
