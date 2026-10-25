import { Router } from 'express';
import CommunityPost from '../models/CommunityPost.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';

const router = Router();

// Get community posts with filtering and pagination
router.get('/posts', async (req, res) => {
  try {
    const {
      category = 'all',
      wardCode,
      sortBy = 'recent', // recent, trending, popular
      page = 1,
      limit = 20
    } = req.query;

    const options = {
      category: category !== 'all' ? category : undefined,
      wardCode,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const posts = await CommunityPost.findPublicPosts(options);
    const total = await CommunityPost.countDocuments({
      isPublic: true,
      isActive: true,
      ...(options.category && { category: options.category }),
      ...(options.wardCode && { 'location.wardCode': options.wardCode })
    });

    return res.json({
      posts: posts.map(post => ({
        ...post.toObject(),
        // Add user interaction status if authenticated
        isLiked: req.user ? post.likedBy.includes(req.user._id) : false,
        userVote: req.user ? (
          post.upvotedBy.includes(req.user._id) ? 'up' :
          post.downvotedBy.includes(req.user._id) ? 'down' : null
        ) : null
      })),
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

// Get trending posts
router.get('/posts/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const posts = await CommunityPost.findTrendingPosts(parseInt(limit));
    
    return res.json({
      posts: posts.map(post => ({
        ...post.toObject(),
        isLiked: req.user ? post.likedBy.includes(req.user._id) : false,
        userVote: req.user ? (
          post.upvotedBy.includes(req.user._id) ? 'up' :
          post.downvotedBy.includes(req.user._id) ? 'down' : null
        ) : null
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create a new community post
router.post('/posts', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const {
      caption,
      image, // S3 key
      category = 'general',
      location,
      isAnonymous = false
    } = req.body;

    if (!caption || caption.trim().length === 0) {
      return res.status(400).json({ error: 'Caption is required' });
    }

    // Find or create user
    let user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      user = await User.createFromFirebaseUser(req.user);
    }

    // Extract hashtags
    const hashtags = caption.match(/#\w+/g) || [];

    const postData = {
      author: user._id,
      content: {
        caption: caption.trim(),
        image,
        hashtags: hashtags.map(tag => tag.toLowerCase())
      },
      category,
      isAnonymous,
      isPublic: true,
      isActive: true
    };

    // Add location if provided
    if (location) {
      postData.location = {
        address: location.address,
        wardCode: location.wardCode
      };
      
      if (location.coordinates && location.coordinates.length === 2) {
        postData.location.coordinates = {
          type: 'Point',
          coordinates: location.coordinates // [lng, lat]
        };
      }
    }

    const post = await CommunityPost.create(postData);
    await post.populate('author', 'displayName photoURL profile.firstName profile.lastName');

    // Update user's contribution score
    user.stats.contributionPoints += 5;
    await user.save();

    return res.status(201).json({
      post: {
        ...post.toObject(),
        isLiked: false,
        userVote: null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a specific post
router.get('/posts/:postId', async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId)
      .populate('author', 'displayName photoURL profile.firstName profile.lastName');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!post.isPublic || !post.isActive) {
      return res.status(404).json({ error: 'Post not available' });
    }

    // Increment view count
    await post.incrementView();

    return res.json({
      post: {
        ...post.toObject(),
        isLiked: req.user ? post.likedBy.includes(req.user._id) : false,
        userVote: req.user ? (
          post.upvotedBy.includes(req.user._id) ? 'up' :
          post.downvotedBy.includes(req.user._id) ? 'down' : null
        ) : null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Like/unlike a post
router.post('/posts/:postId/like', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    // Find or create user
    let user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      user = await User.createFromFirebaseUser(req.user);
    }

    const post = await CommunityPost.findById(req.params.postId)
      .populate('author', 'displayName photoURL');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const wasLiked = post.likedBy.includes(user._id);
    await post.toggleLike(user._id);

    // Create notification if it was a new like (not unlike) and not self-like
    if (!wasLiked && !post.author._id.equals(user._id)) {
      await Notification.createCommunityNotification(
        post,
        'community_like',
        post.author._id,
        user
      );
    }

    return res.json({
      success: true,
      isLiked: !wasLiked,
      likesCount: post.metrics.likes + (wasLiked ? -1 : 1)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Vote on a post (upvote/downvote)
router.post('/posts/:postId/vote', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const { type } = req.body; // 'up' or 'down'

    if (!['up', 'down'].includes(type)) {
      return res.status(400).json({ error: 'Vote type must be "up" or "down"' });
    }

    // Find or create user
    let user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      user = await User.createFromFirebaseUser(req.user);
    }

    const post = await CommunityPost.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const oldUserVote = post.upvotedBy.includes(user._id) ? 'up' :
                       post.downvotedBy.includes(user._id) ? 'down' : null;
    
    await post.toggleVote(user._id, type);

    const newUserVote = post.upvotedBy.includes(user._id) ? 'up' :
                       post.downvotedBy.includes(user._id) ? 'down' : null;

    return res.json({
      success: true,
      userVote: newUserVote,
      upvotes: post.metrics.upvotes,
      downvotes: post.metrics.downvotes,
      netScore: post.netScore
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Share a post (increment share count)
router.post('/posts/:postId/share', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await post.addShare();

    return res.json({
      success: true,
      sharesCount: post.metrics.shares
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Report a post
router.post('/posts/:postId/report', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !['spam', 'inappropriate', 'misleading', 'harassment', 'other'].includes(reason)) {
      return res.status(400).json({ error: 'Valid reason is required' });
    }

    // Find or create user
    let user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      user = await User.createFromFirebaseUser(req.user);
    }

    const post = await CommunityPost.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already reported this post
    const existingFlag = post.flags.find(flag => flag.userId.equals(user._id));
    if (existingFlag) {
      return res.status(400).json({ error: 'You have already reported this post' });
    }

    post.flags.push({
      userId: user._id,
      reason,
      createdAt: new Date()
    });

    await post.save();

    return res.json({ success: true, message: 'Post reported successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a post (only by author)
router.delete('/posts/:postId', requireFirebaseAuth({ requireVerified: false }), async (req, res) => {
  try {
    // Find or create user
    let user = await User.findByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const post = await CommunityPost.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user is the author
    if (!post.author.equals(user._id)) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    // Soft delete by marking as inactive
    post.isActive = false;
    await post.save();

    return res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get posts by a specific user
router.get('/users/:userId/posts', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.params.userId;

    const posts = await CommunityPost.find({
      author: userId,
      isPublic: true,
      isActive: true
    })
      .populate('author', 'displayName photoURL profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await CommunityPost.countDocuments({
      author: userId,
      isPublic: true,
      isActive: true
    });

    return res.json({
      posts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: posts.length
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get community statistics
router.get('/stats', async (req, res) => {
  try {
    const { wardCode } = req.query;

    const matchQuery = {
      isPublic: true,
      isActive: true,
      ...(wardCode && { 'location.wardCode': wardCode })
    };

    const stats = await CommunityPost.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalLikes: { $sum: '$metrics.likes' },
          totalComments: { $sum: '$metrics.comments' },
          totalShares: { $sum: '$metrics.shares' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalPosts = await CommunityPost.countDocuments(matchQuery);
    const totalUsers = await CommunityPost.distinct('author', matchQuery);

    return res.json({
      totalPosts,
      totalUsers: totalUsers.length,
      categoryStats: stats,
      generatedAt: new Date()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;