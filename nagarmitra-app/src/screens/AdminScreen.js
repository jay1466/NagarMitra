import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { adminAPI, errorMessage } from '../api/client';
import { useSession, roleLabel, jurisdictionLabel, departmentName } from '../context/SessionContext';
import NotificationBell from '../components/NotificationBell';

const TILES = [
  { key: 'all', label: 'Total', icon: 'documents-outline', color: '#555', filter: 'all' },
  { key: 'open', label: 'Open', icon: 'hourglass-outline', color: '#007BFF', filter: 'open' },
  { key: 'overdue', label: 'Overdue', icon: 'time-outline', color: '#C62828', filter: 'overdue' },
  { key: 'escalated', label: 'Escalated', icon: 'alert-circle-outline', color: '#8B0000', filter: 'escalated' },
  { key: 'unassigned', label: 'Unassigned', icon: 'person-remove-outline', color: '#E65100', filter: 'open', extra: { unassigned: 1 } },
  { key: 'resolved', label: 'Resolved', icon: 'checkmark-done-outline', color: '#2E7D32', filter: 'done' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline', color: '#6C757D', filter: 'rejected' },
];

export default function AdminScreen({ navigation }) {
  const { me, meta } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await adminAPI.overview());
    } catch (e) {
      setError(errorMessage(e, 'Could not load the overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openQueue = (params) => navigation.navigate('AdminQueue', params);
  const breakdownKey = data?.breakdownBy; // 'state' | 'district' | 'department'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{roleLabel(meta, me?.role)}</Text>
          <Text style={styles.subtitle}>{jurisdictionLabel(meta, me)}</Text>
        </View>
        <NotificationBell />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF4500" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} colors={['#FF4500']} />}
        >
          {!!error && (
            <TouchableOpacity style={styles.error} onPress={load}>
              <Text style={styles.errorText}>{error} Tap to retry.</Text>
            </TouchableOpacity>
          )}

          {data && (
            <>
              <View style={styles.tiles}>
                {TILES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={styles.tile}
                    onPress={() => openQueue({ filter: t.filter, extra: t.extra || {}, title: `${t.label} complaints`, subtitle: jurisdictionLabel(meta, me) })}
                  >
                    <Ionicons name={t.icon} size={20} color={t.color} />
                    <Text style={[styles.tileValue, { color: t.color }]}>{data.totals[t.key] ?? 0}</Text>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.section}>
                By {breakdownKey === 'state' ? 'state' : breakdownKey === 'district' ? 'district' : 'department'}
              </Text>
              <View style={styles.card}>
                {data.breakdown.length === 0 && <Text style={styles.muted}>No complaints yet.</Text>}
                {data.breakdown.map((b, i) => (
                  <TouchableOpacity
                    key={b.key || i}
                    style={[styles.bRow, i > 0 && styles.bRowBorder]}
                    onPress={() =>
                      openQueue({
                        filter: 'all',
                        extra: { [breakdownKey]: b.key },
                        title: breakdownKey === 'department' ? departmentName(meta, b.key) : b.name,
                        subtitle: jurisdictionLabel(meta, me),
                      })
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bName}>{b.name}</Text>
                      <Text style={styles.bSub}>{b.total} total · {b.done} resolved</Text>
                      <View style={styles.bar}>
                        <View style={[styles.barFill, { flex: b.done || 0, backgroundColor: '#2E7D32' }]} />
                        <View style={[styles.barFill, { flex: Math.max(0, b.open - b.overdue), backgroundColor: '#007BFF' }]} />
                        <View style={[styles.barFill, { flex: b.overdue || 0, backgroundColor: '#C62828' }]} />
                        <View style={{ flex: Math.max(0, b.total - b.done - b.open) }} />
                      </View>
                    </View>
                    <View style={styles.bBadges}>
                      <Text style={[styles.pill, { backgroundColor: '#E8F0FE', color: '#1A56DB' }]}>{b.open} open</Text>
                      {b.overdue > 0 && <Text style={[styles.pill, { backgroundColor: '#FDECEA', color: '#C62828' }]}>{b.overdue} late</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#BBB" />
                  </TouchableOpacity>
                ))}
              </View>

              {data.officers?.length > 0 && (
                <>
                  <Text style={styles.section}>Officer performance</Text>
                  <View style={styles.card}>
                    {data.officers.map((o, i) => (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.bRow, i > 0 && styles.bRowBorder]}
                        onPress={() => openQueue({ filter: 'all', extra: { assignedTo: o.id }, title: o.name, subtitle: departmentName(meta, o.department) })}
                      >
                        <Ionicons name="person-circle" size={34} color={o.isActive ? '#FF4500' : '#BBB'} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.bName}>{o.name}</Text>
                          <Text style={styles.bSub}>{departmentName(meta, o.department)}{o.avgRating ? ` · ${o.avgRating}★` : ''}</Text>
                        </View>
                        <View style={styles.bBadges}>
                          <Text style={[styles.pill, { backgroundColor: '#E8F0FE', color: '#1A56DB' }]}>{o.open} open</Text>
                          {o.overdue > 0 && <Text style={[styles.pill, { backgroundColor: '#FDECEA', color: '#C62828' }]}>{o.overdue} late</Text>}
                          <Text style={[styles.pill, { backgroundColor: '#E8F5E9', color: '#2E7D32' }]}>{o.done} done</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.manage} onPress={() => navigation.navigate('AdminUsers')}>
                <Ionicons name="people" size={20} color="#FFF" />
                <Text style={styles.manageText}>Manage people</Text>
              </TouchableOpacity>

              <View style={styles.legend}>
                <Text style={styles.muted}>
                  Escalation: officer reminded at the deadline → District Admin after 24h → State Admin after 3 days → Super Admin after 7 days.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#222' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 2 },
  error: { backgroundColor: '#FDECEA', padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { color: '#C62828' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', flexGrow: 1, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  tileValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  tileLabel: { fontSize: 12, color: '#777' },
  section: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14 },
  bRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  bRowBorder: { borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  bName: { fontSize: 15, fontWeight: '600', color: '#222' },
  bSub: { fontSize: 12, color: '#888', marginTop: 2 },
  bar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#F0F0F0', marginTop: 6 },
  barFill: { height: 5 },
  bBadges: { alignItems: 'flex-end', gap: 4 },
  pill: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  muted: { color: '#888', fontSize: 13, paddingVertical: 12 },
  manage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF4500', borderRadius: 12, paddingVertical: 14, marginTop: 20 },
  manageText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  legend: { marginTop: 8 },
});
