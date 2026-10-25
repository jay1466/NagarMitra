import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSession } from '../context/SessionContext';

// Header bell with the unread count; opens the shared Inbox screen.
export default function NotificationBell({ color = '#333' }) {
  const navigation = useNavigation();
  const { unreadCount } = useSession();
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Inbox')} style={styles.btn} accessibilityLabel="Notifications">
      <Ionicons name={unreadCount ? 'notifications' : 'notifications-outline'} size={26} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC3545',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
});
