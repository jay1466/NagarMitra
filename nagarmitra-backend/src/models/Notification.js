import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    // Recipient information
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Notification content
    title: { type: String, required: true },
    body: { type: String, required: true },
    
    // Notification type and category
    type: {
      type: String,
      enum: [
        'complaint_confirmed',
        'complaint_acknowledged', 
        'complaint_in_progress',
        'complaint_resolved',
        'complaint_rejected',
        'community_like',
        'community_comment',
        'system_announcement',
        'ward_update',
        'maintenance_notice'
      ],
      required: true,
      index: true,
    },
    
    // Related data
    relatedComplaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
    relatedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost' },
    relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Additional data for the notification
    data: {
      reportId: { type: String },
      postId: { type: String },
      actionUrl: { type: String }, // Deep link or action URL
      imageUrl: { type: String },
      customData: { type: mongoose.Schema.Types.Mixed }, // Any additional data
    },
    
    // Delivery status
    delivery: {
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed'],
        default: 'pending',
        index: true,
      },
      method: {
        type: String,
        enum: ['push', 'email', 'sms', 'in_app'],
        default: 'push',
      },
      sentAt: { type: Date },
      deliveredAt: { type: Date },
      failureReason: { type: String },
      retryCount: { type: Number, default: 0 },
    },
    
    // User interaction
    interaction: {
      isRead: { type: Boolean, default: false, index: true },
      readAt: { type: Date },
      isClicked: { type: Boolean, default: false },
      clickedAt: { type: Date },
      isDismissed: { type: Boolean, default: false },
      dismissedAt: { type: Date },
    },
    
    // Priority and scheduling
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    
    scheduledFor: { type: Date }, // For scheduled notifications
    expiresAt: { type: Date }, // Auto-delete after this date
    
    // Targeting
    targeting: {
      wardCodes: [{ type: String }], // For ward-specific notifications
      userCategories: [{ type: String }], // admin, citizen, moderator
      deviceTokens: [{ type: String }], // Specific device tokens if needed
    },
    
    // Firebase Cloud Messaging details
    fcm: {
      messageId: { type: String }, // FCM message ID
      token: { type: String }, // Device token used
      response: { type: mongoose.Schema.Types.Mixed }, // FCM response
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient querying
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ 'delivery.status': 1, createdAt: -1 });
NotificationSchema.index({ 'interaction.isRead': 1, recipient: 1 });
NotificationSchema.index({ scheduledFor: 1, 'delivery.status': 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual properties
NotificationSchema.virtual('isDelivered').get(function() {
  return this.delivery.status === 'delivered';
});

NotificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Static methods
NotificationSchema.statics.createComplaintNotification = function(complaint, type, recipient) {
  const titles = {
    complaint_confirmed: '✅ Report Confirmed',
    complaint_acknowledged: '👀 Report Acknowledged', 
    complaint_in_progress: '🔧 Work In Progress',
    complaint_resolved: '🎉 Issue Resolved',
    complaint_rejected: '❌ Report Rejected'
  };
  
  const bodies = {
    complaint_confirmed: `Your report #${complaint.reportId} has been confirmed and is being reviewed.`,
    complaint_acknowledged: `Your report #${complaint.reportId} has been acknowledged by authorities.`,
    complaint_in_progress: `Work has started on your report #${complaint.reportId}. We'll keep you updated.`,
    complaint_resolved: `Great news! Your report #${complaint.reportId} has been resolved.`,
    complaint_rejected: `Your report #${complaint.reportId} was not approved. Check the app for details.`
  };
  
  return this.create({
    recipient,
    title: titles[type] || 'NagarMitra Update',
    body: bodies[type] || 'You have an update on your complaint.',
    type,
    relatedComplaint: complaint._id,
    data: {
      reportId: complaint.reportId,
      actionUrl: `nagarmitra://complaint/${complaint._id}`
    },
    priority: type === 'complaint_resolved' ? 'high' : 'medium',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });
};

NotificationSchema.statics.createCommunityNotification = function(post, type, recipient, actor) {
  const titles = {
    community_like: '❤️ Someone liked your post',
    community_comment: '💬 New comment on your post'
  };
  
  const bodies = {
    community_like: `${actor.displayName || 'Someone'} liked your community post.`,
    community_comment: `${actor.displayName || 'Someone'} commented on your community post.`
  };
  
  return this.create({
    recipient,
    title: titles[type] || 'Community Update',
    body: bodies[type] || 'You have a new community interaction.',
    type,
    relatedPost: post._id,
    relatedUser: actor._id,
    data: {
      postId: post._id,
      actionUrl: `nagarmitra://community/post/${post._id}`
    },
    priority: 'low',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
};

NotificationSchema.statics.createSystemNotification = function(title, body, options = {}) {
  const {
    type = 'system_announcement',
    priority = 'medium',
    wardCodes = [],
    userCategories = ['citizen'],
    expiresIn = 7 // days
  } = options;
  
  return this.create({
    title,
    body,
    type,
    priority,
    targeting: {
      wardCodes,
      userCategories
    },
    expiresAt: new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
  });
};

NotificationSchema.statics.findUnreadForUser = function(userId, limit = 50) {
  return this.find({
    recipient: userId,
    'interaction.isRead': false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('relatedComplaint', 'reportId category status')
    .populate('relatedPost', 'content.caption category')
    .populate('relatedUser', 'displayName photoURL');
};

NotificationSchema.statics.findPendingDeliveries = function(limit = 100) {
  return this.find({
    'delivery.status': 'pending',
    $or: [
      { scheduledFor: { $exists: false } },
      { scheduledFor: { $lte: new Date() } }
    ]
  })
    .sort({ priority: 1, createdAt: 1 }) // urgent first, then FIFO
    .limit(limit)
    .populate('recipient', 'preferences firebaseUid');
};

// Instance methods
NotificationSchema.methods.markAsRead = function() {
  this.interaction.isRead = true;
  this.interaction.readAt = new Date();
  return this.save();
};

NotificationSchema.methods.markAsClicked = function() {
  this.interaction.isClicked = true;
  this.interaction.clickedAt = new Date();
  if (!this.interaction.isRead) {
    this.interaction.isRead = true;
    this.interaction.readAt = new Date();
  }
  return this.save();
};

NotificationSchema.methods.markAsDismissed = function() {
  this.interaction.isDismissed = true;
  this.interaction.dismissedAt = new Date();
  return this.save();
};

NotificationSchema.methods.markAsSent = function(messageId, token) {
  this.delivery.status = 'sent';
  this.delivery.sentAt = new Date();
  if (messageId) this.fcm.messageId = messageId;
  if (token) this.fcm.token = token;
  return this.save();
};

NotificationSchema.methods.markAsDelivered = function() {
  this.delivery.status = 'delivered';
  this.delivery.deliveredAt = new Date();
  return this.save();
};

NotificationSchema.methods.markAsFailed = function(reason) {
  this.delivery.status = 'failed';
  this.delivery.failureReason = reason;
  this.delivery.retryCount += 1;
  return this.save();
};

NotificationSchema.methods.canRetry = function() {
  return this.delivery.status === 'failed' && this.delivery.retryCount < 3;
};

// Pre-save middleware
NotificationSchema.pre('save', function(next) {
  // Set default expiry if not provided
  if (!this.expiresAt) {
    const defaultExpiry = {
      'complaint_confirmed': 30, // days
      'complaint_acknowledged': 30,
      'complaint_in_progress': 30,
      'complaint_resolved': 60,
      'community_like': 7,
      'community_comment': 7,
      'system_announcement': 14
    };
    
    const days = defaultExpiry[this.type] || 7;
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  
  next();
});

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;