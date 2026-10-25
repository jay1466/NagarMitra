import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, required: true, index: true },
    email: { type: String, required: true },
    displayName: { type: String },
    phoneNumber: { type: String },
    photoURL: { type: String },
    
    // Profile information
    profile: {
      firstName: { type: String },
      lastName: { type: String },
      address: { type: String },
      wardCode: { type: String },
      pincode: { type: String },
      city: { type: String, default: 'Bhubaneswar' },
      preferredLanguage: { type: String, enum: ['en', 'hi', 'or'], default: 'en' },
    },
    
    // User preferences
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
      communityUpdates: { type: Boolean, default: true },
      issueUpdates: { type: Boolean, default: true },
    },
    
    // User statistics
    stats: {
      complaintsSubmitted: { type: Number, default: 0 },
      complaintsResolved: { type: Number, default: 0 },
      communityScore: { type: Number, default: 0 }, // for gamification
      contributionPoints: { type: Number, default: 0 },
    },
    
    // Account status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    
    // Location for location-based features
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' }, // [lng, lat]
    },
  },
  { timestamps: true }
);

// Create indexes
UserSchema.index({ 'profile.wardCode': 1 });
UserSchema.index({ 'profile.city': 1 });
UserSchema.index({ location: '2dsphere' });

// Static methods
UserSchema.statics.findByFirebaseUid = function(uid) {
  return this.findOne({ firebaseUid: uid });
};

UserSchema.statics.createFromFirebaseUser = function(firebaseUser) {
  return this.create({
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    phoneNumber: firebaseUser.phoneNumber,
    photoURL: firebaseUser.photoURL,
    lastLoginAt: new Date(),
  });
};

// Instance methods
UserSchema.methods.updateLoginTime = function() {
  this.lastLoginAt = new Date();
  return this.save();
};

UserSchema.methods.incrementComplaintCount = function() {
  this.stats.complaintsSubmitted += 1;
  this.stats.contributionPoints += 10; // Award points for submitting
  return this.save();
};

UserSchema.methods.incrementResolvedCount = function() {
  this.stats.complaintsResolved += 1;
  this.stats.contributionPoints += 50; // Award more points for resolution
  this.stats.communityScore += 5;
  return this.save();
};

const User = mongoose.model('User', UserSchema);
export default User;