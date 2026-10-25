import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal,
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI, errorMessage } from '../api/client';
import { useSession, roleLabel, departmentName } from '../context/SessionContext';
import LocationPicker from '../components/LocationPicker';
import { placeLabel } from '../data/india';

import { tc, tct, themedStyles } from '../theme';
const ROLE_COLORS = {
  state_admin: tc('#6F42C1'),
  district_admin: tc('#1A56DB'),
  officer: tc('#FF4500'),
  citizen: tc('#2E7D32'),
};

export default function AdminUsersScreen({ navigation }) {
  const { me, meta } = useSession();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // user object, or {} for "new"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.users({ role: roleFilter || undefined, search: search.trim() || undefined, limit: 100 });
      setUsers(res.users || []);
      setRoles(res.assignableRoles || []);
    } catch (e) {
      Alert.alert('Could not load people', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce typing
    return () => clearTimeout(t);
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tct('#FF4500')} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage people</Text>
        <TouchableOpacity onPress={() => setEditing({})}>
          <Ionicons name="person-add" size={24} color={tct('#FF4500')} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={tct('#999')} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email"
          placeholderTextColor={tc('#999')}
          autoCapitalize="none"
        />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {['', ...roles].map((r) => (
            <TouchableOpacity key={r || 'all'} onPress={() => setRoleFilter(r)} style={[styles.chip, roleFilter === r && styles.chipActive]}>
              <Text style={[styles.chipText, roleFilter === r && styles.chipTextActive]}>{r ? roleLabel(meta, r) : 'Everyone'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={tct('#FF4500')} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          ListEmptyComponent={<Text style={styles.empty}>No one found.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => setEditing(item)}>
              <Ionicons name="person-circle" size={38} color={item.isActive ? ROLE_COLORS[item.role] || tc('#999') : tc('#CCC')} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.name}>{item.displayName || item.email}{item.isActive ? '' : ' (inactive)'}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <Text style={styles.meta}>
                  {roleLabel(meta, item.role)}
                  {item.department ? ` · ${departmentName(meta, item.department)}` : ''}
                  {item.state ? ` · ${placeLabel(item.state, item.district)}` : ''}
                </Text>
              </View>
              <Ionicons name="create-outline" size={20} color={tct('#BBB')} />
            </TouchableOpacity>
          )}
        />
      )}

      {editing && (
        <EditUser
          me={me}
          meta={meta}
          roles={roles}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </View>
  );
}

function EditUser({ me, meta, roles, user, onClose, onSaved }) {
  const isNew = !user._id;
  const [form, setForm] = useState({
    name: user.displayName || '',
    email: user.email || '',
    password: '',
    role: user.role || roles[0] || 'officer',
    state: user.state || me?.state || null,
    district: user.district || me?.district || null,
    department: user.department || 'roads',
    designation: user.designation || '',
    isActive: user.isActive !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Admins can only place people inside their own jurisdiction
  const lockState = me?.role !== 'super_admin';
  const lockDistrict = me?.role === 'district_admin';
  const needsDistrict = ['district_admin', 'officer', 'citizen'].includes(form.role);

  const save = async () => {
    const body = {
      role: form.role,
      state: form.state,
      district: needsDistrict ? form.district : undefined,
      department: form.role === 'officer' ? form.department : undefined,
      designation: form.designation.trim(),
    };
    setSaving(true);
    try {
      if (isNew) {
        await adminAPI.createUser({ ...body, name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
        Alert.alert('Account created', `${form.email.trim()} can now log in.`);
      } else {
        await adminAPI.updateUser(user._id, { ...body, isActive: form.isActive });
      }
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{isNew ? 'Add a person' : user.displayName || user.email}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={tct('#666')} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {isNew && (
              <>
                <Field label="Full name" value={form.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Ravi Mehta" />
                <Field label="Email (login)" value={form.email} onChangeText={(v) => set({ email: v })} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
                <Field label="Temporary password" value={form.password} onChangeText={(v) => set({ password: v })} placeholder="At least 8 characters" secureTextEntry />
              </>
            )}

            <Text style={styles.label}>Role</Text>
            <View style={styles.wrap}>
              {roles.map((r) => (
                <TouchableOpacity key={r} onPress={() => set({ role: r })} style={[styles.opt, form.role === r && styles.optActive]}>
                  <Text style={[styles.optText, form.role === r && styles.optTextActive]}>{roleLabel(meta, r)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.role !== 'super_admin' && (
              <View style={{ marginTop: 12 }}>
                <LocationPicker
                  label={needsDistrict ? 'State & district' : 'State'}
                  value={{ state: form.state, district: needsDistrict ? form.district : null }}
                  allowDetect={false}
                  disabled={lockState && (lockDistrict || !needsDistrict)}
                  onChange={(p) => {
                    if (lockState && p.state !== me.state) return Alert.alert('Not allowed', 'You can only add people in your own state.');
                    set({ state: p.state, district: p.district });
                  }}
                />
              </View>
            )}

            {form.role === 'officer' && (
              <>
                <Text style={styles.label}>Department</Text>
                <View style={styles.wrap}>
                  {Object.keys(meta.departments || {}).map((d) => (
                    <TouchableOpacity key={d} onPress={() => set({ department: d })} style={[styles.opt, form.department === d && styles.optActive]}>
                      <Text style={[styles.optText, form.department === d && styles.optTextActive]}>{departmentName(meta, d)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {form.role !== 'citizen' && (
              <Field label="Designation" value={form.designation} onChangeText={(v) => set({ designation: v })} placeholder="e.g. Assistant Engineer" />
            )}

            {!isNew && (
              <View style={styles.switchRow}>
                <Text style={styles.label}>Account active</Text>
                <Switch value={form.isActive} onValueChange={(v) => set({ isActive: v })} trackColor={{ true: tc('#FFB08A') }} thumbColor={form.isActive ? tc('#FF4500') : '#EEE'} />
              </View>
            )}

            <TouchableOpacity style={[styles.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>{isNew ? 'Create account' : 'Save changes'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={tc('#999')} autoCorrect={false} {...props} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc('#F6F7F9') },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tc('#FFF'), borderBottomWidth: 1, borderBottomColor: tc('#EEE') },
  title: { fontSize: 18, fontWeight: 'bold', color: tct('#222') },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 0, paddingHorizontal: 12, borderRadius: 10, backgroundColor: tc('#FFF') },
  searchInput: { flex: 1, fontSize: 15, color: tct('#1A1A1A'), paddingVertical: 10 },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: tc('#FFF'), borderWidth: 1, borderColor: tc('#E0E0E0') },
  chipActive: { backgroundColor: tc('#FF4500'), borderColor: tc('#FF4500') },
  chipText: { fontSize: 13, color: tct('#555'), fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: tc('#FFF'), borderRadius: 12, padding: 12, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: 'bold', color: tct('#222') },
  email: { fontSize: 12, color: tct('#777'), marginTop: 1 },
  meta: { fontSize: 12, color: tct('#999'), marginTop: 3 },
  empty: { textAlign: 'center', color: tct('#999'), marginTop: 30 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: tc('#FFF'), borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: tct('#222'), flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: tct('#333'), marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: tc('#DDD'), borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: tct('#1A1A1A'), backgroundColor: tc('#FAFAFA') },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: tc('#DDD') },
  optActive: { backgroundColor: tc('#FF4500'), borderColor: tc('#FF4500') },
  optText: { color: tct('#555'), fontWeight: '600', fontSize: 13 },
  optTextActive: { color: '#FFF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  save: { backgroundColor: tc('#FF4500'), borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 10 },
  saveText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
}));
