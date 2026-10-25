import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, Switch, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Image } from 'react-native';
import MapView, { Marker, Heatmap } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiGet } from '../api/client';
import { auth } from '../lib/firebase';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Status color mapping
const getStatusColor = (status) => {
  switch (status) {
    case 'submitted': return '#DC3545';
    case 'acknowledged': return '#FFC107';
    case 'in_progress': return '#007BFF';
    case 'resolved': return '#28A745';
    default: return '#6C757D';
  }
};

// Category icon mapping
const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'potholes': return 'construct';
    case 'sanitation': return 'trash';
    case 'waste management': return 'trash-bin';
    case 'water supply': return 'water';
    case 'electricity': return 'flash';
    case 'electricity & lighting': return 'flash';
    default: return 'alert-circle';
  }
};

// Generate additional mock data for better heatmap visualization
const generateAdditionalMockData = () => {
  const mockData = [];
  
  // Bhubaneswar coordinates bounds
  const bounds = {
    north: 20.3578,
    south: 20.2320,
    east: 85.8918,
    west: 85.7814
  };
  
  const categories = ['Potholes', 'Sanitation', 'Waste Management', 'Water Supply', 'Electricity & Lighting'];
  const statuses = ['submitted', 'acknowledged', 'in_progress', 'resolved'];
  const priorities = ['Low', 'Medium', 'High', 'Critical'];
  
  // Generate hotspot areas
  const hotspots = [
    { name: 'Kalpana Square Area', lat: 20.2962, lng: 85.8245, intensity: 15 },
    { name: 'Station Square Area', lat: 20.2571, lng: 85.8372, intensity: 12 },
    { name: 'Patia Area', lat: 20.3498, lng: 85.8181, intensity: 18 },
    { name: 'Chandrasekharpur Area', lat: 20.3176, lng: 85.8040, intensity: 10 },
    { name: 'Nayapalli Area', lat: 20.2866, lng: 85.8138, intensity: 8 },
    { name: 'Saheed Nagar Area', lat: 20.2906, lng: 85.8320, intensity: 7 },
    { name: 'Old Town Area', lat: 20.2436, lng: 85.8284, intensity: 9 },
    { name: 'Jaydev Vihar Area', lat: 20.2764, lng: 85.7764, intensity: 6 }
  ];
  
  // Generate data points around hotspots
  hotspots.forEach(hotspot => {
    for (let i = 0; i < hotspot.intensity; i++) {
      const radiusKm = 0.8; // 800m radius
      const radiusLat = radiusKm / 111.32;
      const radiusLng = radiusKm / (111.32 * Math.cos(hotspot.lat * Math.PI / 180));
      
      const randomLat = hotspot.lat + (Math.random() - 0.5) * 2 * radiusLat;
      const randomLng = hotspot.lng + (Math.random() - 0.5) * 2 * radiusLng;
      
      const category = categories[Math.floor(Math.random() * categories.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      
      mockData.push({
        _id: `mock_${Date.now()}_${i}_${hotspot.name.replace(/\s/g, '')}`,
        category,
        status,
        priority,
        description: `Mock ${category.toLowerCase()} issue in ${hotspot.name}`,
        location: {
          coordinates: [randomLng, randomLat]
        },
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
        reportId: `MOCK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      });
    }
  });
  
  // Generate random scattered data points
  for (let i = 0; i < 50; i++) {
    const randomLat = bounds.south + Math.random() * (bounds.north - bounds.south);
    const randomLng = bounds.west + Math.random() * (bounds.east - bounds.west);
    
    const category = categories[Math.floor(Math.random() * categories.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    mockData.push({
      _id: `mock_scattered_${Date.now()}_${i}`,
      category,
      status,
      priority,
      description: `Mock ${category.toLowerCase()} issue - scattered location`,
      location: {
        coordinates: [randomLng, randomLat]
      },
      createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000), // Random date within last 60 days
      reportId: `MOCK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    });
  }
  
  return mockData;
};


export default function DashboardScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportId, setReportId] = useState('');
  const [lookup, setLookup] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [counts, setCounts] = useState({ all: 0, mine: 0, resolved: 0, inProgress: 0 });
  const [mapRegion, setMapRegion] = useState({
    latitude: 20.2961, // Bhubaneswar coordinates
    longitude: 85.8245,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [heatmapData, setHeatmapData] = useState([]);
  const [showMap, setShowMap] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState('heatmap'); // 'heatmap' or 'markers'
  const [userLocation, setUserLocation] = useState(null); // Store actual user location
  const mapRef = useRef(null);

  // Initialize location
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const userLoc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          // Set user location for the blue pin
          setUserLocation(userLoc);
          
          // Set initial map region
          setMapRegion({
            ...userLoc,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          
          console.log('📍 User location detected:', userLoc);
        }
      } catch (error) {
        console.log('Location error:', error);
      }
    };
    getCurrentLocation();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let path = '/api/v1/complaints';
      const u = auth.currentUser;
      const qs = [];
      if (onlyMine && u) {
        qs.push(`mine=1&uid=${encodeURIComponent(u.uid)}`);
      }
      if (statusFilter) {
        qs.push(`status=${encodeURIComponent(statusFilter)}`);
      }
      if (qs.length) path += `?${qs.join('&')}`;
      
      const json = await apiGet(path);
      setItems(json.items || []);
      
      // Generate enhanced heatmap data from complaints
      const complaintItems = json.items || [];
      console.log(`🗺️ Processing ${complaintItems.length} complaints for heatmap`);
      
      // Add additional mock data for better heatmap visualization
      const mockHeatmapData = generateAdditionalMockData();
      const allComplaints = [...complaintItems, ...mockHeatmapData];
      console.log(`🗺️ Including ${mockHeatmapData.length} additional mock data points`);
      
      // Convert complaints to heatmap points
      const heatmapPoints = [];
      const clusterMap = new Map();
      
      allComplaints.forEach(item => {
        // Handle both GeoJSON format (coordinates: [lng, lat]) and direct lat/lng format
        let lat, lng;
        if (item.location && item.location.coordinates && item.location.coordinates.length === 2) {
          // GeoJSON format: coordinates: [longitude, latitude]
          lng = item.location.coordinates[0];
          lat = item.location.coordinates[1];
        } else if (item.location && item.location.lat && item.location.lng) {
          // Direct format: lat and lng properties
          lat = item.location.lat;
          lng = item.location.lng;
        }
        
        if (lat && lng && lat !== 0 && lng !== 0) {
          
          // Create heatmap point
          const heatPoint = {
            latitude: lat,
            longitude: lng,
            weight: getHeatmapWeight(item.status, item.priority),
            intensity: getIntensityFromStatus(item.status)
          };
          
          heatmapPoints.push(heatPoint);
          
          // Create clustering for nearby complaints (within ~100m)
          const clusterKey = `${Math.round(lat * 1000) / 1000}_${Math.round(lng * 1000) / 1000}`;
          if (!clusterMap.has(clusterKey)) {
            clusterMap.set(clusterKey, []);
          }
          clusterMap.get(clusterKey).push(item);
        }
      });
      
      // Add additional weight for clustered areas
      const clusteredHeatData = heatmapPoints.map(point => {
        const clusterKey = `${Math.round(point.latitude * 1000) / 1000}_${Math.round(point.longitude * 1000) / 1000}`;
        const cluster = clusterMap.get(clusterKey) || [];
        const clusterSize = cluster.length;
        
        return {
          ...point,
          weight: Math.min(point.weight * (1 + clusterSize * 0.3), 1.0), // Boost weight for clusters
          cluster: clusterSize > 1 ? clusterSize : undefined
        };
      });
      
      // Log detailed heatmap statistics
      const statusBreakdown = {};
      const categoryBreakdown = {};
      clusteredHeatData.forEach(point => {
        const clusterKey = `${Math.round(point.latitude * 1000) / 1000}_${Math.round(point.longitude * 1000) / 1000}`;
        const cluster = clusterMap.get(clusterKey) || [];
        if (cluster.length > 0) {
          const firstItem = cluster[0];
          statusBreakdown[firstItem.status] = (statusBreakdown[firstItem.status] || 0) + 1;
          categoryBreakdown[firstItem.category] = (categoryBreakdown[firstItem.category] || 0) + 1;
        }
      });
      
      console.log(`🗺️ Generated ${clusteredHeatData.length} heatmap points with ${clusterMap.size} clusters`);
      console.log('📈 Status breakdown:', statusBreakdown);
      console.log('📈 Category breakdown:', categoryBreakdown);
      console.log('📈 Weight range:', {
        min: Math.min(...clusteredHeatData.map(p => p.weight)),
        max: Math.max(...clusteredHeatData.map(p => p.weight)),
        avg: (clusteredHeatData.reduce((sum, p) => sum + p.weight, 0) / clusteredHeatData.length).toFixed(3)
      });
      
      setHeatmapData(clusteredHeatData);
    } catch (e) {
      console.log('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Get heatmap weight based on status and priority
  const getHeatmapWeight = (status, priority = 'Medium') => {
    // Base weight from status
    let statusWeight;
    switch (status) {
      case 'submitted': statusWeight = 1.0; break;
      case 'acknowledged': statusWeight = 0.8; break;
      case 'in_progress': statusWeight = 0.6; break;
      case 'resolved': statusWeight = 0.2; break;
      default: statusWeight = 0.5;
    }
    
    // Priority multiplier
    let priorityMultiplier;
    switch (priority) {
      case 'Critical': priorityMultiplier = 1.5; break;
      case 'High': priorityMultiplier = 1.2; break;
      case 'Medium': priorityMultiplier = 1.0; break;
      case 'Low': priorityMultiplier = 0.8; break;
      default: priorityMultiplier = 1.0;
    }
    
    return Math.min(statusWeight * priorityMultiplier, 1.0);
  };
  
  // Get intensity for heatmap visualization
  const getIntensityFromStatus = (status) => {
    switch (status) {
      case 'submitted': return 1.0;
      case 'acknowledged': return 0.7;
      case 'in_progress': return 0.5;
      case 'resolved': return 0.1;
      default: return 0.3;
    }
  };

  useEffect(() => {
    load();
  }, [onlyMine, statusFilter]);

  // Load statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const u = auth.currentUser;
        console.log('📊 Loading dashboard stats for user:', u?.uid);
        
        const promises = [
          apiGet('/api/v1/complaints'),
          u ? apiGet(`/api/v1/complaints?mine=1&uid=${encodeURIComponent(u.uid)}`) : Promise.resolve({ total: 0 }),
          apiGet('/api/v1/complaints?status=resolved'),
          apiGet('/api/v1/complaints?status=in_progress'),
        ];
        
        const [all, mine, resolved, inProgress] = await Promise.all(promises);
        
        console.log('📊 Dashboard stats loaded:', {
          all: all.total,
          mine: mine.total,
          resolved: resolved.total,
          inProgress: inProgress.total
        });
        
        setCounts({ 
          all: all.total || 0, 
          mine: mine.total || 0, 
          resolved: resolved.total || 0,
          inProgress: inProgress.total || 0
        });
      } catch (e) {
        console.error('❌ Stats loading error:', e.message);
        // Set counts to 0 on error to show something
        setCounts({ all: 0, mine: 0, resolved: 0, inProgress: 0 });
      }
    };
    loadStats();
  }, [auth.currentUser]);

  // Refresh stats when screen comes into focus (e.g., after submitting a complaint)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Dashboard focused, refreshing stats...');
      const loadStats = async () => {
        try {
          const u = auth.currentUser;
          const promises = [
            apiGet('/api/v1/complaints'),
            u ? apiGet(`/api/v1/complaints?mine=1&uid=${encodeURIComponent(u.uid)}`) : Promise.resolve({ total: 0 }),
            apiGet('/api/v1/complaints?status=resolved'),
            apiGet('/api/v1/complaints?status=in_progress'),
          ];
          
          const [all, mine, resolved, inProgress] = await Promise.all(promises);
          setCounts({ 
            all: all.total || 0, 
            mine: mine.total || 0, 
            resolved: resolved.total || 0,
            inProgress: inProgress.total || 0
          });
        } catch (e) {
          console.error('❌ Focus stats loading error:', e.message);
        }
      };
      loadStats();
    }, [auth.currentUser])
  );

  const checkByReport = async () => {
    if (!reportId.trim()) return;
    try {
      setLoading(true);
      const json = await apiGet(`/api/v1/complaints/report/${encodeURIComponent(reportId)}`);
      setLookup(json.complaint || null);
    } catch (e) {
      setLookup({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity onPress={() => setShowMap(!showMap)} style={styles.toggleButton}>
            <Ionicons name={showMap ? "list" : "map"} size={20} color="#FF4500" />
            <Text style={styles.toggleText}>{showMap ? 'List' : 'Map'}</Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Tiles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
          <StatsTile
            title="All Issues"
            count={counts.all}
            icon="apps"
            color="#666"
            active={!onlyMine && !statusFilter}
            onPress={() => { setOnlyMine(false); setStatusFilter(''); load(); }}
          />
          <StatsTile
            title="My Reports"
            count={counts.mine}
            icon="person"
            color="#007BFF"
            active={onlyMine}
            onPress={() => { if (auth.currentUser) { setOnlyMine(true); setStatusFilter(''); load(); } }}
          />
          <StatsTile
            title="Resolved"
            count={counts.resolved}
            icon="checkmark-circle"
            color="#28A745"
            active={statusFilter === 'resolved'}
            onPress={() => { setStatusFilter('resolved'); setOnlyMine(false); load(); }}
          />
          <StatsTile
            title="In Progress"
            count={counts.inProgress}
            icon="construct"
            color="#FFC107"
            active={statusFilter === 'in_progress'}
            onPress={() => { setStatusFilter('in_progress'); setOnlyMine(false); load(); }}
          />
        </ScrollView>

        {/* Map Section */}
        {showMap && (
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>
                {heatmapMode === 'heatmap' ? 'Issue Heatmap' : 'Issue Markers'}
              </Text>
              <View style={styles.mapControls}>
                <TouchableOpacity 
                  onPress={() => setHeatmapMode(heatmapMode === 'heatmap' ? 'markers' : 'heatmap')}
                  style={styles.heatmapToggle}
                >
                  <Ionicons 
                    name={heatmapMode === 'heatmap' ? 'radio-button-on' : 'radio-button-off'} 
                    size={16} 
                    color="#FF4500" 
                  />
                  <Text style={styles.toggleLabel}>Heatmap</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setHeatmapMode(heatmapMode === 'markers' ? 'heatmap' : 'markers')}
                  style={styles.heatmapToggle}
                >
                  <Ionicons 
                    name={heatmapMode === 'markers' ? 'radio-button-on' : 'radio-button-off'} 
                    size={16} 
                    color="#FF4500" 
                  />
                  <Text style={styles.toggleLabel}>Markers</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Legend */}
            <View style={styles.legendContainer}>
              {heatmapMode === 'heatmap' ? (
                <>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FF0000' }]} />
                    <Text style={styles.legendText}>Critical/High</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FFC107' }]} />
                    <Text style={styles.legendText}>Medium</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#00FF00' }]} />
                    <Text style={styles.legendText}>Low/Resolved</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#DC3545' }]} />
                    <Text style={styles.legendText}>Submitted</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FFC107' }]} />
                    <Text style={styles.legendText}>Acknowledged</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#007BFF' }]} />
                    <Text style={styles.legendText}>In Progress</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#28A745' }]} />
                    <Text style={styles.legendText}>Resolved</Text>
                  </View>
                </>
              )}
            </View>
            
            <MapView
              ref={mapRef}
              style={styles.map}
              region={mapRegion}
              onRegionChangeComplete={setMapRegion}
            >
              {/* Heatmap Overlay - only when heatmap mode is active */}
              {heatmapMode === 'heatmap' && heatmapData.length > 0 && (
                <Heatmap
                  points={heatmapData}
                  radius={50}
                  opacity={0.7}
                  gradient={{
                    colors: ['#00FF00', '#FFFF00', '#FFA500', '#FF4500', '#FF0000'],
                    startPoints: [0.1, 0.3, 0.5, 0.7, 1.0],
                    colorMapSize: 256
                  }}
                />
              )}
              
              {/* Individual Markers - only when markers mode is active */}
              {heatmapMode === 'markers' && items.slice(0, 20).map((item, index) => {
                // Handle both GeoJSON format and direct lat/lng format
                let lat, lng;
                if (item.location && item.location.coordinates && item.location.coordinates.length === 2) {
                  lng = item.location.coordinates[0];
                  lat = item.location.coordinates[1];
                } else if (item.location && item.location.lat && item.location.lng) {
                  lat = item.location.lat;
                  lng = item.location.lng;
                }
                
                if (!lat || !lng || lat === 0 || lng === 0) return null;
                
                return (
                  <Marker
                    key={item._id}
                    coordinate={{
                      latitude: lat,
                      longitude: lng
                    }}
                    title={`${item.category} - ${item.status}`}
                    description={`${item.description.substring(0, 100)}...\nReport ID: ${item.reportId}`}
                  >
                    <View style={[styles.customMarker, { backgroundColor: getStatusColor(item.status) }]}>
                      <Ionicons name={getCategoryIcon(item.category)} size={16} color="#FFF" />
                      {/* Show cluster count if multiple issues in same area */}
                      {item.clusterCount && item.clusterCount > 1 && (
                        <View style={styles.clusterBadge}>
                          <Text style={styles.clusterText}>{item.clusterCount}</Text>
                        </View>
                      )}
                    </View>
                  </Marker>
                );
              })}
              
              {/* Always show user's location if available */}
              {userLocation && (
                <Marker
                  coordinate={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude
                  }}
                  title="Your Location"
                  pinColor="#007BFF"
                />
              )}
            </MapView>
          </View>
        )}

        {/* Report ID Search */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Track Report Status</Text>
          <View style={styles.searchContainer}>
            <TextInput
              value={reportId}
              onChangeText={setReportId}
              placeholder="Enter Report ID (e.g., NM2024001234)"
              style={styles.searchInput}
              placeholderTextColor="#999"
            />
            <TouchableOpacity onPress={checkByReport} style={styles.searchButton} disabled={loading}>
              <Ionicons name="search" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          {lookup && (
            <View style={styles.lookupResult}>
              {lookup.error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#DC3545" />
                  <Text style={styles.errorText}>{lookup.error}</Text>
                </View>
              ) : (
                <View style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Ionicons name={getCategoryIcon(lookup.category)} size={24} color="#FF4500" />
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportCategory}>{lookup.category}</Text>
                      <Text style={styles.reportId}>ID: {lookup.reportId}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lookup.status) }]}>
                      <Text style={styles.statusText}>{lookup.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.reportDescription}>{lookup.description}</Text>
                  <Text style={styles.reportDate}>Submitted: {new Date(lookup.createdAt).toLocaleDateString()}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Issues List */}
        <View style={styles.issuesSection}>
          <View style={styles.issuesHeader}>
            <Text style={styles.sectionTitle}>Recent Issues</Text>
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Mine only</Text>
              <Switch 
                value={onlyMine} 
                onValueChange={(v) => { setOnlyMine(v); }}
                trackColor={{ false: '#DDD', true: '#FF4500' }}
                thumbColor={onlyMine ? '#FFF' : '#FFF'}
              />
            </View>
          </View>
          
          {!auth.currentUser && onlyMine && (
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={16} color="#DC3545" />
              <Text style={styles.warningText}>Sign in to see your complaints.</Text>
            </View>
          )}
          
          <FlatList
            data={items.slice(0, 20)}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueIcon}>
                    <Ionicons name={getCategoryIcon(item.category)} size={20} color="#FF4500" />
                  </View>
                  <View style={styles.issueInfo}>
                    <Text style={styles.issueTitle}>{item.category}</Text>
                    <Text style={styles.issueDate}>
                      {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.issueStatus, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.issueStatusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.issueDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.issueFooter}>
                  <Text style={styles.issueId}>ID: {item.reportId}</Text>
                  {item.location && (
                    <View style={styles.locationInfo}>
                      <Ionicons name="location" size={12} color="#666" />
                      <Text style={styles.locationText}>{item.address || 'Location recorded'}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text" size={48} color="#DDD" />
                <Text style={styles.emptyText}>No issues found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </View>
            }
          />
        </View>

        {/* Refresh Button */}
        <TouchableOpacity onPress={load} style={styles.refreshButton} disabled={loading}>
          <Ionicons name="refresh" size={20} color="#FF4500" />
          <Text style={styles.refreshText}>{loading ? 'Refreshing...' : 'Refresh Data'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333'
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF4500'
  },
  toggleText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF4500'
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  statsTile: {
    width: 120,
    padding: 16,
    marginRight: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  statsTileActive: {
    backgroundColor: '#FF4500',
    borderColor: '#FF4500'
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
    color: '#333',
    marginBottom: 4
  },
  statsCountActive: {
    color: '#FFF'
  },
  statsTitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  statsTitleActive: {
    color: '#FFF'
  },
  mapSection: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
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
    color: '#333',
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
    color: '#FF4500',
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
    color: '#666'
  },
  map: {
    height: 300,
    borderRadius: 12
  },
  customMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    position: 'relative'
  },
  clusterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4500',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF'
  },
  clusterText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold'
  },
  searchSection: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F8F9FA'
  },
  searchButton: {
    backgroundColor: '#FF4500',
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
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8
  },
  errorText: {
    color: '#DC3545',
    fontSize: 14,
    fontWeight: '500'
  },
  reportCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5'
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
    color: '#333'
  },
  reportId: {
    fontSize: 12,
    color: '#666',
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
    color: '#333',
    marginBottom: 8,
    lineHeight: 20
  },
  reportDate: {
    fontSize: 12,
    color: '#666'
  },
  issuesSection: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
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
    color: '#666'
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8
  },
  warningText: {
    color: '#DC3545',
    fontSize: 14
  },
  issueCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5'
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
    backgroundColor: '#FFF5F0',
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
    color: '#333'
  },
  issueDate: {
    fontSize: 12,
    color: '#666'
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
    color: '#666',
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
    color: '#666',
    fontFamily: 'monospace'
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  locationText: {
    fontSize: 12,
    color: '#666'
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 12
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4500',
    gap: 8
  },
  refreshText: {
    color: '#FF4500',
    fontSize: 16,
    fontWeight: '600'
  }
});

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
