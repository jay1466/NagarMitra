import mongoose from 'mongoose';

const ComplaintSchema = new mongoose.Schema(
  {
    reportId: { type: String, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'Potholes',
        'Sanitation',
        'Waste Management',
        'Water Supply',
        'Electricity & Lighting',
        'Miscellaneous',
      ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected'],
      default: 'submitted',
      index: true,
    },
    address: { type: String },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' }, // [lng, lat]
    },
    wardCode: { type: String, index: true },
    media: [{ type: String }], // store S3 keys for now
    
    // Firebase Auth integration
    firebaseUid: { type: String, index: true },
    firebaseEmail: { type: String },
    
    // Status tracking
    statusHistory: [{
      status: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String },
      notes: { type: String }
    }],
    
    // Response tracking
    acknowledgmentDate: { type: Date },
    startDate: { type: Date }, // When work started
    completionDate: { type: Date }, // When resolved
    estimatedCompletionDate: { type: Date },
    
    // Admin/Authority fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedDepartment: { type: String },
    internalNotes: [{
      note: { type: String },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: { type: Date, default: Date.now },
      isPublic: { type: Boolean, default: false }
    }],
    
    // Engagement tracking
    views: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Quality control
    isPublic: { type: Boolean, default: true },
    isAnonymous: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'disputed', 'false_report'],
      default: 'pending'
    },
    
    // Location details
    exactLocation: { type: String }, // More specific than address
    landmarks: [{ type: String }],
    
    // Resolution details
    resolutionDetails: {
      description: { type: String },
      beforeImages: [{ type: String }], // S3 keys
      afterImages: [{ type: String }], // S3 keys
      cost: { type: Number },
      contractor: { type: String },
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Additional indexes
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ firebaseUid: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, wardCode: 1 });
ComplaintSchema.index({ verificationStatus: 1 });
ComplaintSchema.index({ assignedTo: 1, status: 1 });

// Virtual properties
ComplaintSchema.virtual('daysOpen').get(function() {
  const now = new Date();
  const created = this.createdAt;
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

ComplaintSchema.virtual('responseTime').get(function() {
  if (!this.acknowledgmentDate) return null;
  return Math.floor((this.acknowledgmentDate - this.createdAt) / (1000 * 60 * 60)); // hours
});

ComplaintSchema.virtual('resolutionTime').get(function() {
  if (!this.completionDate) return null;
  return Math.floor((this.completionDate - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

ComplaintSchema.virtual('netScore').get(function() {
  return this.upvotes - this.downvotes;
});

function pad(num, size) {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

ComplaintSchema.statics.generateReportId = async function (wardCode = 'WARD') {
  const today = new Date();
  const y = today.getFullYear();
  const m = pad(today.getMonth() + 1, 2);
  const d = pad(today.getDate(), 2);
  // naive sequence per day
  const prefix = `NM-${wardCode}-${y}${m}${d}`;
  const count = await this.countDocuments({ reportId: new RegExp(`^${prefix}`) });
  const seq = pad(count + 1, 4);
  return `${prefix}-${seq}`;
};

// Instance methods
ComplaintSchema.methods.updateStatus = function(newStatus, changedBy, reason, notes) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    changedBy,
    reason,
    notes
  });
  
  // Update specific date fields
  const now = new Date();
  switch (newStatus) {
    case 'acknowledged':
      this.acknowledgmentDate = now;
      break;
    case 'in_progress':
      this.startDate = now;
      break;
    case 'resolved':
      this.completionDate = now;
      break;
  }
  
  return this.save();
};

ComplaintSchema.methods.toggleVote = function(userId, voteType) {
  const isUpvoted = this.upvotedBy.includes(userId);
  const isDownvoted = this.downvotedBy.includes(userId);
  
  if (voteType === 'up') {
    if (isUpvoted) {
      // Remove upvote
      this.upvotedBy.pull(userId);
      this.upvotes = Math.max(0, this.upvotes - 1);
    } else {
      // Add upvote
      this.upvotedBy.push(userId);
      this.upvotes += 1;
      
      // Remove downvote if exists
      if (isDownvoted) {
        this.downvotedBy.pull(userId);
        this.downvotes = Math.max(0, this.downvotes - 1);
      }
    }
  } else if (voteType === 'down') {
    if (isDownvoted) {
      // Remove downvote
      this.downvotedBy.pull(userId);
      this.downvotes = Math.max(0, this.downvotes - 1);
    } else {
      // Add downvote
      this.downvotedBy.push(userId);
      this.downvotes += 1;
      
      // Remove upvote if exists
      if (isUpvoted) {
        this.upvotedBy.pull(userId);
        this.upvotes = Math.max(0, this.upvotes - 1);
      }
    }
  }
  
  return this.save();
};

ComplaintSchema.methods.addInternalNote = function(note, addedBy, isPublic = false) {
  this.internalNotes.push({
    note,
    addedBy,
    isPublic
  });
  return this.save();
};

ComplaintSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

ComplaintSchema.methods.markAsResolved = function(resolutionDetails, completedBy) {
  this.status = 'resolved';
  this.completionDate = new Date();
  this.resolutionDetails = { ...this.resolutionDetails, ...resolutionDetails, completedBy };
  
  this.statusHistory.push({
    status: 'resolved',
    changedBy: completedBy,
    notes: resolutionDetails.description
  });
  
  return this.save();
};

// Static methods for analytics
ComplaintSchema.statics.getStatsByWard = function(wardCode) {
  return this.aggregate([
    { $match: wardCode ? { wardCode } : {} },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
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
    }
  ]);
};

ComplaintSchema.statics.getTrendData = function(days = 30, wardCode = null) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const match = { createdAt: { $gte: startDate } };
  if (wardCode) match.wardCode = wardCode;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          category: '$category'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);
};

const Complaint = mongoose.model('Complaint', ComplaintSchema);
export default Complaint;
