import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Complaint from '../models/Complaint.js';

// Load environment variables
dotenv.config();

// Bhubaneswar area coordinates and ward data
const BHUBANESWAR_BOUNDS = {
  north: 20.3578,
  south: 20.2320,
  east: 85.8918,
  west: 85.7814
};

const WARD_CODES = [
  'WARD01', 'WARD02', 'WARD03', 'WARD04', 'WARD05',
  'WARD06', 'WARD07', 'WARD08', 'WARD09', 'WARD10',
  'WARD11', 'WARD12', 'WARD13', 'WARD14', 'WARD15',
  'WARD16', 'WARD17', 'WARD18', 'WARD19', 'WARD20'
];

const CATEGORIES = [
  'Potholes',
  'Sanitation', 
  'Waste Management',
  'Water Supply',
  'Electricity & Lighting',
  'Miscellaneous'
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['submitted', 'acknowledged', 'in_progress', 'resolved'];

const SAMPLE_DESCRIPTIONS = {
  'Potholes': [
    'Large pothole on main road causing traffic issues',
    'Multiple small potholes near school area',
    'Deep pothole filled with water creating hazard',
    'Road surface deteriorated with multiple holes',
    'Dangerous pothole near bus stop'
  ],
  'Sanitation': [
    'Overflowing sewage drain causing bad smell',
    'Blocked drainage system in residential area',
    'Open drain without proper cover',
    'Sewage water flowing on street',
    'Clogged storm drain during monsoon'
  ],
  'Waste Management': [
    'Garbage not collected for several days',
    'Overflowing waste bins in market area',
    'Illegal dumping of construction waste',
    'Broken garbage collection vehicle',
    'Need additional waste bins in park'
  ],
  'Water Supply': [
    'No water supply for past 3 days',
    'Low water pressure in residential area',
    'Broken water pipe leaking on road',
    'Contaminated water supply',
    'Water connection not working properly'
  ],
  'Electricity & Lighting': [
    'Street light not working for weeks',
    'Power outage in entire sector',
    'Broken electricity pole after storm',
    'Flickering street lights causing darkness',
    'Need additional street lighting'
  ],
  'Miscellaneous': [
    'Stray dogs creating nuisance',
    'Illegal construction blocking road',
    'Noise pollution from nearby factory',
    'Encroachment on public footpath',
    'Need traffic signal at busy intersection'
  ]
};

const SAMPLE_ADDRESSES = [
  'Near Kalpana Square, Bhubaneswar',
  'Station Square, Old Town',
  'Saheed Nagar, Unit 2',
  'Patia, Near Kiit University',
  'Chandrasekharpur, IT Park',
  'Kalinga Nagar, Industrial Area',
  'Jaydev Vihar, Near Temple',
  'Nayapalli, Market Complex',
  'Rasulgarh, Near Railway Station',
  'Sundarpada, Residential Area',
  'Laxmisagar, Near Hospital',
  'Baramunda, Bus Terminal',
  'Mancheswar, Industrial Estate',
  'Dumduma, Housing Board',
  'Khandagiri, Near Caves'
];

// Generate random coordinates within Bhubaneswar bounds
function getRandomCoordinate() {
  const lat = BHUBANESWAR_BOUNDS.south + 
    Math.random() * (BHUBANESWAR_BOUNDS.north - BHUBANESWAR_BOUNDS.south);
  const lng = BHUBANESWAR_BOUNDS.west + 
    Math.random() * (BHUBANESWAR_BOUNDS.east - BHUBANESWAR_BOUNDS.west);
  
  return [lng, lat]; // GeoJSON format: [longitude, latitude]
}

// Generate random date within last 60 days
function getRandomDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 60);
  const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
  return date;
}

// Generate realistic status based on creation date
function getRealisticStatus(createdDate) {
  const daysSinceCreated = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCreated < 2) {
    return Math.random() < 0.7 ? 'submitted' : 'acknowledged';
  } else if (daysSinceCreated < 7) {
    const rand = Math.random();
    if (rand < 0.3) return 'submitted';
    if (rand < 0.5) return 'acknowledged';
    return 'in_progress';
  } else if (daysSinceCreated < 30) {
    const rand = Math.random();
    if (rand < 0.1) return 'submitted';
    if (rand < 0.2) return 'acknowledged';
    if (rand < 0.4) return 'in_progress';
    return 'resolved';
  } else {
    // Older complaints are mostly resolved
    return Math.random() < 0.8 ? 'resolved' : 'in_progress';
  }
}

// Generate random priority weighted towards Medium
function getRandomPriority() {
  const rand = Math.random();
  if (rand < 0.1) return 'Critical';
  if (rand < 0.25) return 'High';
  if (rand < 0.85) return 'Medium';
  return 'Low';
}

// Generate mock complaint data
function generateMockComplaint() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const createdDate = getRandomDate();
  const status = getRealisticStatus(createdDate);
  const priority = getRandomPriority();
  const coordinates = getRandomCoordinate();
  const wardCode = WARD_CODES[Math.floor(Math.random() * WARD_CODES.length)];
  
  const descriptions = SAMPLE_DESCRIPTIONS[category];
  const description = descriptions[Math.floor(Math.random() * descriptions.length)];
  const address = SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)];
  
  // Generate some status dates based on status
  let acknowledgmentDate = null;
  let startDate = null;
  let completionDate = null;
  
  if (status !== 'submitted') {
    acknowledgmentDate = new Date(createdDate.getTime() + (Math.random() * 2 * 24 * 60 * 60 * 1000)); // 0-2 days
  }
  
  if (status === 'in_progress' || status === 'resolved') {
    startDate = new Date(createdDate.getTime() + (Math.random() * 5 * 24 * 60 * 60 * 1000)); // 0-5 days
  }
  
  if (status === 'resolved') {
    completionDate = new Date(createdDate.getTime() + (Math.random() * 20 * 24 * 60 * 60 * 1000)); // 0-20 days
  }

  return {
    description,
    category,
    priority,
    status,
    address,
    location: {
      type: 'Point',
      coordinates
    },
    wardCode,
    createdAt: createdDate,
    updatedAt: new Date(),
    acknowledgmentDate,
    startDate,
    completionDate,
    views: Math.floor(Math.random() * 50),
    upvotes: Math.floor(Math.random() * 20),
    downvotes: Math.floor(Math.random() * 5),
    isPublic: true,
    isAnonymous: Math.random() < 0.3,
    verificationStatus: 'verified'
  };
}

// Generate report ID for mock data
async function generateMockReportId(wardCode) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  
  // Use a random sequence for mock data to avoid conflicts
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `NM-${wardCode}-${y}${m}${d}-${seq}`;
}

// Main function to generate mock data
export async function generateMockComplaints(count = 100) {
  console.log(`🎲 Generating ${count} mock complaints...`);
  
  const mockComplaints = [];
  
  for (let i = 0; i < count; i++) {
    const complaint = generateMockComplaint();
    complaint.reportId = await generateMockReportId(complaint.wardCode);
    mockComplaints.push(complaint);
  }
  
  try {
    const insertedComplaints = await Complaint.insertMany(mockComplaints);
    console.log(`✅ Successfully inserted ${insertedComplaints.length} mock complaints`);
    
    // Show some stats
    const statusStats = {};
    const categoryStats = {};
    
    insertedComplaints.forEach(complaint => {
      statusStats[complaint.status] = (statusStats[complaint.status] || 0) + 1;
      categoryStats[complaint.category] = (categoryStats[complaint.category] || 0) + 1;
    });
    
    console.log('\n📊 Generated Data Statistics:');
    console.log('Status distribution:', statusStats);
    console.log('Category distribution:', categoryStats);
    
    return insertedComplaints;
  } catch (error) {
    console.error('❌ Error inserting mock complaints:', error);
    throw error;
  }
}

// Cleanup function to remove mock data
export async function cleanupMockData() {
  console.log('🧹 Cleaning up mock data...');
  
  try {
    const result = await Complaint.deleteMany({
      reportId: { $regex: /^NM-WARD\d+-\d{8}-\d{4}$/ }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} mock complaints`);
    return result;
  } catch (error) {
    console.error('❌ Error cleaning up mock data:', error);
    throw error;
  }
}

// Generate hotspot areas (areas with more complaints)
export async function generateHotspots() {
  console.log('🔥 Generating hotspot areas with concentrated complaints...');
  
  // Define hotspot centers (major areas in Bhubaneswar)
  const hotspots = [
    { name: 'Kalpana Square', lat: 20.2962, lng: 85.8245, intensity: 'high' },
    { name: 'Station Square', lat: 20.2571, lng: 85.8372, intensity: 'medium' },
    { name: 'Patia', lat: 20.3498, lng: 85.8181, intensity: 'high' },
    { name: 'Chandrasekharpur', lat: 20.3176, lng: 85.8040, intensity: 'medium' },
    { name: 'Nayapalli', lat: 20.2866, lng: 85.8138, intensity: 'low' }
  ];
  
  const hotspotComplaints = [];
  
  for (const hotspot of hotspots) {
    const complaintCount = hotspot.intensity === 'high' ? 
      Math.floor(Math.random() * 20) + 15 : // 15-35 complaints
      hotspot.intensity === 'medium' ? 
      Math.floor(Math.random() * 15) + 8 : // 8-23 complaints
      Math.floor(Math.random() * 10) + 3; // 3-13 complaints
    
    for (let i = 0; i < complaintCount; i++) {
      const complaint = generateMockComplaint();
      
      // Adjust coordinates to be near the hotspot center
      const radiusKm = 0.5; // 500m radius
      const radiusLat = radiusKm / 111.32; // Convert to lat degrees
      const radiusLng = radiusKm / (111.32 * Math.cos(hotspot.lat * Math.PI / 180));
      
      const randomLat = hotspot.lat + (Math.random() - 0.5) * 2 * radiusLat;
      const randomLng = hotspot.lng + (Math.random() - 0.5) * 2 * radiusLng;
      
      complaint.location.coordinates = [randomLng, randomLat];
      complaint.address = `Near ${hotspot.name}, Bhubaneswar`;
      complaint.reportId = await generateMockReportId(complaint.wardCode);
      
      hotspotComplaints.push(complaint);
    }
  }
  
  try {
    const insertedComplaints = await Complaint.insertMany(hotspotComplaints);
    console.log(`✅ Generated ${insertedComplaints.length} complaints in hotspot areas`);
    return insertedComplaints;
  } catch (error) {
    console.error('❌ Error generating hotspot complaints:', error);
    throw error;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const command = process.argv[2];
  const count = parseInt(process.argv[3]) || 100;
  
  // Connect to MongoDB
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nagarmitra';
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    switch (command) {
      case 'generate':
        await generateMockComplaints(count);
        break;
      case 'hotspots':
        await generateHotspots();
        break;
      case 'cleanup':
        await cleanupMockData();
        break;
      case 'full':
        await cleanupMockData();
        await generateMockComplaints(count);
        await generateHotspots();
        break;
      default:
        console.log(`
Usage: node generateMockData.js <command> [count]

Commands:
  generate [count]  - Generate mock complaints (default: 100)
  hotspots         - Generate concentrated complaints in hotspot areas
  cleanup          - Remove all mock data
  full [count]     - Cleanup + generate regular + hotspot data

Examples:
  node generateMockData.js generate 200
  node generateMockData.js hotspots
  node generateMockData.js full 150
        `);
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}