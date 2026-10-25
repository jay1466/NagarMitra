import { Router } from 'express';
import { sendError, parsePaging, cleanImage } from '../utils/http.js';
import Complaint from '../models/Complaint.js';
import { requireFirebaseAuth, optionalFirebaseAuth } from '../middleware/firebaseAuth.js';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const router = Router();

// Create a complaint (requires Firebase user, email verification not required)
router.post('/', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority = 'Medium',
      address,
      wardCode = 'WARD',
      location, // { lat, lng }
      media = [], // array of S3 keys
    } = req.body || {};

    if (!description || !String(description).trim() || !category) {
      return res.status(400).json({ error: 'Description and category are required' });
    }
    if (String(description).trim().length < 10) {
      return res.status(400).json({ error: 'Please describe the issue in at least 10 characters' });
    }
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    const hasLocation = location != null && isValidCoord(lat, lng);

    const doc = await Complaint.createWithReportId(wardCode, {
      title,
      description: String(description).trim(),
      category,
      priority,
      address,
      wardCode,
      location: hasLocation ? { type: 'Point', coordinates: [lng, lat] } : undefined,
      media: Array.isArray(media) ? media.map(cleanImage).filter(Boolean).slice(0, 3) : [],
      firebaseUid: req.user?.uid,
      firebaseEmail: req.user?.email,
    });

    return res.status(201).json({ complaint: doc, reportId: doc.reportId });
  } catch (err) {
    return sendError(res, err);
  }
});

// Get by database id
router.get('/:id', async (req, res) => {
  try {
    const doc = await Complaint.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json({ complaint: doc });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid id' });
  }
});

// Get by report id
router.get('/report/:reportId', async (req, res) => {
  try {
    const doc = await Complaint.findOne({ reportId: String(req.params.reportId).trim().toUpperCase() });
    if (!doc) return res.status(404).json({ error: 'No report found with this ID' });
    return res.json({ complaint: doc });
  } catch (err) {
    return sendError(res, err);
  }
});

// List with optional filters
router.get('/', optionalFirebaseAuth(), async (req, res) => {
  try {
    const { category, ward, status, mine } = req.query;
    const { page, limit, skip } = parsePaging(req.query);
    const q = {};
    if (category) q.category = String(category);
    if (ward) q.wardCode = String(ward);
    if (status) q.status = String(status);
    if (mine === '1') {
      // "My reports" is based on the verified login, never on a uid from the query string
      if (!req.user?.uid) return res.status(401).json({ error: 'Please log in to see your reports' });
      q.firebaseUid = req.user.uid;
    }

    const [docs, total] = await Promise.all([
      Complaint.find(q).select('-media -internalNotes').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Complaint.countDocuments(q),
    ]);
    return res.json({ items: docs, total, page, limit });
  } catch (err) {
    return sendError(res, err);
  }
});

// Development endpoint to create sample complaints with location data for heatmap testing
router.post('/create-samples', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  try {
    const sampleComplaints = [
      {
        title: 'Pothole on MG Road',
        description: 'Large pothole causing traffic issues on MG Road near CRP Square',
        category: 'Potholes',
        priority: 'High',
        address: 'MG Road, CRP Square, Bhubaneswar',
        location: { type: 'Point', coordinates: [85.8245, 20.2961] }, // [lng, lat]
        status: 'submitted'
      },
      {
        title: 'Street Light Not Working',
        description: 'Street light has been out for 3 days, making area unsafe at night',
        category: 'Electricity & Lighting',
        priority: 'Medium',
        address: 'Saheed Nagar, Bhubaneswar',
        location: { type: 'Point', coordinates: [85.8320, 20.3010] },
        status: 'acknowledged'
      },
      {
        title: 'Garbage Collection Issue',
        description: 'Garbage has not been collected for over a week in our locality',
        category: 'Waste Management',
        priority: 'High',
        address: 'Patia, Bhubaneswar',
        location: { type: 'Point', coordinates: [85.8180, 20.3540] },
        status: 'submitted'
      },
      {
        title: 'Water Supply Problem',
        description: 'No water supply for 2 days in the entire area',
        category: 'Water Supply',
        priority: 'Critical',
        address: 'Jaydev Vihar, Bhubaneswar',
        location: { type: 'Point', coordinates: [85.8400, 20.2700] },
        status: 'in_progress'
      },
      {
        title: 'Broken Drain Cover',
        description: 'Drain cover is broken and poses safety risk to pedestrians',
        category: 'Sanitation',
        priority: 'Medium',
        address: 'Old Town, Bhubaneswar',
        location: { type: 'Point', coordinates: [85.8100, 20.2400] },
        status: 'resolved'
      },
      {
        title: 'Multiple Potholes',
        description: 'Several potholes making road unusable',
        category: 'Potholes',
        priority: 'High',
        address: 'Chandrasekharpur, Bhubaneswar',
        location: { type: 'Point', coordinates: [85.8500, 20.3200] },
        status: 'submitted'
      }
    ];
    
    const results = [];
    for (const complaint of sampleComplaints) {
      const reportId = await Complaint.generateReportId('DEV');
      const doc = await Complaint.create({
        ...complaint,
        reportId,
        wardCode: 'DEV',
        firebaseUid: 'sample-user-001',
        firebaseEmail: 'sample@test.com'
      });
      results.push(doc);
    }
    
    console.log(`🎆 Created ${results.length} sample complaints with location data for heatmap testing`);
    return res.json({ 
      message: `Created ${results.length} sample complaints`, 
      complaints: results.map(c => ({ id: c._id, reportId: c.reportId, location: c.location })) 
    });
  } catch (err) {
    console.error('Error creating sample complaints:', err);
    return sendError(res, err);
  }
});

export default router;
