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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { auth } from '../lib/firebase';
import { apiGet, apiPost } from '../api/client';

const { width, height } = Dimensions.get('window');

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
  const scrollY = useRef(new Animated.Value(0)).current;

  const categories = [
    { id: 'general', name: 'General', icon: 'chatbubble', color: '#FF4500' },
    { id: 'roads', name: 'Roads', icon: 'car', color: '#007BFF' },
    { id: 'water', name: 'Water', icon: 'water', color: '#17A2B8' },
    { id: 'electricity', name: 'Power', icon: 'flash', color: '#FFC107' },
    { id: 'garbage', name: 'Waste', icon: 'trash', color: '#28A745' },
    { id: 'safety', name: 'Safety', icon: 'shield', color: '#DC3545' },
    { id: 'parks', name: 'Parks', icon: 'leaf', color: '#6F42C1' },
    { id: 'noise', name: 'Noise', icon: 'volume-high', color: '#FD7E14' }
  ];

  useEffect(() => {
    loadCommunityPosts();
    loadStories();
  }, []);

  const loadCommunityPosts = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/v1/community/posts');
      // Use mock data if no posts are returned
      const postsData = response.posts && response.posts.length > 0 ? response.posts : mockPosts;
      setPosts(postsData);
      console.log(`📱 Loaded ${postsData.length} community posts (${response.posts?.length || 0} from API, ${postsData === mockPosts ? mockPosts.length : 0} mock)`);
    } catch (error) {
      console.log('Error loading posts:', error);
      setPosts(mockPosts); // Use mock data if API fails
      console.log(`📱 Using ${mockPosts.length} mock posts due to API error`);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      const response = await apiGet('/api/v1/community/stories');
      // Use mock data if no stories are returned
      const storiesData = response.stories && response.stories.length > 0 ? response.stories : mockStories;
      setStories(storiesData);
      console.log(`📸 Loaded ${storiesData.length} community stories`);
    } catch (error) {
      console.log('Error loading stories:', error);
      setStories(mockStories);
      console.log(`📸 Using ${mockStories.length} mock stories due to API error`);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCommunityPosts(), loadStories()]);
    setRefreshing(false);
  };

  const handleLike = async (postId) => {
    try {
      const updatedPosts = posts.map(post => {
        if (post.id === postId) {
          const isLiked = post.isLiked;
          return {
            ...post,
            isLiked: !isLiked,
            likesCount: isLiked ? post.likesCount - 1 : post.likesCount + 1
          };
        }
        return post;
      });
      setPosts(updatedPosts);

      // API call to update like status
      await apiPost(`/api/v1/community/posts/${postId}/like`, {});
    } catch (error) {
      console.log('Error updating like:', error);
    }
  };

  const handleVote = async (postId, voteType) => {
    try {
      const updatedPosts = posts.map(post => {
        if (post.id === postId) {
          let newUpvotes = post.upvotes;
          let newDownvotes = post.downvotes;
          
          if (voteType === 'up') {
            if (post.userVote === 'up') {
              newUpvotes -= 1;
              post.userVote = null;
            } else {
              newUpvotes += 1;
              if (post.userVote === 'down') newDownvotes -= 1;
              post.userVote = 'up';
            }
          } else {
            if (post.userVote === 'down') {
              newDownvotes -= 1;
              post.userVote = null;
            } else {
              newDownvotes += 1;
              if (post.userVote === 'up') newUpvotes -= 1;
              post.userVote = 'down';
            }
          }
          
          return { ...post, upvotes: newUpvotes, downvotes: newDownvotes };
        }
        return post;
      });
      setPosts(updatedPosts);

      await apiPost(`/api/v1/community/posts/${postId}/vote`, { type: voteType });
    } catch (error) {
      console.log('Error updating vote:', error);
    }
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `Check out this post from NagarMitra: ${post.caption}\n\nJoin the community: https://nagarmitra.app`,
        title: 'NagarMitra Community Post'
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewPost(prev => ({ ...prev, image: result.assets[0] }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewPost(prev => ({ ...prev, image: result.assets[0] }));
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        setNewPost(prev => ({
          ...prev,
          location: {
            coords: location.coords,
            address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Current Location'
          }
        }));
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const submitPost = async () => {
    if (!newPost.caption.trim() && !newPost.image) {
      Alert.alert('Error', 'Please add a caption or image');
      return;
    }

    try {
      setLoading(true);
      
      const postData = {
        caption: newPost.caption,
        category: newPost.category,
        location: newPost.location,
        isAnonymous: newPost.isAnonymous,
        image: newPost.image?.uri
      };

      await apiPost('/api/v1/community/posts', postData);
      
      // Add to local state immediately for better UX
      const newPostObj = {
        id: Date.now().toString(),
        ...postData,
        author: newPost.isAnonymous ? { name: 'Anonymous', avatar: null } : {
          name: auth.currentUser?.displayName || 'User',
          avatar: auth.currentUser?.photoURL
        },
        timestamp: new Date().toISOString(),
        likesCount: 0,
        commentsCount: 0,
        upvotes: 0,
        downvotes: 0,
        isLiked: false,
        userVote: null
      };

      setPosts(prev => [newPostObj, ...prev]);
      setShowCreateModal(false);
      setNewPost({ image: null, caption: '', location: null, category: 'general', isAnonymous: false });
      
    } catch (error) {
      console.log('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
            <Ionicons name="add-circle" size={28} color="#FF4500" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications" size={24} color="#333" />
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
            <Ionicons name="add" size={24} color="#FF4500" />
          </View>
          <Text style={styles.storyText}>Your Story</Text>
        </TouchableOpacity>
        {stories.map((story) => (
          <TouchableOpacity key={story.id} style={styles.storyItem}>
            <View style={[styles.storyRing, { borderColor: story.viewed ? '#DDD' : '#FF4500' }]}>
              <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
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
          <Image 
            source={{ uri: post.author.avatar || 'https://via.placeholder.com/40' }} 
            style={styles.authorAvatar} 
          />
          <View>
            <Text style={styles.authorName}>{post.author.name}</Text>
            <View style={styles.postMeta}>
              <Text style={styles.postTime}>{formatTime(post.timestamp)}</Text>
              {post.location && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Ionicons name="location" size={12} color="#666" />
                  <Text style={styles.postLocation}>{post.location.address}</Text>
                </>
              )}
            </View>
          </View>
        </View>
        <View style={styles.postHeaderActions}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(post.category) }]}>
            <Ionicons name={getCategoryIcon(post.category)} size={12} color="#FFF" />
            <Text style={styles.categoryText}>{post.category.toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={styles.postMenuButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
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
              color={post.isLiked ? "#FF3040" : "#333"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(post)}>
            <Ionicons name="paper-plane-outline" size={22} color="#333" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.voteActions}>
          <TouchableOpacity 
            style={[styles.voteButton, post.userVote === 'up' && styles.voteButtonActive]}
            onPress={() => handleVote(post.id, 'up')}
          >
            <Ionicons name="chevron-up" size={20} color={post.userVote === 'up' ? "#FF4500" : "#666"} />
            <Text style={[styles.voteCount, post.userVote === 'up' && styles.voteCountActive]}>
              {post.upvotes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.voteButton, post.userVote === 'down' && styles.voteButtonActive]}
            onPress={() => handleVote(post.id, 'down')}
          >
            <Ionicons name="chevron-down" size={20} color={post.userVote === 'down' ? "#FF4500" : "#666"} />
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
    <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
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
                  <Ionicons name="close-circle" size={24} color="#FF3040" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.imageOptions}>
                  <TouchableOpacity style={styles.imageOptionButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={30} color="#FF4500" />
                    <Text style={styles.imageOptionText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageOptionButton} onPress={pickImage}>
                    <Ionicons name="image" size={30} color="#FF4500" />
                    <Text style={styles.imageOptionText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Caption Input */}
          <TextInput
            style={styles.captionInput}
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
                    { color: newPost.category === category.id ? '#FFF' : '#333' }
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
              <Ionicons name="location" size={20} color="#FF4500" />
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
                color="#FF4500" 
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {renderStories()}
        {loading && posts.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length > 0 ? (
          posts.map(renderPost)
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles" size={64} color="#DDD" />
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
    general: '#FF4500',
    roads: '#007BFF',
    water: '#17A2B8',
    electricity: '#FFC107',
    garbage: '#28A745',
    safety: '#DC3545',
    parks: '#6F42C1',
    noise: '#FD7E14'
  };
  return colors[category] || '#FF4500';
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

// Mock data for development
const mockPosts = [
  {
    id: '1',
    _id: '1',
    author: { 
      name: 'Raj Patel', 
      displayName: 'Raj Patel',
      avatar: 'https://i.pravatar.cc/150?img=1' 
    },
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    caption: 'Pothole on MG Road causing traffic jams every morning. When will this be fixed? 😧',
    content: {
      caption: 'Pothole on MG Road causing traffic jams every morning. When will this be fixed? 😧'
    },
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
    category: 'roads',
    location: { address: 'MG Road, Bhubaneswar' },
    likesCount: 24,
    commentsCount: 8,
    upvotes: 156,
    downvotes: 3,
    isLiked: false,
    userVote: null,
    metrics: {
      likes: 24,
      comments: 8,
      shares: 5,
      views: 340
    }
  },
  {
    id: '2',
    _id: '2',
    author: { 
      name: 'Priya Singh', 
      displayName: 'Priya Singh',
      avatar: 'https://i.pravatar.cc/150?img=2' 
    },
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    caption: 'New park in Saheed Nagar looks amazing! Great job by the municipal corporation 👏',
    content: {
      caption: 'New park in Saheed Nagar looks amazing! Great job by the municipal corporation 👏'
    },
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
    category: 'parks',
    location: { address: 'Saheed Nagar, Bhubaneswar' },
    likesCount: 89,
    commentsCount: 15,
    upvotes: 234,
    downvotes: 5,
    isLiked: true,
    userVote: 'up',
    metrics: {
      likes: 89,
      comments: 15,
      shares: 12,
      views: 567
    }
  },
  {
    id: '3',
    _id: '3',
    author: { 
      name: 'Anonymous', 
      displayName: 'Anonymous',
      avatar: 'https://i.pravatar.cc/150?img=15' 
    },
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    caption: 'Water supply has been irregular for the past week in Unit 4. Please look into this urgently.',
    content: {
      caption: 'Water supply has been irregular for the past week in Unit 4. Please look into this urgently.'
    },
    category: 'water',
    location: { address: 'Unit 4, Bhubaneswar' },
    likesCount: 67,
    commentsCount: 12,
    upvotes: 89,
    downvotes: 2,
    isLiked: false,
    userVote: 'up',
    metrics: {
      likes: 67,
      comments: 12,
      shares: 8,
      views: 289
    }
  },
  {
    id: '4',
    _id: '4',
    author: { 
      name: 'Amit Kumar', 
      displayName: 'Amit Kumar',
      avatar: 'https://i.pravatar.cc/150?img=5' 
    },
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    caption: 'Electricity outage in Chandrasekharpur since morning. Any updates? ⚡',
    content: {
      caption: 'Electricity outage in Chandrasekharpur since morning. Any updates? ⚡'
    },
    category: 'electricity',
    location: { address: 'Chandrasekharpur, Bhubaneswar' },
    likesCount: 45,
    commentsCount: 18,
    upvotes: 78,
    downvotes: 1,
    isLiked: false,
    userVote: null,
    metrics: {
      likes: 45,
      comments: 18,
      shares: 6,
      views: 234
    }
  }
];

const mockStories = [
  { id: '1', username: 'RajP', avatar: 'https://i.pravatar.cc/150?img=1', viewed: false },
  { id: '2', username: 'PriyaS', avatar: 'https://i.pravatar.cc/150?img=2', viewed: true },
  { id: '3', username: 'ArunK', avatar: 'https://i.pravatar.cc/150?img=3', viewed: false },
  { id: '4', username: 'SitaM', avatar: 'https://i.pravatar.cc/150?img=4', viewed: true },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333'
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
    borderBottomColor: '#F0F0F0'
  },
  addStoryButton: {
    alignItems: 'center',
    marginRight: 12
  },
  addStoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FF4500',
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
    color: '#333',
    maxWidth: 60,
    textAlign: 'center'
  },
  postContainer: {
    backgroundColor: '#FFF',
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
    color: '#333'
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  postTime: {
    fontSize: 12,
    color: '#666'
  },
  metaDot: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 4
  },
  postLocation: {
    fontSize: 12,
    color: '#666',
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
    color: '#333'
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
    backgroundColor: '#F8F9FA',
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
    backgroundColor: '#FFF5F0'
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 2
  },
  voteCountActive: {
    color: '#FF4500'
  },
  postStats: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  commentsLink: {
    fontSize: 14,
    color: '#666'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#666'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  modalSubmitButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4500'
  },
  modalSubmitButtonDisabled: {
    color: '#CCC'
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
    borderColor: '#DDD',
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
    color: '#666'
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
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
    color: '#333',
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
    borderColor: '#E5E5E5'
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
    borderColor: '#E5E5E5',
    borderRadius: 8
  },
  locationButtonText: {
    fontSize: 16,
    color: '#333',
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
    color: '#333',
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
    color: '#666',
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
    color: '#333',
    marginTop: 16,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20
  },
  createFirstPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4500',
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
});
