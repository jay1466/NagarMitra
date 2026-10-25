import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { STATES, districtsOf, findState, findDistrict, matchGeocode } from '../data/india';

/**
 * State → District dropdowns with optional "detect from GPS".
 * value: { state, district }   onChange({ state, district, coords?, address? })
 */
export default function LocationPicker({ value, onChange, allowDetect = true, disabled = false, label = 'Location' }) {
  const [open, setOpen] = useState(null); // 'state' | 'district'
  const [query, setQuery] = useState('');
  const [detecting, setDetecting] = useState(false);

  const state = findState(value?.state);
  const district = findDistrict(value?.state, value?.district);

  const options = useMemo(() => {
    const list = open === 'state' ? STATES : districtsOf(value?.state);
    const q = query.trim().toLowerCase();
    return q ? list.filter((o) => o.name.toLowerCase().includes(q)) : list;
  }, [open, query, value?.state]);

  const choose = (item) => {
    if (open === 'state') onChange({ state: item.code, district: item.code === value?.state ? value?.district : null });
    else onChange({ state: value?.state, district: item.code });
    setOpen(null);
    setQuery('');
  };

  const detect = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access, or choose your state and district from the list.');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        Alert.alert('Location is off', 'Turn on GPS, or choose your state and district from the list.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let g = null;
      try {
        [g] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
      } catch {
        g = null;
      }
      const match = matchGeocode(g);
      const address = g ? [...new Set([g.name, g.street, g.district, g.city, g.postalCode].filter(Boolean))].join(', ') : undefined;
      onChange({ state: match.state || value?.state || null, district: match.district || null, coords, address });
      if (!match.state) Alert.alert('Please choose manually', 'We got your GPS position but could not tell the state. Pick it from the list.');
      else if (!match.district) Alert.alert('Almost there', `We found ${findState(match.state).name}. Please pick your district from the list.`);
    } catch {
      Alert.alert('Location error', 'Could not get your location. Please choose from the list.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <Select
          icon="flag-outline"
          placeholder="Select state"
          value={state?.name}
          disabled={disabled}
          onPress={() => setOpen('state')}
        />
        <Select
          icon="business-outline"
          placeholder={state ? 'Select district' : 'State first'}
          value={district?.name}
          disabled={disabled || !state}
          onPress={() => setOpen('district')}
        />
      </View>
      {allowDetect && !disabled && (
        <TouchableOpacity style={styles.detect} onPress={detect} disabled={detecting}>
          {detecting ? <ActivityIndicator size="small" color="#FF4500" /> : <Ionicons name="locate" size={16} color="#FF4500" />}
          <Text style={styles.detectText}>{detecting ? 'Detecting…' : 'Detect my location'}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={!!open} animationType="slide" transparent onRequestClose={() => setOpen(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{open === 'state' ? 'Choose state / UT' : `Choose district in ${state?.name || ''}`}</Text>
              <TouchableOpacity onPress={() => { setOpen(null); setQuery(''); }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color="#999" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor="#999"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => o.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={25}
              renderItem={({ item }) => {
                const selected = open === 'state' ? item.code === value?.state : item.code === value?.district;
                return (
                  <TouchableOpacity style={[styles.option, selected && styles.optionSelected]} onPress={() => choose(item)}>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item.name}</Text>
                    {open === 'state' && <Text style={styles.optionHint}>{item.type === 'UT' ? 'UT' : `${item.districts.length} districts`}</Text>}
                    {selected && <Ionicons name="checkmark" size={18} color="#FF4500" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No match</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Select({ icon, placeholder, value, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.select, disabled && styles.selectDisabled]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={16} color={value ? '#FF4500' : '#999'} />
      <Text style={[styles.selectText, !value && styles.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color="#999" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  select: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 48,
    backgroundColor: '#FAFAFA',
  },
  selectDisabled: { opacity: 0.55 },
  selectText: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  placeholder: { color: '#999' },
  detect: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  detectText: { color: '#FF4500', fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '80%', paddingBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  sheetTitle: { fontSize: 17, fontWeight: 'bold', color: '#222', flex: 1, marginRight: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F2F2F2' },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A', paddingVertical: 10 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F4F4' },
  optionSelected: { backgroundColor: '#FFF1EA' },
  optionText: { flex: 1, fontSize: 15, color: '#333' },
  optionTextSelected: { color: '#FF4500', fontWeight: 'bold' },
  optionHint: { fontSize: 12, color: '#999', marginRight: 8 },
  empty: { textAlign: 'center', color: '#999', padding: 24 },
});
