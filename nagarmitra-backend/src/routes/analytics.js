import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import CommunityPost from '../models/CommunityPost.js';
import User from '../models/User.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';

const router = Router();

// Get overall dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const { wardCode, days = 30 } = req.query;
    
    // Date range for filtering
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Base query filters
    const complaintFilter = {
      ...(wardCode && { wardCode }),
      createdAt: { $gte: startDate }
    };
    
    const communityFilter = {
      ...(wardCode && { 'location.wardCode': wardCode }),
      createdAt: { $gte: startDate },
      isPublic: true,
      isActive: true
    };

    // Parallel queries for performance
    const [
      totalComplaints,
      complaintsByStatus,
      complaintsByCategory,
      avgResponseTime,
      avgResolutionTime,
      recentComplaints,
      communityStats,
      userGrowth
    ] = await Promise.all([
      // Total complaints
      Complaint.countDocuments(wardCode ? { wardCode } : {}),
      
      // Complaints by status
      Complaint.aggregate([
        { $match: wardCode ? { wardCode } : {} },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Complaints by category
      Complaint.aggregate([
        { $match: complaintFilter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Average response time (in hours)
      Complaint.aggregate([
        {
          $match: {
            ...complaintFilter,
            acknowledgmentDate: { $exists: true }
          }
        },
        {
          $project: {
            responseTime: {
              $divide: [
                { $subtract: ['$acknowledgmentDate', '$createdAt'] },
                1000 * 60 * 60 // Convert to hours
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' }
          }
        }
      ]),
      
      // Average resolution time (in days)
      Complaint.aggregate([
        {
          $match: {
            ...complaintFilter,
            completionDate: { $exists: true }
          }
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ['$completionDate', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResolutionTime: { $avg: '$resolutionTime' }
          }
        }
      ]),
      
      // Recent complaints (last 7 days)
      Complaint.countDocuments({
        ...complaintFilter,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      
      // Community engagement stats
      CommunityPost.aggregate([
        { $match: communityFilter },
        {
          $group: {
            _id: null,
            totalPosts: { $sum: 1 },
            totalLikes: { $sum: '$metrics.likes' },
            totalComments: { $sum: '$metrics.comments' },
            avgEngagement: { $avg: { $add: ['$metrics.likes', '$metrics.comments', '$metrics.shares'] } }
          }
        }
      ]),
      
      // User growth (last 30 days)
      User.countDocuments({
        createdAt: { $gte: startDate },
        isActive: true
      })
    ]);

    // Format status data
    const statusStats = {};
    complaintsByStatus.forEach(item => {
      statusStats[item._id] = item.count;
    });

    // Format category data  
    const categoryStats = {};
    complaintsByCategory.forEach(item => {
      categoryStats[item._id] = item.count;
    });

    // Resolution rate calculation
    const resolvedCount = statusStats.resolved || 0;
    const resolutionRate = totalComplaints > 0 ? ((resolvedCount / totalComplaints) * 100).toFixed(1) : 0;

    return res.json({
      summary: {
        totalComplaints,
        recentComplaints,
        resolutionRate: `${resolutionRate}%`,
        avgResponseTime: avgResponseTime[0] ? Math.round(avgResponseTime[0].avgResponseTime) : 0,
        avgResolutionTime: avgResolutionTime[0] ? Math.round(avgResolutionTime[0].avgResolutionTime) : 0,
        newUsers: userGrowth
      },
      complaints: {
        byStatus: statusStats,
        byCategory: categoryStats
      },
      community: communityStats[0] || {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        avgEngagement: 0
      },
      timeRange: {
        days: parseInt(days),
        startDate,
        endDate: new Date()
      },
      wardCode: wardCode || 'all'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get trend data for charts
router.get('/trends', async (req, res) => {
  try {
    const { wardCode, days = 30, groupBy = 'day' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Format string for grouping
    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = '%Y-%m-%d-%H';
        break;
      case 'week':
        dateFormat = '%Y-%U'; // Year and week number
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'day':
      default:
        dateFormat = '%Y-%m-%d';
        break;
    }

    const matchFilter = {
      createdAt: { $gte: startDate },
      ...(wardCode && { wardCode })
    };

    const [complaintTrends, communityTrends] = await Promise.all([
      // Complaint trends by category over time
      Complaint.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
              category: '$category'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]),
      
      // Community post trends
      CommunityPost.aggregate([
        { 
          $match: {
            createdAt: { $gte: startDate },
            ...(wardCode && { 'location.wardCode': wardCode }),
            isPublic: true,
            isActive: true
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
              category: '$category'
            },
            count: { $sum: 1 },
            likes: { $sum: '$metrics.likes' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ])
    ]);

    // Format data for frontend charts
    const complaintChartData = {};
    const communityChartData = {};

    complaintTrends.forEach(item => {
      const { date, category } = item._id;
      if (!complaintChartData[date]) complaintChartData[date] = {};
      complaintChartData[date][category] = item.count;
    });

    communityTrends.forEach(item => {
      const { date, category } = item._id;
      if (!communityChartData[date]) communityChartData[date] = {};
      communityChartData[date][category] = {
        posts: item.count,
        likes: item.likes
      };
    });

    return res.json({
      complaints: complaintChartData,
      community: communityChartData,
      metadata: {
        timeRange: { days: parseInt(days), startDate, endDate: new Date() },
        groupBy,
        wardCode: wardCode || 'all'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get ward-wise statistics
router.get('/wards', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const wardStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$wardCode',
          totalComplaints: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $ne: ['$acknowledgmentDate', null] },
                { $divide: [{ $subtract: ['$acknowledgmentDate', '$createdAt'] }, 1000 * 60 * 60] },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          wardCode: '$_id',
          totalComplaints: 1,
          resolved: 1,
          inProgress: 1,
          resolutionRate: {
            $cond: [
              { $gt: ['$totalComplaints', 0] },
              { $multiply: [{ $divide: ['$resolved', '$totalComplaints'] }, 100] },
              0
            ]
          },
          avgResponseTime: { $round: ['$avgResponseTime', 1] }
        }
      },
      { $sort: { totalComplaints: -1 } },
      { $limit: parseInt(limit) }
    ]);

    return res.json({
      wards: wardStats,
      total: wardStats.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get performance metrics for admin dashboard
router.get('/performance', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      responseTimeStats,
      resolutionStats,
      categoryPerformance,
      userEngagement
    ] = await Promise.all([
      // Response time distribution
      Complaint.aggregate([
        {
          $match: {
            acknowledgmentDate: { $exists: true },
            createdAt: { $gte: startDate }
          }
        },
        {
          $project: {
            responseHours: {
              $divide: [
                { $subtract: ['$acknowledgmentDate', '$createdAt'] },
                1000 * 60 * 60
              ]
            }
          }
        },
        {
          $bucket: {
            groupBy: '$responseHours',
            boundaries: [0, 2, 6, 12, 24, 48, 72, Infinity],
            default: 'Other',
            output: {
              count: { $sum: 1 }
            }
          }
        }
      ]),

      // Resolution time by priority
      Complaint.aggregate([
        {
          $match: {
            status: 'resolved',
            completionDate: { $exists: true },
            createdAt: { $gte: startDate }
          }
        },
        {
          $project: {
            priority: 1,
            resolutionDays: {
              $divide: [
                { $subtract: ['$completionDate', '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        {
          $group: {
            _id: '$priority',
            avgDays: { $avg: '$resolutionDays' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Performance by category
      Complaint.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            category: '$_id',
            total: 1,
            resolved: 1,
            resolutionRate: {
              $multiply: [{ $divide: ['$resolved', '$total'] }, 100]
            }
          }
        },
        { $sort: { resolutionRate: -1 } }
      ]),

      // User engagement metrics
      User.aggregate([
        { $match: { createdAt: { $gte: startDate }, isActive: true } },
        {
          $lookup: {
            from: 'complaints',
            localField: 'firebaseUid',
            foreignField: 'firebaseUid',
            as: 'complaints'
          }
        },
        {
          $lookup: {
            from: 'communityposts',
            localField: '_id',
            foreignField: 'author',
            as: 'posts'
          }
        },
        {
          $project: {
            complaintCount: { $size: '$complaints' },
            postCount: { $size: '$posts' },
            totalEngagement: {
              $add: [
                { $size: '$complaints' },
                { $multiply: [{ $size: '$posts' }, 2] } // Weight posts higher
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgComplaintsPerUser: { $avg: '$complaintCount' },
            avgPostsPerUser: { $avg: '$postCount' },
            avgEngagement: { $avg: '$totalEngagement' }
          }
        }
      ])
    ]);

    return res.json({
      responseTime: {
        distribution: responseTimeStats,
        labels: ['<2h', '2-6h', '6-12h', '12-24h', '1-2d', '2-3d', '>3d']
      },
      resolution: {
        byPriority: resolutionStats
      },
      categoryPerformance: categoryPerformance,
      userEngagement: userEngagement[0] || {
        avgComplaintsPerUser: 0,
        avgPostsPerUser: 0,
        avgEngagement: 0
      },
      generatedAt: new Date(),
      timeRange: { days: parseInt(days), startDate }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get heatmap data for geographic visualization
router.get('/heatmap', async (req, res) => {
  try {
    const { status, category, days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const matchFilter = {
      location: { $exists: true },
      'location.coordinates': { $exists: true, $ne: [] },
      createdAt: { $gte: startDate },
      ...(status && { status }),
      ...(category && { category })
    };

    const heatmapData = await Complaint.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            // Group by approximate location (rounded coordinates for privacy)
            lat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 3] },
            lng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 3] }
          },
          count: { $sum: 1 },
          categories: { $addToSet: '$category' },
          statuses: { $addToSet: '$status' },
          wardCode: { $first: '$wardCode' }
        }
      },
      {
        $project: {
          lat: '$_id.lat',
          lng: '$_id.lng',
          count: 1,
          intensity: {
            $cond: [
              { $gte: ['$count', 20] }, 1.0,  // High intensity (red)
              { $cond: [
                { $gte: ['$count', 15] }, 0.7,  // Medium-high (crimson)
                { $cond: [
                  { $gte: ['$count', 10] }, 0.4,  // Medium (yellow)
                  0.1  // Low (green)
                ]}
              ]}
            ]
          },
          categories: 1,
          statuses: 1,
          wardCode: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 1000 } // Limit for performance
    ]);

    // Calculate bounds for the map
    const lats = heatmapData.map(point => point.lat).filter(lat => lat);
    const lngs = heatmapData.map(point => point.lng).filter(lng => lng);
    
    const bounds = lats.length > 0 ? {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    } : null;

    return res.json({
      heatmapData,
      bounds,
      metadata: {
        total: heatmapData.length,
        filters: { status, category, days: parseInt(days) },
        generatedAt: new Date()
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Export data for reports (CSV format data)
router.get('/export', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const { 
      type = 'complaints', 
      wardCode, 
      status, 
      category,
      startDate,
      endDate,
      format = 'json'
    } = req.query;

    let data;
    const baseFilter = {};
    
    if (wardCode) baseFilter.wardCode = wardCode;
    if (status) baseFilter.status = status;
    if (category) baseFilter.category = category;
    if (startDate || endDate) {
      baseFilter.createdAt = {};
      if (startDate) baseFilter.createdAt.$gte = new Date(startDate);
      if (endDate) baseFilter.createdAt.$lte = new Date(endDate);
    }

    switch (type) {
      case 'complaints':
        data = await Complaint.find(baseFilter)
          .populate('assignedTo', 'displayName email')
          .select('-firebaseUid -upvotedBy -downvotedBy -internalNotes')
          .sort({ createdAt: -1 })
          .limit(10000); // Reasonable limit
        break;
        
      case 'community':
        data = await CommunityPost.find({
          ...baseFilter,
          isPublic: true,
          isActive: true
        })
          .populate('author', 'displayName email')
          .sort({ createdAt: -1 })
          .limit(10000);
        break;
        
      case 'users':
        data = await User.find({ isActive: true })
          .select('displayName email profile stats createdAt lastLoginAt')
          .sort({ createdAt: -1 })
          .limit(10000);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    if (format === 'csv') {
      // For CSV format, you might want to implement CSV conversion here
      // For now, return instructions
      return res.json({
        message: 'CSV export feature coming soon',
        dataCount: data.length,
        availableFormats: ['json']
      });
    }

    return res.json({
      type,
      data,
      metadata: {
        count: data.length,
        filters: baseFilter,
        exportedAt: new Date()
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;