import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
  StyleSheet,
  Share,
  Animated,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { communityAPI, errorMessage } from '../api/client';
import { toCompressedDataUri } from '../utils/image';

import { tc, tct, themedStyles } from '../theme';
const { width } = Dimensions.get('window');

export default function CommunityScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({
    image: null,
    caption: '',
    location: null,
    category: 'general',
    isAnonymous: false
  });
  const [stories, setStories] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [activeStory, setActiveStory] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const categories = [
    { id: 'general', name: 'General', icon: 'chatbubble', color: tct('#FF4500') },
    { id: 'roads', name: 'Roads', icon: 'car', color: tct('#007BFF') },
    { id: 'water', name: 'Water', icon: 'water', color: tct('#17A2B8') },
    { id: 'electricity', name: 'Power', icon: 'flash', color: tct('#FFC107') },
    { id: 'garbage', name: 'Waste', icon: 'trash', color: tct('#28A745') },
    { id: 'safety', name: 'Safety', icon: 'shield', color: tct('#DC3545') },
    { id: 'parks', name: 'Parks', icon: 'leaf', color: tct('#6F42C1') },
    { id: 'noise', name: 'Noise', icon: 'volume-high', color: tct('#FD7E14') }
  ];

  useEffect(() => {
    loadCommunityPosts();
    loadStories();
  }, []);

  const loadCommunityPosts = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const response = await communityAPI.getPosts({ limit: 30 });
      setPosts(Array.isArray(response.posts) ? response.posts : []);
    } catch (error) {
      setLoadError(errorMessage(error, 'Could not load community posts.'));
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      const response = await communityAPI.getStories();
      setStories(Array.isArray(response.stories) ? response.stories : []);
    } catch {
      setStories([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCommunityPosts(), loadStories()]);
    setRefreshing(false);
  };

  const patchPost = (postId, patch) =>
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));

  // Optimistic like: update immediately, then trust the server's answer (or roll back)
  const handleLike = async (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    patchPost(postId, { isLiked: !post.isLiked, likesCount: post.likesCount + (post.isLiked ? -1 : 1) });
    try {
      const res = await communityAPI.likePost(postId);
      patchPost(postId, { isLiked: !!res.isLiked, likesCount: res.likesCount ?? post.likesCount });
    } catch (error) {
      patchPost(postId, { isLiked: post.isLiked, likesCount: post.likesCount });
      Alert.alert('Could not like post', errorMessage(error));
    }
  };

  const handleVote = async (postId, voteType) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    let { upvotes, downvotes } = post;
    let userVote = post.userVote;
    if (voteType === 'up') {
      if (userVote === 'up') { upvotes -= 1; userVote = null; }
      else { upvotes += 1; if (userVote === 'down') downvotes -= 1; userVote = 'up'; }
    } else {
      if (userVote === 'down') { downvotes -= 1; userVote = null; }
      else { downvotes += 1; if (userVote === 'up') upvotes -= 1; userVote = 'down'; }
    }
    patchPost(postId, { upvotes, downvotes, userVote });
    try {
      const res = await communityAPI.votePost(postId, voteType);
      patchPost(postId, { upvotes: res.upvotes, downvotes: res.downvotes, userVote: res.userVote });
    } catch (error) {
      patchPost(postId, { upvotes: post.upvotes, downvotes: post.downvotes, userVote: post.userVote });
      Alert.alert('Could not vote', errorMessage(error));
    }
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `Check out this post on NagarMitra: ${post.caption}`,
        title: 'NagarMitra Community Post',
      });
      communityAPI.sharePost(post.id).catch(() => {});
    } catch {
      // user dismissed the share sheet
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access in your phone settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) setNewPost((prev) => ({ ...prev, image: result.assets[0] }));
    } catch {
      Alert.alert('Error', 'Could not open your gallery.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access in your phone settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled && result.assets?.length) setNewPost((prev) => ({ ...prev, image: result.assets[0] }));
    } catch {
      Alert.alert('Error', 'Could not open the camera.');
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow location access to tag your post.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let address = 'Current location';
      try {
        const [g] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (g) address = [g.street || g.name, g.city].filter(Boolean).join(', ') || address;
      } catch {
        // keep generic label
      }
      setNewPost((prev) => ({
        ...prev,
        location: { address, coordinates: [location.coords.longitude, location.coords.latitude] },
      }));
    } catch {
      Alert.alert('Location error', 'Could not get your location. Make sure GPS is on.');
    }
  };

  const submitPost = async () => {
    if (!newPost.caption.trim()) {
      Alert.alert('Add a caption', 'Please write something about your post.');
      return;
    }
    try {
      setLoading(true);
      const image = newPost.image ? await toCompressedDataUri(newPost.image.uri, { maxWidth: 900 }) : undefined;
      const res = await communityAPI.createPost({
        caption: newPost.caption.trim(),
        category: newPost.category,
        location: newPost.location || undefined,
        isAnonymous: newPost.isAnonymous,
        image,
      });
      if (res.post) setPosts((prev) => [res.post, ...prev]);
      setShowCreateModal(false);
      setNewPost({ image: null, caption: '', location: null, category: 'general', isAnonymous: false });
      loadStories();
    } catch (error) {
      Alert.alert('Could not post', errorMessage(error, 'Failed to create post. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (post) => {
    Alert.alert('Delete post?', 'This will remove your post for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await communityAPI.deletePost(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            loadStories();
          } catch (error) {
            Alert.alert('Could not delete', errorMessage(error));
          }
        },
      },
    ]);
  };

  const renderStoryViewer = () => (
    <Modal visible={!!activeStory} transparent animationType="fade" onRequestClose={() => setActiveStory(null)}>
      <TouchableOpacity style={styles.storyViewer} activeOpacity={1} onPress={() => setActiveStory(null)}>
        {activeStory && (
          <>
            <Text style={styles.storyViewerName}>{activeStory.username}</Text>
            {activeStory.image ? (
              <Image source={{ uri: activeStory.image }} style={styles.storyViewerImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.storyViewerCaption}>{activeStory.caption}</Text>
            <Text style={styles.storyViewerHint}>Tap anywhere to close</Text>
          </>
        )}
      </TouchableOpacity>
    </Modal>
  );

  const renderHeader = () => {
    const headerOpacity = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [1, 0.9],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle" size={28} color={tct('#FF4500')} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications" size={24} color={tct('#333')} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderStories = () => (
    <View style={styles.storiesContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity style={styles.addStoryButton} onPress={() => setShowCreateModal(true)}>
          <View style={styles.addStoryIcon}>
            <Ionicons name="add" size={24} color={tct('#FF4500')} />
          </View>
          <Text style={styles.storyText}>Your Story</Text>
        </TouchableOpacity>
        {stories.map((story) => (
          <TouchableOpacity
            key={story.id}
            style={styles.storyItem}
            onPress={() => {
              setActiveStory(story);
              setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s)));
            }}
          >
            <View style={[styles.storyRing, { borderColor: story.viewed ? tc('#DDD') : tc('#FF4500') }]}>
              <Avatar uri={story.image || story.avatar} name={story.username} style={styles.storyAvatar} />
            </View>
            <Text style={styles.storyText} numberOfLines={1}>{story.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPost = (post) => (
    <View key={post.id} style={styles.postContainer}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.postAuthorInfo}>
          <Avatar uri={post.author?.avatar} name={post.author?.name} style={styles.authorAvatar} />
          <View>
            <Text style={styles.authorName}>{post.author?.name || 'Citizen'}</Text>
            <View style={styles.postMeta}>
              <Text style={styles.postTime}>{formatTime(post.timestamp)}</Text>
              {post.location && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Ionicons name="location" size={12} color={tct('#666')} />
                  <Text style={styles.postLocation}>{post.location.address}</Text>
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.postHeaderActions}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(post.category) }]}>
            <Ionicons name={getCategoryIcon(post.category)} size={12} color="#FFF" />
            <Text style={styles.categoryText}>{String(post.category || 'general').toUpperCase()}</Text>
          </View>
          {post.isMine && (
            <TouchableOpacity style={styles.postMenuButton} onPress={() => confirmDelete(post)}>
              <Ionicons name="trash-outline" size={20} color={tct('#999')} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Post Image */}
      {post.image && (
        <View style={styles.postImageContainer}>
          <Image source={{ uri: post.image }} style={styles.postImage} />
        </View>
      )}

      {/* Post Caption */}
      <View style={styles.postContent}>
        <Text style={styles.postCaption}>{post.caption}</Text>
      </View>

      {/* Post Actions */}
      <View style={styles.postActions}>
        <View style={styles.leftActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleLike(post.id)}
          >
            <Ionicons 
              name={post.isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={post.isLiked ? tc('#FF3040') : tc('#333')} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color={tct('#333')} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(post)}>
            <Ionicons name="paper-plane-outline" size={22} color={tct('#333')} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.voteActions}>
          <TouchableOpacity 
            style={[styles.voteButton, post.userVote === 'up' && styles.voteButtonActive]}
            onPress={() => handleVote(post.id, 'up')}
          >
            <Ionicons name="chevron-up" size={20} color={post.userVote === 'up' ? tc('#FF4500') : tc('#666')} />
            <Text style={[styles.voteCount, post.userVote === 'up' && styles.voteCountActive]}>
              {post.upvotes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.voteButton, post.userVote === 'down' && styles.voteButtonActive]}
            onPress={() => handleVote(post.id, 'down')}
          >
            <Ionicons name="chevron-down" size={20} color={post.userVote === 'down' ? tc('#FF4500') : tc('#666')} />
            <Text style={[styles.voteCount, post.userVote === 'down' && styles.voteCountActive]}>
              {post.downvotes}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post Stats */}
      <View style={styles.postStats}>
        <Text style={styles.likesCount}>{post.likesCount} likes</Text>
        {post.commentsCount > 0 && (
          <TouchableOpacity>
            <Text style={styles.commentsLink}>View all {post.commentsCount} comments</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderCreateModal = () => (
    <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCreateModal(false)}>
            <Text style={styles.modalCancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Post</Text>
          <TouchableOpacity onPress={submitPost} disabled={loading}>
            <Text style={[styles.modalSubmitButton, loading && styles.modalSubmitButtonDisabled]}>
              {loading ? 'Posting...' : 'Share'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Image Selection */}
          <View style={styles.imageSection}>
            {newPost.image ? (
              <View style={styles.selectedImageContainer}>
                <Image source={{ uri: newPost.image.uri }} style={styles.selectedImage} />
                <TouchableOpacity 
                  style={styles.removeImageButton} 
                  onPress={() => setNewPost(prev => ({ ...prev, image: null }))}
                >
                  <Ionicons name="close-circle" size={24} color={tct('#FF3040')} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.imageOptions}>
                  <TouchableOpacity style={styles.imageOptionButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={30} color={tct('#FF4500')} />
                    <Text style={styles.imageOptionText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageOptionButton} onPress={pickImage}>
                    <Ionicons name="image" size={30} color={tct('#FF4500')} />
                    <Text style={styles.imageOptionText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Caption Input */}
          <TextInput
            style={styles.captionInput}
            placeholderTextColor={tc('#999')}
            multiline
            placeholder="What's happening in your community?"
            value={newPost.caption}
            onChangeText={(text) => setNewPost(prev => ({ ...prev, caption: text }))}
            maxLength={500}
          />

          {/* Category Selection */}
          <View style={styles.categorySection}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: newPost.category === category.id ? category.color : '#F8F9FA' }
                  ]}
                  onPress={() => setNewPost(prev => ({ ...prev, category: category.id }))}
                >
                  <Ionicons 
                    name={category.icon} 
                    size={16} 
                    color={newPost.category === category.id ? '#FFF' : category.color} 
                  />
                  <Text style={[
                    styles.categoryChipText,
                    { color: newPost.category === category.id ? '#FFF' : tc('#333') }
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Location Section */}
          <View style={styles.locationSection}>
            <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
              <Ionicons name="location" size={20} color={tct('#FF4500')} />
              <Text style={styles.locationButtonText}>
                {newPost.location ? newPost.location.address : 'Add Location'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Anonymous Toggle */}
          <View style={styles.anonymousSection}>
            <TouchableOpacity 
              style={styles.anonymousToggle}
              onPress={() => setNewPost(prev => ({ ...prev, isAnonymous: !prev.isAnonymous }))}
            >
              <Ionicons 
                name={newPost.isAnonymous ? "checkbox" : "square-outline"} 
                size={20} 
                color={tct('#FF4500')} 
              />
              <Text style={styles.anonymousText}>Post anonymously</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <Animated.ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tc('#FF4500')]} />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {renderStories()}
        {loadError ? (
          <TouchableOpacity style={styles.errorBanner} onPress={onRefresh}>
            <Ionicons name="cloud-offline-outline" size={18} color={tct('#DC3545')} />
            <Text style={styles.errorBannerText}>{loadError} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}
        {loading && posts.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length > 0 ? (
          posts.map(renderPost)
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles" size={64} color={tct('#DDD')} />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share something with your community!</Text>
            <TouchableOpacity 
              style={styles.createFirstPostButton} 
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.createFirstPostText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.ScrollView>
      {renderCreateModal()}
      {renderStoryViewer()}
    </View>
  );
}

// Photo when there is one, otherwise the person's initial
function Avatar({ uri, name, style }) {
  if (uri) return <Image source={{ uri }} style={style} />;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[style, { backgroundColor: tc('#FFE1D4'), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: tct('#FF4500'), fontWeight: 'bold', fontSize: 16 }}>{initial}</Text>
    </View>
  );
}

// Helper functions
const formatTime = (timestamp) => {
  const now = new Date();
  const postTime = new Date(timestamp);
  const diffMs = now - postTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return postTime.toLocaleDateString();
};

const getCategoryColor = (category) => {
  const colors = {
    general: tc('#FF4500'),
    roads: tc('#007BFF'),
    water: tc('#17A2B8'),
    electricity: tc('#FFC107'),
    garbage: tc('#28A745'),
    safety: tc('#DC3545'),
    parks: tc('#6F42C1'),
    noise: tc('#FD7E14')
  };
  return colors[category] || tc('#FF4500');
};

const getCategoryIcon = (category) => {
  const icons = {
    general: 'chatbubble',
    roads: 'car',
    water: 'water',
    electricity: 'flash',
    garbage: 'trash',
    safety: 'shield',
    parks: 'leaf',
    noise: 'volume-high'
  };
  return icons[category] || 'chatbubble';
};

const styles = themedStyles(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc('#FFF')
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tc('#FFEBEE'),
    padding: 12,
    margin: 12,
    borderRadius: 8
  },
  errorBannerText: {
    flex: 1,
    color: tct('#DC3545'),
    fontSize: 13
  },
  storyViewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  storyViewerName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16
  },
  storyViewerImage: {
    width: '100%',
    height: '60%'
  },
  storyViewerCaption: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16
  },
  storyViewerHint: {
    color: tct('#AAA'),
    fontSize: 12,
    marginTop: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: tc('#FFF'),
    borderBottomWidth: 1,
    borderBottomColor: tc('#E5E5E5')
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: tct('#333')
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerButton: {
    marginLeft: 16
  },
  scrollView: {
    flex: 1
  },
  storiesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: tc('#F0F0F0')
  },
  addStoryButton: {
    alignItems: 'center',
    marginRight: 12
  },
  addStoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tc('#F8F9FA'),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tc('#FF4500'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 12
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    padding: 2,
    marginBottom: 4
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28
  },
  storyText: {
    fontSize: 12,
    color: tct('#333'),
    maxWidth: 60,
    textAlign: 'center'
  },
  postContainer: {
    backgroundColor: tc('#FFF'),
    marginBottom: 8,
    paddingBottom: 12
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: tct('#333')
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  postTime: {
    fontSize: 12,
    color: tct('#666')
  },
  metaDot: {
    fontSize: 12,
    color: tct('#666'),
    marginHorizontal: 4
  },
  postLocation: {
    fontSize: 12,
    color: tct('#666'),
    marginLeft: 2
  },
  postHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8
  },
  categoryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 4
  },
  postMenuButton: {
    padding: 4
  },
  postImageContainer: {
    width: width,
    height: width * 0.75
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  postContent: {
    paddingHorizontal: 16,
    paddingTop: 12
  },
  postCaption: {
    fontSize: 15,
    lineHeight: 20,
    color: tct('#333')
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionButton: {
    marginRight: 16,
    padding: 4
  },
  voteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tc('#F8F9FA'),
    borderRadius: 20,
    paddingHorizontal: 4
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  voteButtonActive: {
    backgroundColor: tc('#FFF5F0')
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '600',
    color: tct('#666'),
    marginLeft: 2
  },
  voteCountActive: {
    color: tct('#FF4500')
  },
  postStats: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: tct('#333'),
    marginBottom: 4
  },
  commentsLink: {
    fontSize: 14,
    color: tct('#666')
  },
  modalContainer: {
    flex: 1,
    backgroundColor: tc('#FFF')
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tc('#E5E5E5')
  },
  modalCancelButton: {
    fontSize: 16,
    color: tct('#666')
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tct('#333')
  },
  modalSubmitButton: {
    fontSize: 16,
    fontWeight: '600',
    color: tct('#FF4500')
  },
  modalSubmitButtonDisabled: {
    color: tct('#CCC')
  },
  modalContent: {
    flex: 1,
    padding: 16
  },
  imageSection: {
    marginBottom: 16
  },
  selectedImageContainer: {
    position: 'relative',
    alignSelf: 'center'
  },
  selectedImage: {
    width: width - 32,
    height: (width - 32) * 0.75,
    borderRadius: 12
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8
  },
  imagePlaceholder: {
    height: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tc('#DDD'),
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageOptions: {
    flexDirection: 'row',
    gap: 40
  },
  imageOptionButton: {
    alignItems: 'center'
  },
  imageOptionText: {
    marginTop: 8,
    fontSize: 14,
    color: tct('#666')
  },
  captionInput: {
    color: tct('#1A1A1A'),
    borderWidth: 1,
    borderColor: tc('#E5E5E5'),
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 16
  },
  categorySection: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tct('#333'),
    marginBottom: 12
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: tc('#E5E5E5')
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4
  },
  locationSection: {
    marginBottom: 16
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: tc('#E5E5E5'),
    borderRadius: 8
  },
  locationButtonText: {
    fontSize: 16,
    color: tct('#333'),
    marginLeft: 8
  },
  anonymousSection: {
    marginBottom: 16
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  anonymousText: {
    fontSize: 16,
    color: tct('#333'),
    marginLeft: 8
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  loadingText: {
    fontSize: 16,
    color: tct('#666'),
    marginTop: 12
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: tct('#333'),
    marginTop: 16,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 14,
    color: tct('#666'),
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20
  },
  createFirstPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tc('#FF4500'),
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24
  },
  createFirstPostText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8
  }
}));
