import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { placeLabel } from '../data/india';

export const STATUS = {
  submitted: { label: 'Submitted', color: '#6C757D', icon: 'paper-plane' },
  assigned: { label: 'Assigned', color: '#DC3545', icon: 'person' },
  acknowledged: { label: 'Acknowledged', color: '#FFA000', icon: 'eye' },
  in_progress: { label: 'In Progress', color: '#007BFF', icon: 'construct' },
  resolved: { label: 'Resolved', color: '#28A745', icon: 'checkmark-circle' },
  closed: { label: 'Closed', color: '#1E7E34', icon: 'lock-closed' },
  rejected: { label: 'Rejected', color: '#8B0000', icon: 'close-circle' },
  reopened: { label: 'Reopened', color: '#E65100', icon: 'refresh' },
};
export const statusInfo = (s) => STATUS[s] || { label: s || 'Unknown', color: '#6C757D', icon: 'help-circle' };

export const CATEGORY_ICON = {
  Potholes: 'construct',
  Sanitation: 'trash',
  'Waste Management': 'trash-bin',
  'Water Supply': 'water',
  'Electricity & Lighting': 'flash',
  Miscellaneous: 'alert-circle',
};

const OPEN = ['submitted', 'assigned', 'acknowledged', 'in_progress'];

// "Due in 5h", "Overdue by 2d" — the SLA status of an open complaint
export function dueLabel(c) {
  if (!c?.dueAt || !OPEN.includes(c.status)) return null;
  const diff = new Date(c.dueAt).getTime() - Date.now();
  const abs = Math.abs(diff);
  const text = abs >= 48 * 3600e3 ? `${Math.round(abs / 86400e3)}d` : `${Math.max(1, Math.round(abs / 3600e3))}h`;
  return diff < 0 ? { text: `Overdue by ${text}`, overdue: true } : { text: `Due in ${text}`, overdue: false };
}

export function formatDateTime(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function StatusBadge({ status, small }) {
  const s = statusInfo(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.color }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, small && styles.badgeTextSmall]}>{s.label}</Text>
    </View>
  );
}

export default function ComplaintCard({ item, onPress, showAssignee }) {
  const place = placeLabel(item.state, item.district);
  const due = dueLabel(item);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={CATEGORY_ICON[item.category] || 'alert-circle'} size={20} color="#FF4500" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title} numberOfLines={1}>{item.category}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {place ? `${place} · ` : ''}{formatDateTime(item.createdAt)}
          </Text>
        </View>
        <StatusBadge status={item.status} small />
      </View>
      <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.footer}>
        <Text style={styles.id} numberOfLines={1}>{item.reportId}</Text>
        <View style={styles.tags}>
          {item.escalationLevel >= 2 && OPEN.includes(item.status) && (
            <View style={[styles.tag, { backgroundColor: '#FDECEA' }]}>
              <Ionicons name="alert" size={11} color="#C62828" />
              <Text style={[styles.tagText, { color: '#C62828' }]}>Escalated</Text>
            </View>
          )}
          {due && (
            <View style={[styles.tag, { backgroundColor: due.overdue ? '#FDECEA' : '#EEF6EE' }]}>
              <Ionicons name="time-outline" size={11} color={due.overdue ? '#C62828' : '#2E7D32'} />
              <Text style={[styles.tagText, { color: due.overdue ? '#C62828' : '#2E7D32' }]}>{due.text}</Text>
            </View>
          )}
          {item.priority === 'Critical' && (
            <View style={[styles.tag, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.tagText, { color: '#E65100' }]}>Critical</Text>
            </View>
          )}
        </View>
      </View>
      {showAssignee && (
        <Text style={styles.assignee} numberOfLines={1}>
          <Ionicons name="person-outline" size={12} color="#888" /> {item.assignedTo?.displayName || 'Unassigned'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  sub: { fontSize: 12, color: '#777', marginTop: 2 },
  desc: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  id: { fontSize: 11, color: '#888', fontFamily: 'monospace', flexShrink: 1, marginRight: 8 },
  tags: { flexDirection: 'row', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 11, fontWeight: '600' },
  assignee: { fontSize: 12, color: '#888', marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  badgeTextSmall: { fontSize: 10 },
});
