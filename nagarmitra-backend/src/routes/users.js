import { Router } from 'express';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import CommunityPost from '../models/CommunityPost.js';
import Notification from '../models/Notification.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';

const router = Router();

// Get current user profile
router.get('/me', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    let user = await User.findByFirebaseUid(req.user.uid);
    
    if (!user) {
      // Create user if doesn't exist
      user = await User.createFromFirebaseUser(req.user);
    } else {
      // Update last login time
      await user.updateLoginTime();
    }

    return res.json({
      user: {
        ...user.toObject(),
        // Don't expose sensitive fields
        firebaseUid: undefined
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put('/me', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    let user = await User.findByFirebaseUid(req.user.uid);
    
    if (!user) {
      user = await User.createFromFirebaseUser(req.user);
    }

    const allowedUpdates = [
      'displayName',
      'profile.firstName',
      'profile.lastName',
      'profile.address',
      'profile.wardCode',
      'profile.pincode',
      'profile.city',
      'profile.preferredLanguage'
    ];

    const updateData = {};
    allowedUpdates.forEach(field => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (req.body[parent] && req.body[parent][child] !== undefined) {
          if (!updateData[parent]) updateData[parent] = {};
          updateData[parent][child] = req.body[parent][child];
        }
      } else if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Update location if coordinates provided
    if (req.body.location && req.body.location.coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates: req.body.location.coordinates // [lng, lat]
      };
    }

    Object.assign(user, updateData);
    await user.save();

    return res.json({
      user: {
        ...user.toObject(),
        firebaseUid: undefined
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update user preferences
router.put('/me/preferences', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    let user = await User.findByFirebaseUid(req.user.uid);
    
    if (!user) {
      user = await User.createFromFirebaseUser(req.user);
    }

    const allowedPreferences = [
      'emailNotifications',
      'pushNotifications', 
      'smsNotifications',
      'communityUpdates',
      'issueUpdates'
    ];

    const preferenceUpdates = {};
    allowedPreferences.forEach(pref => {
      if (req.body[pref] !== undefined) {
        preferenceUpdates[pref] = Boolean(req.body[pref]);
      }
    });

    if (Object.keys(preferenceUpdates).length > 0) {
      Object.assign(user.preferences, preferenceUpdates);
      await user.save();
    }

    return res.json({
      preferences: user.preferences
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get user statistics and activity summary
router.get('/me/stats', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const user = await User.findByFirebaseUid(req.user.uid);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get complaint statistics
    const complaintStats = await Complaint.aggregate([
      { $match: { firebaseUid: req.user.uid } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get community post statistics
    const communityStats = await CommunityPost.aggregate([
      { $match: { author: user._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          totalLikes: { $sum: '$metrics.likes' },
          totalComments: { $sum: '$metrics.comments' },
          totalShares: { $sum: '$metrics.shares' }
        }
      }
    ]);

    // Get recent activity count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentComplaints = await Complaint.countDocuments({
      firebaseUid: req.user.uid,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const recentPosts = await CommunityPost.countDocuments({
      author: user._id,
      createdAt: { $gte: thirtyDaysAgo },
      isActive: true
    });

    // Transform complaint stats for easier frontend consumption
    const complaintsByStatus = {};
    complaintStats.forEach(stat => {
      complaintsByStatus[stat._id] = stat.count;
    });

    return res.json({
      profile: user.stats,
      complaints: {
        total: user.stats.complaintsSubmitted,
        byStatus: complaintsByStatus,
        recent: recentComplaints
      },
      community: {
        ...(communityStats[0] || { totalPosts: 0, totalLikes: 0, totalComments: 0, totalShares: 0 }),
        recent: recentPosts
      },
      engagement: {
        contributionPoints: user.stats.contributionPoints,
        communityScore: user.stats.communityScore
      },
      memberSince: user.createdAt,
      lastActive: user.lastLoginAt
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get user's complaint history
router.get('/me/complaints', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { firebaseUid: req.user.uid };
    if (status) query.status = status;

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('assignedTo', 'displayName email')
      .select('-firebaseEmail -firebaseUid -upvotedBy -downvotedBy');

    const total = await Complaint.countDocuments(query);

    return res.json({
      complaints,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: complaints.length,
        totalComplaints: total
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get user's community posts
router.get('/me/posts', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { page = 1, limit = 20, includeInactive = false } = req.query;
    
    const query = { 
      author: user._id,
      ...(includeInactive !== 'true' && { isActive: true })
    };

    const posts = await CommunityPost.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('author', 'displayName photoURL');

    const total = await CommunityPost.countDocuments(query);

    return res.json({
      posts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: posts.length,
        totalPosts: total
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get user's notifications
router.get('/me/notifications', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { page = 1, limit = 50, unreadOnly = false } = req.query;
    
    let notifications;
    if (unreadOnly === 'true') {
      notifications = await Notification.findUnreadForUser(user._id, parseInt(limit));
    } else {
      notifications = await Notification.find({
        recipient: user._id,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('relatedComplaint', 'reportId category status')
        .populate('relatedPost', 'content.caption category')
        .populate('relatedUser', 'displayName photoURL');
    }

    const unreadCount = await Notification.countDocuments({
      recipient: user._id,
      'interaction.isRead': false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    return res.json({
      notifications,
      unreadCount,
      pagination: unreadOnly === 'true' ? null : {
        current: parseInt(page),
        count: notifications.length
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.put('/me/notifications/:notificationId/read', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notification = await Notification.findOne({
      _id: req.params.notificationId,
      recipient: user._id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.markAsRead();

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read
router.put('/me/notifications/read-all', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Notification.updateMany(
      {
        recipient: user._id,
        'interaction.isRead': false
      },
      {
        'interaction.isRead': true,
        'interaction.readAt': new Date()
      }
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get public user profile (for viewing other users)
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('displayName photoURL profile.firstName profile.lastName profile.city stats createdAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get public statistics
    const complaintCount = await Complaint.countDocuments({ 
      userId: user._id 
    });

    const postCount = await CommunityPost.countDocuments({ 
      author: user._id, 
      isPublic: true, 
      isActive: true 
    });

    return res.json({
      user: {
        ...user.toObject(),
        stats: {
          complaintsSubmitted: complaintCount,
          postsCreated: postCount,
          contributionPoints: user.stats.contributionPoints,
          communityScore: user.stats.communityScore
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Search users (admin/moderator feature)
router.get('/', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    // This could be restricted to admin users in the future
    const { search, page = 1, limit = 20 } = req.query;
    
    let query = { isActive: true };
    
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('displayName photoURL profile.firstName profile.lastName profile.city stats createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    return res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: users.length,
        totalUsers: total
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete user account
router.delete('/me', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const user = await User.findByFirebaseUid(req.user.uid);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete - mark as inactive instead of hard delete
    user.isActive = false;
    await user.save();

    // Also mark user's posts as inactive (optional)
    await CommunityPost.updateMany(
      { author: user._id },
      { isActive: false }
    );

    return res.json({ success: true, message: 'Account deactivated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;