import { Router } from "express";
import crypto from "crypto";
import path from "path";
import { createPresignedPutUrl, getBucketName } from "../config/s3.js";
import { requireFirebaseAuth } from "../middleware/firebaseAuth.js";

const router = Router();

// Helper function to check if S3 is configured
function isS3Configured() {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY && !!process.env.S3_BUCKET;
}

// POST /api/v1/media/presign
// body: { contentType: 'image/jpeg', prefix?: 'complaints/', filename?: 'photo.jpg' }
router.post("/presign", requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  console.log("🔍 Media presign request received:", {
    body: req.body,
    user: req.user?.uid,
    headers: Object.keys(req.headers)
  });
  
  try {
    let { contentType, prefix = "uploads/", filename } = req.body || {};

    if (!contentType) {
      return res.status(400).json({ error: "contentType is required" });
    }

    // Check if S3 is configured
    if (!isS3Configured()) {
      console.log("⚠️  S3 not configured, using mock upload for development");
      
      // Generate unique key for mock storage
      const uniqueId = crypto.randomBytes(6).toString("hex");
      let ext = "";
      if (filename) {
        ext = path.extname(filename);
      }
      if (!ext) {
        ext = "." + (contentType.split("/")[1] || "bin");
      }
      
      // Ensure prefix always ends with /
      if (!prefix.endsWith("/")) {
        prefix = prefix + "/";
      }
      
      const key = `${prefix}${Date.now()}-${uniqueId}${ext}`;
      
      // Return mock response for development
      // Use the host from the request instead of localhost for mobile apps
      const host = req.get('host') || `localhost:${process.env.PORT || 4000}`;
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
      
      return res.json({
        bucket: "nagarmitra-dev-mock",
        key,
        uploadUrl: `${protocol}://${host}/api/v1/media/mock-upload`, // Mock upload endpoint
        contentType,
        mock: true // Flag to indicate this is a mock response
      });
    }

    // Ensure prefix always ends with /
    if (!prefix.endsWith("/")) {
      prefix = prefix + "/";
    }

    // Try to get extension from filename, else from contentType
    let ext = "";
    if (filename) {
      ext = path.extname(filename);
    }
    if (!ext) {
      ext = "." + (contentType.split("/")[1] || "bin");
    }

    // Generate unique key
    const uniqueId = crypto.randomBytes(6).toString("hex");
    const key = `${prefix}${Date.now()}-${uniqueId}${ext}`;

    // Get presigned URL from S3
    const uploadUrl = await createPresignedPutUrl({ key, contentType });

    return res.json({
      bucket: getBucketName(),
      key,
      uploadUrl,
      contentType,
    });
  } catch (err) {
    console.error("❌ Error generating presigned URL:", err);
    return res.status(500).json({ error: "Failed to generate presigned URL" });
  }
});

// Mock upload endpoint for development when S3 is not configured
router.put("/mock-upload", async (req, res) => {
  try {
    console.log("✅ Mock upload request received:", {
      method: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      origin: req.headers.origin
    });
    
    // Set CORS headers for the upload
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'PUT, POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Simulate successful upload
    return res.status(200).send('Mock upload successful');
  } catch (err) {
    console.error("❌ Mock upload error:", err);
    return res.status(500).json({ error: "Mock upload failed" });
  }
});

// Handle OPTIONS for mock upload
router.options("/mock-upload", (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'PUT, POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).send('');
});

// Test endpoint to verify mock upload is working
router.get("/test-mock", (req, res) => {
  res.json({ message: "Mock media endpoint is working", timestamp: new Date() });
});

export default router;
