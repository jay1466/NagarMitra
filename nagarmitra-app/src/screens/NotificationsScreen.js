import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, confirmed, acknowledged, resolved

  // Mock notifications data - replace with API call
  const mockNotifications = [
    {
      id: '1',
      title: 'Report Resolved! 🎉',
      message: 'Great news! Your reported pothole on MG Road has been resolved',
      type: 'resolved',
      reportId: 'NM2024001234',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
    },
    {
      id: '2',
      title: 'Report Under Review 🔍',
      message: 'Authorities are reviewing your report about street lighting',
      type: 'acknowledged',
      reportId: 'NM2024001233',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      read: true,
    },
    {
      id: '3',
      title: 'Report Confirmed ✅',
      message: 'Your report #NM2024001232 has been received by authorities',
      type: 'confirmed',
      reportId: 'NM2024001232',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      read: true,
    },
    {
      id: '4',
      title: 'Report Resolved! 🎉',
      message: 'Your reported garbage issue on Park Street has been resolved',
      type: 'resolved',
      reportId: 'NM2024001231',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      read: true,
    },
    {
      id: '5',
      title: 'Report Under Review 🔍',
      message: 'Water supply complaint is being investigated by the authorities',
      type: 'acknowledged',
      reportId: 'NM2024001230',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      read: true,
    },
  ];

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      // Replace with actual API call
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'confirmed':
        return { name: 'checkmark-circle', color: '#28A745' };
      case 'acknowledged':
        return { name: 'time', color: '#FFC107' };
      case 'resolved':
        return { name: 'checkmark-done-circle', color: '#17A2B8' };
      default:
        return { name: 'notifications', color: '#FF4500' };
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const diffInMilliseconds = now - timestamp;
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    return notification.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filterButtons = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'confirmed', label: 'Confirmed', count: notifications.filter(n => n.type === 'confirmed').length },
    { key: 'acknowledged', label: 'Reviewing', count: notifications.filter(n => n.type === 'acknowledged').length },
    { key: 'resolved', label: 'Resolved', count: notifications.filter(n => n.type === 'resolved').length },
  ];

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unreadNotification]}
        onPress={() => {
          // Navigate to report details or mark as read
          navigation.navigate('Dashboard');
        }}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Ionicons name={icon.name} size={24} color={icon.color} />
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
              <View style={styles.notificationMeta}>
                <Text style={styles.reportId}>#{item.reportId}</Text>
                <Text style={styles.timestamp}>{getTimeAgo(item.timestamp)}</Text>
              </View>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (filterItem) => (
    <TouchableOpacity
      key={filterItem.key}
      style={[
        styles.filterButton,
        filter === filterItem.key && styles.activeFilterButton
      ]}
      onPress={() => setFilter(filterItem.key)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterItem.key && styles.activeFilterButtonText
      ]}>
        {filterItem.label}
        {filterItem.count > 0 && (
          <Text style={styles.filterCount}> ({filterItem.count})</Text>
        )}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filterButtons.map(renderFilterButton)}
      </ScrollView>

      {/* Notifications List */}
      {filteredNotifications.length > 0 ? (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={64} color="#CCC" />
          <Text style={styles.emptyStateTitle}>No notifications</Text>
          <Text style={styles.emptyStateMessage}>
            {filter === 'all'
              ? "You don't have any notifications yet"
              : `No ${filter} notifications found`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginRight: 24, // To center align considering the back button
  },
  unreadBadge: {
    backgroundColor: '#FF4500',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 10,
  },
  activeFilterButton: {
    backgroundColor: '#FF4500',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#FFF',
  },
  filterCount: {
    fontSize: 12,
  },
  listContainer: {
    paddingTop: 10,
  },
  notificationItem: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  unreadNotification: {
    backgroundColor: '#FFF9E6',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 5,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportId: {
    fontSize: 12,
    color: '#FF4500',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4500',
    marginLeft: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NotificationsScreen;