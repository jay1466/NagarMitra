import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { complaintAPI, errorMessage } from '../api/client';
import IssueMap from '../components/IssueMap';
import ComplaintCard from '../components/ComplaintCard';
import { useSession } from '../context/SessionContext';
import { placeLabel } from '../data/india';

import { tc, tct, themedStyles } from '../theme';
// Status color mapping
const getStatusColor = (status) => {
  switch (status) {
    case 'submitted': return tc('#DC3545');
    case 'acknowledged': return tc('#FFC107');
    case 'in_progress': return tc('#007BFF');
    case 'resolved': return tc('#28A745');
    default: return tc('#6C757D');
  }
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  done: 'Resolved',
  assigned: 'Assigned',
  rejected: 'Rejected',
};
const statusLabel = (s) => STATUS_LABELS[s] || s || 'Unknown';

// Category icon mapping
const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'potholes': return 'construct';
    case 'sanitation': return 'trash';
    case 'waste management': return 'trash-bin';
    case 'water supply': return 'water';
    case 'electricity':
    case 'electricity & lighting': return 'flash';
    default: return 'alert-circle';
  }
};

// Heat weight: open, urgent issues glow hotter than resolved ones
const getHeatmapWeight = (status, priority = 'Medium') => {
  const statusWeight = { submitted: 1.0, acknowledged: 0.8, in_progress: 0.6, resolved: 0.2 }[status] ?? 0.5;
  const priorityMultiplier = { Critical: 1.5, High: 1.2, Medium: 1.0, Low: 0.8 }[priority] ?? 1.0;
  return Math.min(statusWeight * priorityMultiplier, 1.0);
};

// Complaints store GeoJSON [lng, lat]; return null when there is no usable point
const coordsOf = (item) => {
  const c = item?.location?.coordinates;
  if (Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && !(c[0] === 0 && c[1] === 0)) {
    return { lat: c[1], lng: c[0] };
  }
  return null;
};

const formatDate = (d) => {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

export default function DashboardScreen({ navigation }) {
  const { me } = useSession();
  // Public view defaults to the user's own district when we know it
  const [area, setArea] = useState(me?.district ? 'district' : 'india'); // 'district' | 'state' | 'india'
  const areaParams = area === 'district' && me?.district
    ? { state: me.state, district: me.district }
    : area === 'state' && me?.state
      ? { state: me.state }
      : {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [reportId, setReportId] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [counts, setCounts] = useState({ all: 0, mine: 0, resolved: 0, inProgress: 0 });
  // The map (a WebView) loads on demand so the Dashboard opens instantly and
  // can never be taken down by the WebView on phones where it misbehaves
  const [showMap, setShowMap] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState('markers'); // 'heatmap' | 'markers'
  const [userLocation, setUserLocation] = useState(null);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Location is optional: the map simply doesn't show "you are here" without it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // GPS off / unavailable
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const json = await complaintAPI.getList({
        mine: onlyMine ? 1 : undefined,
        status: statusFilter || undefined,
        limit: 50,
        search: term || undefined,
        ...(onlyMine ? {} : areaParams),
      });
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setItems([]);
      setListError(errorMessage(e, 'Could not load issues.'));
    } finally {
      setLoading(false);
    }
  }, [onlyMine, statusFilter, area, term, me?.state, me?.district]);

  const loadCounts = useCallback(async () => {
    // Each count is independent so one failure doesn't blank the others
    const total = (p) => p.then((r) => r.total || 0).catch(() => null);
    const [all, mine, resolved, inProgress] = await Promise.all([
      total(complaintAPI.getList({ limit: 1, ...areaParams })),
      total(complaintAPI.getList({ mine: 1, limit: 1 })),
      total(complaintAPI.getList({ status: 'done', limit: 1, ...areaParams })),
      total(complaintAPI.getList({ status: 'in_progress', limit: 1, ...areaParams })),
    ]);
    setCounts((prev) => ({
      all: all ?? prev.all,
      mine: mine ?? prev.mine,
      resolved: resolved ?? prev.resolved,
      inProgress: inProgress ?? prev.inProgress,
    }));
  }, [area, me?.state, me?.district]);

  // Reload whenever the filters change
  useEffect(() => { loadList(); }, [loadList]);

  // Refresh counts each time the tab is opened (e.g. after submitting a complaint)
  useFocusEffect(useCallback(() => { loadCounts(); }, [loadCounts]));

  const refreshAll = useCallback(() => {
    loadList();
    loadCounts();
  }, [loadList, loadCounts]);

  const mapPoints = useMemo(
    () =>
      items
        .map((item) => {
          const c = coordsOf(item);
          if (!c) return null;
          return {
            ...c,
            weight: getHeatmapWeight(item.status, item.priority),
            color: getStatusColor(item.status),
            title: `${item.category} · ${statusLabel(item.status)}`,
            subtitle: item.reportId || '',
          };
        })
        .filter(Boolean),
    [items]
  );

  const checkByReport = async () => {
    const id = reportId.trim();
    if (!id) {
      setLookup({ error: 'Enter a report ID, e.g. NM-GJ-20261025-0001' });
      return;
    }
    setLookingUp(true);
    try {
      const json = await complaintAPI.getByReportId(id);
      if (json.complaint?._id) {
        setLookup(null);
        navigation.navigate('ComplaintDetail', { id: json.complaint._id });
      } else {
        setLookup({ error: 'No report found with this ID' });
      }
    } catch (e) {
      setLookup({ error: errorMessage(e, 'Could not look up this report.') });
    } finally {
      setLookingUp(false);
    }
  };

  const selectFilter = (mine, status) => {
    setOnlyMine(mine);
    setStatusFilter(status);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refreshAll} colors={[tc('#FF4500')]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity onPress={() => setShowMap(!showMap)} style={styles.toggleButton}>
            <Ionicons name={showMap ? 'list' : 'map'} size={20} color={tct('#FF4500')} />
            <Text style={styles.toggleText}>{showMap ? 'Hide map' : 'Show map'}</Text>
          </TouchableOpacity>
        </View>

        {/* Area switch */}
        {me?.state && (
          <View style={styles.areaRow}>
            {[
              ...(me.district ? [['district', placeLabel(me.state, me.district).split(',')[0]]] : []),
              ['state', placeLabel(me.state)],
              ['india', 'All India'],
            ].map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => setArea(key)} style={[styles.areaChip, area === key && styles.areaChipActive]}>
                <Text style={[styles.areaText, area === key && styles.areaTextActive]} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Statistics Tiles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
          <StatsTile title="All Issues" count={counts.all} icon="apps" color={tct('#666')}
            active={!onlyMine && !statusFilter} onPress={() => selectFilter(false, '')} />
          <StatsTile title="My Reports" count={counts.mine} icon="person" color={tct('#007BFF')}
            active={onlyMine} onPress={() => selectFilter(true, '')} />
          <StatsTile title="Resolved" count={counts.resolved} icon="checkmark-circle" color={tct('#28A745')}
            active={statusFilter === 'done'} onPress={() => selectFilter(false, 'done')} />
          <StatsTile title="In Progress" count={counts.inProgress} icon="construct" color={tct('#FFC107')}
            active={statusFilter === 'in_progress'} onPress={() => selectFilter(false, 'in_progress')} />
        </ScrollView>

        {/* Map Section */}
        {showMap && (
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>{heatmapMode === 'heatmap' ? 'Issue Heatmap' : 'Issue Map'}</Text>
              <View style={styles.mapControls}>
                {['markers', 'heatmap'].map((m) => (
                  <TouchableOpacity key={m} onPress={() => setHeatmapMode(m)} style={styles.heatmapToggle}>
                    <Ionicons name={heatmapMode === m ? 'radio-button-on' : 'radio-button-off'} size={16} color={tct('#FF4500')} />
                    <Text style={styles.toggleLabel}>{m === 'markers' ? 'Markers' : 'Heatmap'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.legendContainer}>
              {['submitted', 'acknowledged', 'in_progress', 'resolved'].map((s) => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: getStatusColor(s) }]} />
                  <Text style={styles.legendText}>{statusLabel(s)}</Text>
                </View>
              ))}
            </View>

            <IssueMap points={mapPoints} mode={heatmapMode} userLocation={userLocation} />
            {!loading && mapPoints.length === 0 && (
              <Text style={styles.mapHint}>No issues with a GPS location to show yet.</Text>
            )}
          </View>
        )}

        {/* Report ID Search */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Track Report Status</Text>
          <View style={styles.searchContainer}>
            <TextInput
              value={reportId}
              onChangeText={(t) => { setReportId(t); if (lookup) setLookup(null); }}
              placeholder="Report ID, e.g. NM-GJ-20261025-0001"
              style={styles.searchInput}
              placeholderTextColor={tc('#999')}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={checkByReport}
            />
            <TouchableOpacity onPress={checkByReport} style={styles.searchButton} disabled={lookingUp}>
              {lookingUp ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="search" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>

          {lookup && (
            <View style={styles.lookupResult}>
              {lookup.error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color={tct('#DC3545')} />
                  <Text style={styles.errorText}>{lookup.error}</Text>
                </View>
              ) : (
                <View style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Ionicons name={getCategoryIcon(lookup.category)} size={24} color={tct('#FF4500')} />
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportCategory}>{lookup.category}</Text>
                      <Text style={styles.reportId}>ID: {lookup.reportId}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lookup.status) }]}>
                      <Text style={styles.statusText}>{statusLabel(lookup.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reportDescription}>{lookup.description}</Text>
                  <Text style={styles.reportDate}>Submitted: {formatDate(lookup.createdAt)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Issues List */}
        <View style={styles.issuesSection}>
          <View style={styles.issuesHeader}>
            <Text style={styles.sectionTitle}>
              {onlyMine ? 'My Reports' : statusFilter ? `${statusLabel(statusFilter)} Issues` : 'Recent Issues'}
            </Text>
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Mine only</Text>
              <Switch
                value={onlyMine}
                onValueChange={(v) => setOnlyMine(v)}
                trackColor={{ false: tc('#DDD'), true: tc('#FFB08A') }}
                thumbColor={onlyMine ? tc('#FF4500') : '#F4F4F4'}
              />
            </View>
          </View>

          <View style={styles.listSearch}>
            <Ionicons name="search" size={18} color={tct('#999')} />
            <TextInput
              style={styles.listSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search issues by ID, words or address"
              placeholderTextColor={tc('#999')}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => setTerm(search.trim())}
            />
            {!!search && (
              <TouchableOpacity onPress={() => { setSearch(''); setTerm(''); }}>
                <Ionicons name="close-circle" size={18} color={tct('#999')} />
              </TouchableOpacity>
            )}
          </View>

          {loading && items.length === 0 ? (
            <ActivityIndicator color={tct('#FF4500')} style={{ marginVertical: 24 }} />
          ) : listError ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color={tct('#DDD')} />
              <Text style={styles.emptyText}>{listError}</Text>
              <TouchableOpacity onPress={refreshAll} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text" size={48} color={tct('#DDD')} />
              <Text style={styles.emptyText}>{onlyMine ? "You haven't reported any issues yet" : 'No issues found'}</Text>
              <Text style={styles.emptySubtext}>{onlyMine ? 'Use the Raise tab to report one.' : 'Try another filter.'}</Text>
            </View>
          ) : (
            items.slice(0, 30).map((item) => (
              <ComplaintCard
                key={item._id}
                item={item}
                onPress={() => navigation.navigate('ComplaintDetail', { id: item._id })}
              />
            ))
          )}
        </View>

        <TouchableOpacity onPress={refreshAll} style={styles.refreshButton} disabled={loading}>
          <Ionicons name="refresh" size={20} color={tct('#FF4500')} />
          <Text style={styles.refreshText}>{loading ? 'Refreshing...' : 'Refresh Data'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  listSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tc('#F8F9FA'),
    borderWidth: 1,
    borderColor: tc('#E5E5E5'),
    marginBottom: 12
  },
  listSearchInput: {
    flex: 1,
    fontSize: 14,
    color: tct('#1A1A1A'),
    paddingVertical: 9
  },
  areaRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: tc('#FFF')
  },
  areaChip: {
    flexShrink: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tc('#E0E0E0')
  },
  areaChipActive: {
    backgroundColor: tc('#FF4500'),
    borderColor: tc('#FF4500')
  },
  areaText: {
    fontSize: 13,
    color: tct('#555'),
    fontWeight: '600'
  },
  areaTextActive: {
    color: '#FFF'
  },
  container: {
    flex: 1,
    backgroundColor: tc('#F8F9FA')
  },
  scrollView: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: tc('#FFF'),
    borderBottomWidth: 1,
    borderBottomColor: tc('#E5E5E5')
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: tct('#333')
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tc('#FFF5F0'),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tc('#FF4500')
  },
  toggleText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: tct('#FF4500')
  },
  statsContainer: {
    flexGrow: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tc('#FFF'),
    borderBottomWidth: 1,
    borderBottomColor: tc('#E5E5E5')
  },
  statsTile: {
    width: 120,
    padding: 16,
    marginRight: 12,
    backgroundColor: tc('#FFF'),
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: tc('#000'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: tc('#F0F0F0')
  },
  statsTileActive: {
    backgroundColor: tc('#FF4500'),
    borderColor: tc('#FF4500')
  },
  statsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  statsCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: tct('#333'),
    marginBottom: 4
  },
  statsCountActive: {
    color: '#FFF'
  },
  statsTitle: {
    fontSize: 12,
    color: tct('#666'),
    textAlign: 'center'
  },
  statsTitleActive: {
    color: '#FFF'
  },
  mapSection: {
    backgroundColor: tc('#FFF'),
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: tc('#000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tct('#333'),
    flex: 1
  },
  mapControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  heatmapToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  toggleLabel: {
    fontSize: 12,
    color: tct('#FF4500'),
    fontWeight: '500'
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 10,
    color: tct('#666')
  },
  mapHint: {
    fontSize: 12,
    color: tct('#888'),
    textAlign: 'center',
    marginTop: 8
  },
  customMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: tc('#FFF'),
    position: 'relative'
  },
  clusterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: tc('#FF4500'),
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tc('#FFF')
  },
  clusterText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold'
  },
  searchSection: {
    backgroundColor: tc('#FFF'),
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: tc('#000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tct('#333'),
    marginBottom: 12
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: tct('#1A1A1A'),
    borderWidth: 1,
    borderColor: tc('#DDD'),
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: tc('#F8F9FA')
  },
  searchButton: {
    backgroundColor: tc('#FF4500'),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  lookupResult: {
    marginTop: 12
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: tc('#FFEBEE'),
    borderRadius: 8,
    gap: 8
  },
  errorText: {
    flex: 1,
    color: tct('#DC3545'),
    fontSize: 14,
    fontWeight: '500'
  },
  reportCard: {
    backgroundColor: tc('#F8F9FA'),
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tc('#E5E5E5')
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  reportInfo: {
    flex: 1,
    marginLeft: 12
  },
  reportCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tct('#333')
  },
  reportId: {
    fontSize: 12,
    color: tct('#666'),
    fontFamily: 'monospace'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  reportDescription: {
    fontSize: 14,
    color: tct('#333'),
    marginBottom: 8,
    lineHeight: 20
  },
  reportDate: {
    fontSize: 12,
    color: tct('#666')
  },
  issuesSection: {
    backgroundColor: tc('#FFF'),
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: tc('#000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  issuesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  filterLabel: {
    fontSize: 14,
    color: tct('#666')
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: tc('#FFEBEE'),
    borderRadius: 8,
    marginBottom: 12,
    gap: 8
  },
  warningText: {
    color: tct('#DC3545'),
    fontSize: 14
  },
  issueCard: {
    backgroundColor: tc('#F8F9FA'),
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tc('#E5E5E5')
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  issueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tc('#FFF5F0'),
    justifyContent: 'center',
    alignItems: 'center'
  },
  issueInfo: {
    flex: 1,
    marginLeft: 12
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tct('#333')
  },
  issueDate: {
    fontSize: 12,
    color: tct('#666')
  },
  issueStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  issueStatusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  issueDescription: {
    fontSize: 14,
    color: tct('#666'),
    lineHeight: 20,
    marginBottom: 8
  },
  issueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  issueId: {
    fontSize: 12,
    color: tct('#666'),
    fontFamily: 'monospace'
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  locationText: {
    fontSize: 12,
    color: tct('#666'),
    maxWidth: 140
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tc('#FF4500')
  },
  retryText: {
    color: tct('#FF4500'),
    fontWeight: '600'
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tct('#999'),
    marginTop: 12,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 14,
    color: tct('#CCC'),
    marginTop: 4
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tc('#FFF'),
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tc('#FF4500'),
    gap: 8
  },
  refreshText: {
    color: tct('#FF4500'),
    fontSize: 16,
    fontWeight: '600'
  }
}));

// Tile Component
const StatsTile = ({ title, count, icon, color, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.statsTile, active && styles.statsTileActive]}
  >
    <View style={[styles.statsIcon, { backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : `${color}15` }]}>
      <Ionicons name={icon} size={20} color={active ? '#FFF' : color} />
    </View>
    <Text style={[styles.statsCount, active && styles.statsCountActive]}>
      {count || 0}
    </Text>
    <Text style={[styles.statsTitle, active && styles.statsTitleActive]}>
      {title}
    </Text>
  </TouchableOpacity>
);
