import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { complaintAPI, errorMessage } from '../api/client';
import { useSession, jurisdictionLabel } from '../context/SessionContext';
import ComplaintCard from '../components/ComplaintCard';
import NotificationBell from '../components/NotificationBell';

const FILTERS = [
  { key: 'open', label: 'Open', params: { status: 'open' } },
  { key: 'overdue', label: 'Overdue', params: { overdue: 1 } },
  { key: 'escalated', label: 'Escalated', params: { escalated: 1, status: 'open' } },
  { key: 'resolved', label: 'Awaiting citizen', params: { status: 'resolved' } },
  { key: 'done', label: 'Resolved & closed', params: { status: 'done' } },
  { key: 'rejected', label: 'Rejected', params: { status: 'rejected' } },
  { key: 'all', label: 'All', params: {} },
];

/**
 * Officer: complaints of their department + wards.
 * Admin (when opened with route.params): any filtered slice of the city.
 */
export default function WorkQueueScreen({ navigation, route }) {
  const { me, isAdmin, meta } = useSession();
  const preset = route?.params || {};
  const [filter, setFilter] = useState(preset.filter || 'open');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const extra = preset.extra || {};
  const base = { scope: 'work', limit: 50, ...extra };

  const load = useCallback(async () => {
    setError('');
    try {
      const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
      const res = await complaintAPI.getList({ ...base, ...f.params });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(errorMessage(e, 'Could not load complaints.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, JSON.stringify(extra)]);

  const loadCounts = useCallback(async () => {
    const n = (params) => complaintAPI.getList({ ...base, ...params, limit: 1 }).then((r) => r.total || 0).catch(() => null);
    const [open, overdue, escalated] = await Promise.all([
      n({ status: 'open' }),
      n({ overdue: 1 }),
      n({ escalated: 1, status: 'open' }),
    ]);
    setCounts({ open, overdue, escalated });
  }, [JSON.stringify(extra)]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); loadCounts(); }, [load, loadCounts]));

  const isAdminView = isAdmin;
  const title = preset.title || (isAdminView ? 'All complaints' : 'My Work Queue');
  const subtitle = preset.subtitle || jurisdictionLabel(meta, me);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {navigation.canGoBack() && preset.title ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#FF4500" />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <NotificationBell />
      </View>

      {!preset.title && (
        <View style={styles.summary}>
          <Summary label="Open" value={counts.open} color="#007BFF" onPress={() => setFilter('open')} />
          <Summary label="Overdue" value={counts.overdue} color="#C62828" onPress={() => setFilter('overdue')} />
          <Summary label="Escalated" value={counts.escalated} color="#8B0000" onPress={() => setFilter('escalated')} />
        </View>
      )}

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, filter === f.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF4500" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); loadCounts(); }} colors={['#FF4500']} />
          }
          ListHeaderComponent={
            error ? (
              <TouchableOpacity style={styles.error} onPress={load}>
                <Text style={styles.errorText}>{error} Tap to retry.</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.count}>{total} complaint{total === 1 ? '' : 's'}</Text>
            )
          }
          renderItem={({ item }) => (
            <ComplaintCard
              item={item}
              showAssignee={isAdminView}
              onPress={() => navigation.navigate('ComplaintDetail', { id: item._id })}
            />
          )}
          ListEmptyComponent={
            !error && (
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-circle-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>Nothing here 🎉</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

function Summary({ label, value, color, onPress }) {
  return (
    <TouchableOpacity style={styles.sumCard} onPress={onPress}>
      <Text style={[styles.sumValue, { color }]}>{value ?? '–'}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#222' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 2 },
  summary: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 4 },
  sumCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sumValue: { fontSize: 24, fontWeight: 'bold' },
  sumLabel: { fontSize: 12, color: '#777', marginTop: 2 },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: '#FF4500', borderColor: '#FF4500' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  count: { fontSize: 13, color: '#888', marginBottom: 8 },
  error: { backgroundColor: '#FDECEA', padding: 12, borderRadius: 8, marginBottom: 10 },
  errorText: { color: '#C62828' },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
});
