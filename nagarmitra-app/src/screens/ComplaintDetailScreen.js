import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { complaintAPI, workflowAPI, adminAPI, errorMessage } from '../api/client';
import { useSession, departmentName } from '../context/SessionContext';
import { placeLabel } from '../data/india';
import { StatusBadge, statusInfo, dueLabel, formatDateTime, CATEGORY_ICON } from '../components/ComplaintCard';
import IssueMap from '../components/IssueMap';
import { toCompressedDataUri } from '../utils/image';

import { tc, tct, themedStyles } from '../theme';
// Next steps an officer/admin can take from each status
const STAFF_ACTIONS = {
  submitted: ['acknowledged', 'rejected'],
  assigned: ['acknowledged', 'rejected'],
  acknowledged: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['resolved', 'rejected'],
};
const ACTION_LABEL = {
  acknowledged: { label: 'Acknowledge', icon: 'eye', color: tct('#FFA000') },
  in_progress: { label: 'Start work', icon: 'construct', color: tct('#007BFF') },
  resolved: { label: 'Mark resolved', icon: 'checkmark-circle', color: tct('#28A745') },
  rejected: { label: 'Reject', icon: 'close-circle', color: tct('#8B0000') },
};

export default function ComplaintDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const { meta, refreshUnread } = useSession();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: 'resolved'|'rejected'|'reopen'|'confirm'|'assign' }
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [rating, setRating] = useState(5);
  const [officers, setOfficers] = useState([]);
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await complaintAPI.getById(id);
      setC(res.complaint);
    } catch (e) {
      setError(errorMessage(e, 'Could not load this complaint.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.complaint) setC(res.complaint);
      setDialog(null);
      setNote('');
      setPhoto(null);
      refreshUnread();
      if (successMsg) Alert.alert('Done', successMsg);
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onStaffAction = (status) => {
    if (status === 'resolved' || status === 'rejected') {
      setNote('');
      setPhoto(null);
      setDialog({ kind: status });
      return;
    }
    run(() => workflowAPI.setStatus(c._id, status), status === 'acknowledged' ? 'Complaint acknowledged. The citizen has been notified.' : 'Work started. The citizen has been notified.');
  };

  const openAssign = async () => {
    setDialog({ kind: 'assign' });
    try {
      const res = await adminAPI.users({ role: 'officer', department: c.department, district: c.district });
      setOfficers(res.users || []);
    } catch (e) {
      Alert.alert('Could not load officers', errorMessage(e));
    }
  };

  const pickProof = async (fromCamera) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access in your phone settings.');
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled && res.assets?.length) setPhoto(res.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Could not get the photo.');
    }
  };

  const submitDialog = async () => {
    const kind = dialog?.kind;
    if (kind === 'resolved' || kind === 'rejected') {
      if (note.trim().length < 5) {
        Alert.alert('More detail needed', kind === 'resolved' ? 'Describe what was done.' : 'Give a reason for rejecting.');
        return;
      }
      let proof;
      if (photo) {
        try { proof = await toCompressedDataUri(photo); } catch { proof = undefined; }
      }
      run(() => workflowAPI.setStatus(c._id, kind, note.trim(), proof), kind === 'resolved' ? 'Marked resolved. The citizen will be asked to confirm.' : 'Complaint rejected.');
    } else if (kind === 'reopen') {
      if (note.trim().length < 5) {
        Alert.alert('More detail needed', "Tell the officer what's still wrong.");
        return;
      }
      run(() => workflowAPI.reopen(c._id, note.trim()), 'Complaint reopened and sent back to the officer.');
    } else if (kind === 'confirm') {
      run(() => workflowAPI.confirm(c._id, rating), 'Thanks for confirming! The complaint is now closed.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={tct('#FF4500')} /></View>;
  }
  if (error || !c) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={56} color={tct('#CCC')} />
        <Text style={styles.errorText}>{error || 'Complaint not found'}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.link}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.link, { color: tct('#666') }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const due = dueLabel(c);
  const coords = Array.isArray(c.location?.coordinates) && c.location.coordinates.length === 2
    ? { lat: c.location.coordinates[1], lng: c.location.coordinates[0] }
    : null;
  const staffActions = c.canManage ? STAFF_ACTIONS[c.status] || [] : [];
  const isOpen = ['submitted', 'assigned', 'acknowledged', 'in_progress'].includes(c.status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={tct('#FF4500')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaint</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} colors={[tc('#FF4500')]} />}
      >
        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.catIcon}>
              <Ionicons name={CATEGORY_ICON[c.category] || 'alert-circle'} size={24} color={tct('#FF4500')} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>{c.category}</Text>
              <Text style={styles.reportId} selectable>{c.reportId}</Text>
            </View>
            <StatusBadge status={c.status} />
          </View>

          <View style={styles.metaGrid}>
            <Meta icon="business-outline" label="Department" value={departmentName(meta, c.department) || '—'} />
            <Meta icon="map-outline" label="District" value={placeLabel(c.state, c.district) || '—'} />
            <Meta icon="flag-outline" label="Priority" value={c.priority} />
            <Meta icon="calendar-outline" label="Reported" value={formatDateTime(c.createdAt)} />
          </View>

          {due && (
            <View style={[styles.dueBox, due.overdue && styles.dueBoxLate]}>
              <Ionicons name="time-outline" size={18} color={due.overdue ? tc('#C62828') : tc('#2E7D32')} />
              <Text style={[styles.dueText, { color: due.overdue ? tc('#C62828') : tc('#2E7D32') }]}>
                {due.text} · deadline {formatDateTime(c.dueAt)}
              </Text>
            </View>
          )}
          {c.escalationLevel >= 2 && isOpen && (
            <View style={[styles.dueBox, styles.dueBoxLate]}>
              <Ionicons name="alert-circle" size={18} color={tct('#C62828')} />
              <Text style={[styles.dueText, { color: tct('#C62828') }]}>Escalated to the admin for missing its deadline</Text>
            </View>
          )}

          <View style={styles.assignee}>
            <Ionicons name="person-circle-outline" size={22} color={tct('#666')} />
            <Text style={styles.assigneeText}>
              {c.assignedTo
                ? `${c.assignedTo.displayName || 'Officer'}${c.assignedTo.designation ? ` · ${c.assignedTo.designation}` : ''}`
                : 'Waiting for an officer to be assigned'}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.section}>Description</Text>
          <Text style={styles.body}>{c.description}</Text>
          {!!c.address && (
            <View style={[styles.row, { marginTop: 10 }]}>
              <Ionicons name="location-outline" size={16} color={tct('#666')} />
              <Text style={[styles.body, { marginLeft: 6, flex: 1 }]}>{c.address}</Text>
            </View>
          )}
          {Array.isArray(c.media) && c.media.length > 0 && (
            <ScrollView horizontal style={{ marginTop: 12 }} showsHorizontalScrollIndicator={false}>
              {c.media.map((m, i) => (
                <TouchableOpacity key={i} onPress={() => setViewer(m)}>
                  <Image source={{ uri: m }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {coords && (
            <View style={{ marginTop: 12 }}>
              <IssueMap
                height={180}
                points={[{ ...coords, weight: 1, color: statusInfo(c.status).color, title: c.category, subtitle: c.reportId }]}
              />
            </View>
          )}
        </View>

        {/* Resolution / rejection */}
        {c.resolution?.note && ['resolved', 'closed'].includes(c.status) && (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: tc('#28A745') }]}>
            <Text style={styles.section}>How it was fixed</Text>
            <Text style={styles.body}>{c.resolution.note}</Text>
            {!!c.resolution.photo && (
              <TouchableOpacity onPress={() => setViewer(c.resolution.photo)}>
                <Image source={{ uri: c.resolution.photo }} style={[styles.photo, { width: '100%', height: 200, marginTop: 10 }]} />
              </TouchableOpacity>
            )}
            {!!c.citizenRating && <Text style={styles.rating}>Citizen rating: {'★'.repeat(c.citizenRating)}{'☆'.repeat(5 - c.citizenRating)}</Text>}
          </View>
        )}
        {c.status === 'rejected' && !!c.rejectionReason && (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: tc('#8B0000') }]}>
            <Text style={styles.section}>Reason for rejection</Text>
            <Text style={styles.body}>{c.rejectionReason}</Text>
          </View>
        )}

        {/* Actions */}
        {(staffActions.length > 0 || (c.canAssign && isOpen) || c.isMine) && (
          <View style={styles.card}>
            <Text style={styles.section}>Actions</Text>
            <View style={styles.actions}>
              {staffActions.map((s) => (
                <ActionButton key={s} {...ACTION_LABEL[s]} disabled={busy} onPress={() => onStaffAction(s)} />
              ))}
              {c.canAssign && isOpen && (
                <ActionButton label="Reassign" icon="swap-horizontal" color={tct('#6F42C1')} disabled={busy} onPress={openAssign} />
              )}
              {c.isMine && c.status === 'resolved' && (
                <>
                  <ActionButton label="Confirm fixed" icon="thumbs-up" color={tct('#28A745')} disabled={busy} onPress={() => { setRating(5); setDialog({ kind: 'confirm' }); }} />
                  {c.canReopen && (
                    <ActionButton label="Reopen" icon="refresh" color={tct('#E65100')} disabled={busy} onPress={() => { setNote(''); setDialog({ kind: 'reopen' }); }} />
                  )}
                </>
              )}
              {c.isMine && isOpen && (
                <ActionButton
                  label={c.canNudge ? 'Remind officer' : 'Reminder sent'}
                  icon="notifications"
                  color={tct('#FF4500')}
                  disabled={busy || !c.canNudge}
                  onPress={() => run(() => workflowAPI.nudge(c._id), 'The officer has been reminded.')}
                />
              )}
            </View>
            {c.isMine && isOpen && !c.canNudge && (
              <Text style={styles.hint}>You can send one reminder every {meta.nudgeIntervalHours || 24} hours.</Text>
            )}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.section}>Timeline</Text>
          {(c.statusHistory || []).slice().reverse().map((h, i, arr) => {
            const s = statusInfo(h.status);
            return (
              <View key={i} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, { backgroundColor: s.color }]} />
                  {i < arr.length - 1 && <View style={styles.tlLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={styles.tlTitle}>{s.label}</Text>
                  <Text style={styles.tlMeta}>
                    {formatDateTime(h.changedAt)}
                    {h.byName ? ` · ${h.byName}` : h.byRole ? ` · ${h.byRole}` : ''}
                  </Text>
                  {!!h.notes && <Text style={styles.tlNote}>{h.notes}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Action dialogs */}
      <Modal visible={!!dialog} transparent animationType="slide" onRequestClose={() => setDialog(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {{ resolved: 'Mark as resolved', rejected: 'Reject complaint', reopen: 'Reopen complaint', confirm: 'Confirm the fix', assign: 'Reassign complaint' }[dialog?.kind]}
              </Text>
              <TouchableOpacity onPress={() => setDialog(null)}>
                <Ionicons name="close" size={24} color={tct('#666')} />
              </TouchableOpacity>
            </View>

            {dialog?.kind === 'assign' ? (
              <ScrollView style={{ maxHeight: 360 }}>
                {officers.length === 0 && <Text style={{ color: tct('#888'), textAlign: 'center', margin: 20 }}>Loading officers… (only officers of this department in this district are listed)</Text>}
                {officers.map((o) => {
                  const current = String(c.assignedTo?._id) === String(o._id);
                  return (
                    <TouchableOpacity
                      key={o._id}
                      style={[styles.officerRow, current && { backgroundColor: tc('#FFF1EA') }]}
                      disabled={busy || current || !o.isActive}
                      onPress={() => run(() => workflowAPI.assign(c._id, o._id), `Assigned to ${o.displayName}.`)}
                    >
                      <Ionicons name="person-circle" size={32} color={o.isActive ? tc('#FF4500') : tc('#BBB')} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.officerName}>{o.displayName}{current ? ' (current)' : ''}</Text>
                        <Text style={styles.officerSub}>{o.designation || 'Officer'}{o.isActive ? '' : ' · inactive'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : dialog?.kind === 'confirm' ? (
              <>
                <Text style={styles.sheetLabel}>How satisfied are you with the fix?</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setRating(n)}>
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={36} color={tct('#FFC107')} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sheetLabel}>
                  {dialog?.kind === 'resolved' ? 'What was done?' : dialog?.kind === 'rejected' ? 'Reason for rejecting' : "What's still wrong?"}
                </Text>
                <TextInput
                  style={styles.sheetInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder={dialog?.kind === 'resolved' ? 'e.g. Pothole filled and road levelled' : 'Type here…'}
                  placeholderTextColor={tc('#999')}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
                {dialog?.kind === 'resolved' && (
                  <>
                    <Text style={styles.sheetLabel}>Proof photo (recommended)</Text>
                    {photo ? (
                      <View>
                        <Image source={{ uri: photo }} style={styles.proof} />
                        <TouchableOpacity onPress={() => setPhoto(null)}>
                          <Text style={[styles.link, { color: tct('#C62828') }]}>Remove photo</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.row}>
                        <TouchableOpacity style={styles.photoBtn} onPress={() => pickProof(true)}>
                          <Ionicons name="camera" size={18} color={tct('#FF4500')} />
                          <Text style={styles.photoBtnText}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.photoBtn} onPress={() => pickProof(false)}>
                          <Ionicons name="images" size={18} color={tct('#FF4500')} />
                          <Text style={styles.photoBtnText}>Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {dialog?.kind !== 'assign' && (
              <TouchableOpacity style={[styles.primary, busy && { opacity: 0.6 }]} disabled={busy} onPress={submitDialog}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Submit</Text>}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen photo */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Meta({ icon, label, value }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={16} color={tct('#888')} />
      <View style={{ marginLeft: 6, flex: 1 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ label, icon, color, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: color }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc('#F6F7F9') },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: tc('#FFF') },
  errorText: { color: tct('#666'), marginTop: 12, textAlign: 'center', fontSize: 15 },
  link: { color: tct('#FF4500'), fontWeight: 'bold', fontSize: 15, marginTop: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: tc('#FFF'),
    borderBottomWidth: 1,
    borderBottomColor: tc('#EEE'),
  },
  headerBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: tct('#222') },
  card: { backgroundColor: tc('#FFF'), borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: tc('#FFF1EA'), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: tct('#222') },
  reportId: { fontSize: 12, color: tct('#888'), fontFamily: 'monospace', marginTop: 2 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  meta: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  metaLabel: { fontSize: 11, color: tct('#999') },
  metaValue: { fontSize: 14, color: tct('#333'), fontWeight: '600' },
  dueBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tc('#EEF6EE'), padding: 10, borderRadius: 8, marginTop: 10 },
  dueBoxLate: { backgroundColor: tc('#FDECEA') },
  dueText: { flex: 1, fontSize: 13, fontWeight: '600' },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: tc('#F0F0F0') },
  assigneeText: { flex: 1, fontSize: 14, color: tct('#444') },
  section: { fontSize: 15, fontWeight: 'bold', color: tct('#222'), marginBottom: 8 },
  body: { fontSize: 14, color: tct('#444'), lineHeight: 21 },
  photo: { width: 110, height: 110, borderRadius: 8, marginRight: 8, backgroundColor: tc('#EEE') },
  rating: { marginTop: 10, color: tct('#B8860B'), fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontWeight: 'bold', fontSize: 14 },
  hint: { fontSize: 12, color: tct('#888'), marginTop: 8 },
  tlRow: { flexDirection: 'row' },
  tlRail: { width: 20, alignItems: 'center' },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  tlLine: { flex: 1, width: 2, backgroundColor: tc('#E5E5E5'), marginTop: 2 },
  tlTitle: { fontSize: 14, fontWeight: 'bold', color: tct('#333'), marginLeft: 8 },
  tlMeta: { fontSize: 12, color: tct('#888'), marginLeft: 8, marginTop: 1 },
  tlNote: { fontSize: 13, color: tct('#555'), marginLeft: 8, marginTop: 4 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: tc('#FFF'), borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: tct('#222') },
  sheetLabel: { fontSize: 14, fontWeight: '600', color: tct('#444'), marginTop: 8, marginBottom: 6 },
  sheetInput: { borderWidth: 1, borderColor: tc('#DDD'), borderRadius: 10, padding: 12, minHeight: 90, fontSize: 15, color: tct('#1A1A1A') },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: tc('#FF4500'), borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 10 },
  photoBtnText: { color: tct('#FF4500'), fontWeight: '600' },
  proof: { width: '100%', height: 160, borderRadius: 8, backgroundColor: tc('#EEE') },
  primary: { backgroundColor: tc('#FF4500'), borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  officerRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: tc('#FAFAFA') },
  officerName: { fontSize: 15, fontWeight: 'bold', color: tct('#222') },
  officerSub: { fontSize: 12, color: tct('#777'), marginTop: 2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
}));
