import mongoose from 'mongoose';

const CommunityPostSchema = new mongoose.Schema(
  {
    // Author information
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Post content
    content: {
      caption: { type: String, required: true, maxlength: 500 },
      image: { type: String }, // S3 key for image
      hashtags: [{ type: String }], // Extracted hashtags
    },
    
    // Categorization
    category: {
      type: String,
      enum: ['general', 'roads', 'water', 'electricity', 'garbage', 'safety', 'parks', 'noise'],
      default: 'general',
      index: true,
    },
    
    // Location information
    location: {
      address: { type: String },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere' }, // [lng, lat]
      },
      wardCode: { type: String, index: true },
    },
    
    // Interaction metrics
    metrics: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      dislikes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 },
    },
    
    // User interactions - for efficient querying
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Post settings
    isAnonymous: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    
    // Moderation
    isModerated: { type: Boolean, default: false },
    moderationReason: { type: String },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    
    // Content flags
    flags: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, enum: ['spam', 'inappropriate', 'misleading', 'harassment', 'other'] },
      createdAt: { type: Date, default: Date.now },
    }],
    
    // Engagement tracking
    lastEngagementAt: { type: Date, default: Date.now },
    trendingScore: { type: Number, default: 0 }, // Calculated field for trending posts
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient querying
CommunityPostSchema.index({ createdAt: -1 });
CommunityPostSchema.index({ category: 1, createdAt: -1 });
CommunityPostSchema.index({ 'location.wardCode': 1, createdAt: -1 });
CommunityPostSchema.index({ trendingScore: -1, createdAt: -1 });
CommunityPostSchema.index({ isPublic: 1, isActive: 1, createdAt: -1 });
CommunityPostSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for engagement rate
CommunityPostSchema.virtual('engagementRate').get(function() {
  const totalEngagements = this.metrics.likes + this.metrics.comments + this.metrics.shares;
  return this.metrics.views > 0 ? (totalEngagements / this.metrics.views) * 100 : 0;
});

// Virtual for net score (upvotes - downvotes)
CommunityPostSchema.virtual('netScore').get(function() {
  return this.metrics.upvotes - this.metrics.downvotes;
});

// Static methods
CommunityPostSchema.statics.findPublicPosts = function(options = {}) {
  const { category, wardCode, limit = 20, page = 1, sortBy = 'recent' } = options;
  
  const query = { isPublic: true, isActive: true };
  if (category && category !== 'all') query.category = category;
  if (wardCode) query['location.wardCode'] = wardCode;
  
  let sort = {};
  switch (sortBy) {
    case 'trending':
      sort = { trendingScore: -1, createdAt: -1 };
      break;
    case 'popular':
      sort = { 'metrics.likes': -1, createdAt: -1 };
      break;
    case 'recent':
    default:
      sort = { createdAt: -1 };
      break;
  }
  
  return this.find(query)
    .populate('author', 'displayName photoURL profile.firstName profile.lastName')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
};

CommunityPostSchema.statics.findTrendingPosts = function(limit = 10) {
  // Posts from last 7 days with high engagement
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  return this.find({
    isPublic: true,
    isActive: true,
    createdAt: { $gte: weekAgo }
  })
    .populate('author', 'displayName photoURL')
    .sort({ trendingScore: -1, 'metrics.likes': -1 })
    .limit(limit);
};

// Instance methods
CommunityPostSchema.methods.incrementView = function() {
  this.metrics.views += 1;
  this.lastEngagementAt = new Date();
  return this.save();
};

CommunityPostSchema.methods.toggleLike = function(userId) {
  const isLiked = this.likedBy.includes(userId);
  const isDisliked = this.dislikedBy.includes(userId);
  
  if (isLiked) {
    // Unlike
    this.likedBy.pull(userId);
    this.metrics.likes = Math.max(0, this.metrics.likes - 1);
  } else {
    // Like
    this.likedBy.push(userId);
    this.metrics.likes += 1;
    
    // Remove dislike if exists
    if (isDisliked) {
      this.dislikedBy.pull(userId);
      this.metrics.dislikes = Math.max(0, this.metrics.dislikes - 1);
    }
  }
  
  this.lastEngagementAt = new Date();
  this.updateTrendingScore();
  return this.save();
};

CommunityPostSchema.methods.toggleVote = function(userId, voteType) {
  const isUpvoted = this.upvotedBy.includes(userId);
  const isDownvoted = this.downvotedBy.includes(userId);
  
  if (voteType === 'up') {
    if (isUpvoted) {
      // Remove upvote
      this.upvotedBy.pull(userId);
      this.metrics.upvotes = Math.max(0, this.metrics.upvotes - 1);
    } else {
      // Add upvote
      this.upvotedBy.push(userId);
      this.metrics.upvotes += 1;
      
      // Remove downvote if exists
      if (isDownvoted) {
        this.downvotedBy.pull(userId);
        this.metrics.downvotes = Math.max(0, this.metrics.downvotes - 1);
      }
    }
  } else if (voteType === 'down') {
    if (isDownvoted) {
      // Remove downvote
      this.downvotedBy.pull(userId);
      this.metrics.downvotes = Math.max(0, this.metrics.downvotes - 1);
    } else {
      // Add downvote
      this.downvotedBy.push(userId);
      this.metrics.downvotes += 1;
      
      // Remove upvote if exists
      if (isUpvoted) {
        this.upvotedBy.pull(userId);
        this.metrics.upvotes = Math.max(0, this.metrics.upvotes - 1);
      }
    }
  }
  
  this.lastEngagementAt = new Date();
  this.updateTrendingScore();
  return this.save();
};

CommunityPostSchema.methods.updateTrendingScore = function() {
  // Calculate trending score based on engagement and recency
  const hoursSincePost = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  const engagementScore = this.metrics.likes + (this.metrics.comments * 2) + (this.metrics.shares * 3);
  const timeDecay = Math.max(0.1, 1 / (1 + hoursSincePost / 24)); // Decay over 24 hours
  
  this.trendingScore = Math.round(engagementScore * timeDecay * 100) / 100;
};

CommunityPostSchema.methods.addComment = function() {
  this.metrics.comments += 1;
  this.lastEngagementAt = new Date();
  this.updateTrendingScore();
  return this.save();
};

CommunityPostSchema.methods.addShare = function() {
  this.metrics.shares += 1;
  this.lastEngagementAt = new Date();
  this.updateTrendingScore();
  return this.save();
};

// Pre-save middleware
CommunityPostSchema.pre('save', function(next) {
  if (this.isModified('metrics')) {
    this.updateTrendingScore();
  }
  next();
});

const CommunityPost = mongoose.model('CommunityPost', CommunityPostSchema);
export default CommunityPost;