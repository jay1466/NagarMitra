import { Router } from 'express';
import { sendError, parsePaging, cleanImage } from '../utils/http.js';
import CommunityPost from '../models/CommunityPost.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { requireFirebaseAuth, optionalFirebaseAuth } from '../middleware/firebaseAuth.js';

const router = Router();

const POST_CATEGORIES = ['general', 'roads', 'water', 'electricity', 'garbage', 'safety', 'parks', 'noise'];

function authorName(author) {
  if (!author) return 'Citizen';
  const full = [author.profile?.firstName, author.profile?.lastName].filter(Boolean).join(' ');
  return author.displayName || full || 'Citizen';
}

// The shape the mobile app renders. Anonymous posts never expose who wrote them.
function toClientPost(post, viewer) {
  const o = post.toObject ? post.toObject() : post;
  const viewerId = viewer?._id;
  const has = (list) => !!viewerId && (list || []).some((id) => String(id) === String(viewerId));
  const authorId = o.author?._id || o.author;
  return {
    id: String(o._id),
    caption: o.content?.caption || '',
    image: o.content?.image || null,
    category: o.category || 'general',
    location: o.location?.address ? { address: o.location.address } : null,
    author: o.isAnonymous
      ? { name: 'Anonymous', avatar: null }
      : { name: authorName(o.author), avatar: o.author?.photoURL || null },
    isAnonymous: !!o.isAnonymous,
    isMine: !!viewerId && String(authorId) === String(viewerId),
    timestamp: o.createdAt,
    likesCount: o.metrics?.likes || 0,
    commentsCount: o.metrics?.comments || 0,
    upvotes: o.metrics?.upvotes || 0,
    downvotes: o.metrics?.downvotes || 0,
    isLiked: has(o.likedBy),
    userVote: has(o.upvotedBy) ? 'up' : has(o.downvotedBy) ? 'down' : null,
  };
}

async function viewerFrom(req) {
  return req.user?.uid ? User.findByFirebaseUid(req.user.uid) : null;
}

// Get community posts with filtering and pagination
router.get('/posts', optionalFirebaseAuth(), async (req, res) => {
  try {
    const { category = 'all', wardCode, sortBy = 'recent' } = req.query;
    const { page, limit } = parsePaging(req.query);
    const options = {
      category: category !== 'all' ? String(category) : undefined,
      wardCode: wardCode ? String(wardCode) : undefined,
      sortBy: String(sortBy),
      page,
      limit,
    };

    const [posts, total, viewer] = await Promise.all([
      CommunityPost.findPublicPosts(options),
      CommunityPost.countDocuments({
        isPublic: true,
        isActive: true,
        ...(options.category && { category: options.category }),
        ...(options.wardCode && { 'location.wardCode': options.wardCode }),
      }),
      viewerFrom(req),
    ]);

    return res.json({
      posts: posts.map((p) => toClientPost(p, viewer)),
      pagination: { current: page, total: Math.ceil(total / limit), count: posts.length, totalPosts: total },
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// Stories: the latest post from each person in the last 24 hours
router.get('/stories', async (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const posts = await CommunityPost.find({ isPublic: true, isActive: true, createdAt: { $gte: since } })
      .populate('author', 'displayName photoURL profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(100);

    const seen = new Set();
    const stories = [];
    for (const p of posts) {
      const key = p.isAnonymous ? `anon-${p._id}` : String(p.author?._id || p._id);
      if (seen.has(key)) continue;
      seen.add(key);
      const post = toClientPost(p);
      stories.push({ id: post.id, username: post.author.name, avatar: post.author.avatar, image: post.image, caption: post.caption, viewed: false });
      if (stories.length >= 20) break;
    }
    return res.json({ stories });
  } catch (err) {
    return sendError(res, err);
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
    return sendError(res, err);
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

    if (typeof caption !== 'string' || caption.trim().length === 0) {
      return res.status(400).json({ error: 'Please write something for your post' });
    }
    if (caption.trim().length > 500) {
      return res.status(400).json({ error: 'Post is too long (max 500 characters)' });
    }
    if (!POST_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
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
        image: cleanImage(image),
        hashtags: hashtags.map(tag => tag.toLowerCase())
      },
      category,
      isAnonymous: !!isAnonymous,
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
      post: toClientPost(post, user)
    });
  } catch (err) {
    return sendError(res, err);
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
    return sendError(res, err);
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
    if (!wasLiked && post.author?._id && !post.author._id.equals(user._id)) {
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
    return sendError(res, err);
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
    return sendError(res, err);
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
    return sendError(res, err);
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
    return sendError(res, err);
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
    return sendError(res, err);
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
    return sendError(res, err);
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
    return sendError(res, err);
  }
});

export default router;