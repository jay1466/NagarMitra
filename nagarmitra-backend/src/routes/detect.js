import { Router } from 'express';
import multer from 'multer';
import { classifyImage, loadModel } from '../utils/classifier.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Preload model optionally
loadModel().catch(console.error);

// POST /api/v1/detect
router.post('/', requireFirebaseAuth({ requireVerified: false }), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const result = await classifyImage(req.file.buffer);
    
    return res.json(result);
  } catch (err) {
    console.error('Detection route error:', err);
    return res.status(500).json({ error: 'Failed to process image' });
  }
});

export default router;
