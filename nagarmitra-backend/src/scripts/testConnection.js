import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 Testing MongoDB connection...');
console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nagarmitra';

try {
  console.log('📡 Attempting to connect to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Successfully connected to MongoDB');
  
  // Test a simple query
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('📂 Available collections:', collections.map(c => c.name));
  
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
} catch (error) {
  console.error('❌ MongoDB connection error:', error.message);
  process.exit(1);
}