import { Router } from 'express';
import {
  DEPARTMENTS,
  CATEGORY_TO_DEPARTMENT,
  SLA_HOURS,
  PRIORITY_FACTOR,
  REOPEN_WINDOW_DAYS,
  CITIZEN_NUDGE_INTERVAL_HOURS,
  ESCALATION_LADDER,
  ROLE_LABELS,
} from '../config/civic.js';

const router = Router();

// States/districts are bundled in the app (src/data/india.json), so they are not repeated here.
router.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    departments: DEPARTMENTS,
    categoryToDepartment: CATEGORY_TO_DEPARTMENT,
    sla: SLA_HOURS,
    priorityFactor: PRIORITY_FACTOR,
    escalationLadder: ESCALATION_LADDER,
    roleLabels: ROLE_LABELS,
    reopenWindowDays: REOPEN_WINDOW_DAYS,
    nudgeIntervalHours: CITIZEN_NUDGE_INTERVAL_HOURS,
  });
});

export default router;
