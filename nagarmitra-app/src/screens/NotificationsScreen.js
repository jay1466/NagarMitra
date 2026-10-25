import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, errorMessage } from '../api/client';
import { useSession } from '../context/SessionContext';

import { tc, tct, themedStyles } from '../theme';
const NotificationsScreen = ({ navigation }) => {
  const { refreshUnread } = useSession();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, confirmed, acknowledged, resolved

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Server notification types → the three tabs this screen shows
  const TAB_FOR_TYPE = {
    complaint_confirmed: 'confirmed',
    complaint_assigned: 'acknowledged',
    complaint_acknowledged: 'acknowledged',
    complaint_in_progress: 'acknowledged',
    complaint_reminder: 'acknowledged',
    complaint_escalated: 'acknowledged',
    complaint_nudge: 'acknowledged',
    complaint_reopened: 'acknowledged',
    complaint_closed: 'resolved',
    complaint_resolved: 'resolved',
    complaint_rejected: 'resolved',
  };

  const toItem = (n) => ({
    id: n._id,
    type: n.type === 'complaint_escalated' ? 'escalated' : TAB_FOR_TYPE[n.type] || 'other',
    title: n.title,
    message: n.body,
    reportId: n.data?.reportId || n.relatedComplaint?.reportId || '',
    complaintId: n.relatedComplaint?._id || n.relatedComplaint || null,
    timestamp: new Date(n.createdAt),
    read: !!n.interaction?.isRead,
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setError('');
      const res = await userAPI.getNotifications({ limit: 50 });
      setNotifications((res.notifications || []).map(toItem));
    } catch (e) {
      setError(errorMessage(e, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const openNotification = (item) => {
    if (!item.read) {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      userAPI.markNotificationRead(item.id).then(refreshUnread).catch(() => {});
    }
    if (item.complaintId) navigation.navigate('ComplaintDetail', { id: String(item.complaintId) });
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    userAPI.markAllNotificationsRead().then(refreshUnread).catch(() => {});
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'confirmed':
        return { name: 'checkmark-circle', color: tct('#28A745') };
      case 'acknowledged':
        return { name: 'time', color: tct('#FFC107') };
      case 'resolved':
        return { name: 'checkmark-done-circle', color: tct('#17A2B8') };
      case 'escalated':
        return { name: 'alert-circle', color: tct('#C62828') };
      default:
        return { name: 'notifications', color: tct('#FF4500') };
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
    { key: 'acknowledged', label: 'In progress', count: notifications.filter(n => n.type === 'acknowledged').length },
    { key: 'escalated', label: 'Escalated', count: notifications.filter(n => n.type === 'escalated').length },
    { key: 'resolved', label: 'Resolved', count: notifications.filter(n => n.type === 'resolved').length },
  ];

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unreadNotification]}
        onPress={() => openNotification(item)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Ionicons name={icon.name} size={24} color={icon.color} />
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
              <View style={styles.notificationMeta}>
                {!!item.reportId && <Text style={styles.reportId}>#{item.reportId}</Text>}
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
          <Ionicons name="arrow-back" size={24} color={tct('#FF4500')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>Mark {unreadCount} read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
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
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={tct('#FF4500')} />
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={64} color={tct('#CCC')} />
          <Text style={styles.emptyStateTitle}>Couldn't load notifications</Text>
          <Text style={styles.emptyStateMessage}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); loadNotifications(); }} style={{ marginTop: 16 }}>
            <Text style={{ color: tct('#FF4500'), fontWeight: 'bold', fontSize: 16 }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : filteredNotifications.length > 0 ? (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tc('#FF4500')]} />
          }
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={64} color={tct('#CCC')} />
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

const styles = themedStyles(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc('#FFF'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: tc('#F0F0F0'),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tct('#000'),
    flex: 1,
    textAlign: 'center',
    marginRight: 24, // To center align considering the back button
  },
  unreadBadge: {
    backgroundColor: tc('#FF4500'),
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
    borderBottomColor: tc('#F0F0F0'),
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tc('#F8F9FA'),
    marginRight: 10,
  },
  activeFilterButton: {
    backgroundColor: tc('#FF4500'),
  },
  filterButtonText: {
    fontSize: 14,
    color: tct('#666'),
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
    backgroundColor: tc('#FFF'),
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: tc('#F8F8F8'),
  },
  unreadNotification: {
    backgroundColor: tc('#FFF9E6'),
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
    color: tct('#000'),
    marginBottom: 5,
  },
  notificationMessage: {
    fontSize: 14,
    color: tct('#666'),
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
    color: tct('#FF4500'),
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: tct('#999'),
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tc('#FF4500'),
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
    color: tct('#333'),
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateMessage: {
    fontSize: 16,
    color: tct('#666'),
    textAlign: 'center',
    lineHeight: 24,
  },
}));

export default NotificationsScreen;