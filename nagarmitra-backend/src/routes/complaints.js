import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';

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

    if (!description || !category) {
      return res.status(400).json({ error: 'description and category are required' });
    }

    const reportId = await Complaint.generateReportId(wardCode);

    const doc = await Complaint.create({
      reportId,
      title,
      description,
      category,
      priority,
      address,
      wardCode,
      location: location?.lat && location?.lng
        ? { type: 'Point', coordinates: [location.lng, location.lat] }
        : undefined,
      media,
      // store auth context
      // you may later map firebase uid to a User model, for now store in metadata fields
      firebaseUid: req.user?.uid,
      firebaseEmail: req.user?.email,
    });

    return res.status(201).json({ complaint: doc, reportId: doc.reportId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    const doc = await Complaint.findOne({ reportId: req.params.reportId });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json({ complaint: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// List with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, ward, status, mine, page = 1, limit = 20, uid } = req.query;
    const q = {};
    if (category) q.category = category;
    if (ward) q.wardCode = ward;
    if (status) q.status = status;
    if (mine === '1' && uid) {
      q.firebaseUid = uid;
    }

    const docs = await Complaint.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Complaint.countDocuments(q);
    return res.json({ items: docs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
  }
});

export default router;
