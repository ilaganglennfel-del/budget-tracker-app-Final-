import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { bucketsApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

interface Bucket {
  id: string; name: string; emoji: string;
  bucket_balance: number; color: string;
}

const PALETTE = ['#10B981','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899'];
const EMOJIS  = ['🪣','💎','🌟','🏖️','🚀','🎓','🏠','✈️','🎮','👗'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

/** Strip any character that is not a digit or a single decimal point. */
function sanitizeAmount(raw: string): string {
  // Allow digits and at most one decimal point
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Keep only the first decimal point
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
}

/** Extract a user-friendly error message from an Axios error response. */
function extractErrorMessage(err: any): string {
  const apiMsg = err?.response?.data?.error?.message;
  if (apiMsg) return apiMsg;
  if (err?.message) return err.message;
  return 'Database Sync Error';
}

export default function SaveItScreen() {
  const { user, refreshUser } = useAuthStore();
  const { showError, showToast } = useToast();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bName, setBName] = useState('');
  const [bEmoji, setBEmoji] = useState('🪣');
  const [bColor, setBColor] = useState('#10B981');
  const [saving, setSaving] = useState(false);
  const [txModal, setTxModal] = useState<{ bucket: Bucket; mode: 'deposit' | 'withdraw' } | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Bucket | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadBuckets = useCallback(async () => {
    try {
      const { data } = await bucketsApi.list();
      setBuckets(data.buckets);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuckets(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBuckets(), refreshUser()]);
    setRefreshing(false);
  }, []);

  const handleCreate = async () => {
    if (!bName.trim()) { showToast('Bucket name is required.', 'error'); return; }
    setSaving(true);
    try {
      await bucketsApi.create({ name: bName.trim(), emoji: bEmoji, color: bColor });
      showToast(`${bEmoji} "${bName}" created!`, 'success');
      setCreateOpen(false); setBName(''); setBEmoji('🪣'); setBColor('#10B981');
      loadBuckets();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Manual Deposit / Withdraw ────────────────────────────────────────
  // Validates locally before calling the API to give instant feedback.
  const handleTransaction = async () => {
    if (!txModal) return;

    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Enter a valid amount.', 'error');
      return;
    }

    // ── Client-side validation ────────────────────────────────────────
    if (txModal.mode === 'deposit') {
      const walletBalance = parseFloat(String(user?.balance ?? 0));
      if (amount > walletBalance) {
        showToast('Insufficient Funds', 'error');
        return;
      }
    } else {
      const bucketBalance = parseFloat(String(txModal.bucket.bucket_balance));
      if (amount > bucketBalance) {
        showToast('Insufficient Funds', 'error');
        return;
      }
    }

    setTxLoading(true);
    try {
      const res = txModal.mode === 'deposit'
        ? await bucketsApi.deposit(txModal.bucket.id, amount)
        : await bucketsApi.withdraw(txModal.bucket.id, amount);

      // Update wallet balance in global store
      useAuthStore.getState().setBalance(res.data.new_balance);

      const apiMessage = res.data.message || 'Transaction Successful';

      if (txModal.mode === 'deposit') {
        showToast(`💰 ${apiMessage} — Stashed ${formatCurrency(amount)}!`, 'success');
        if (res.data.flower) {
          setTimeout(() => showToast(`🌸 New ${res.data.flower.flower_type} earned!`, 'success'), 800);
        }
      } else {
        showToast(`✅ ${apiMessage} — Withdrew ${formatCurrency(amount)} to wallet.`, 'success');
      }

      setTxModal(null);
      setTxAmount('');
      loadBuckets();
    } catch (err) {
      const msg = extractErrorMessage(err);
      showToast(msg, 'error');
    } finally {
      setTxLoading(false);
    }
  };

  const handleDelete = async (bucket: Bucket) => {
    if (parseFloat(String(bucket.bucket_balance)) > 0) { setDeleteModal(bucket); return; }
    try {
      await bucketsApi.delete(bucket.id);
      showToast('Bucket deleted.', 'info'); loadBuckets();
    } catch (err) { showToast(extractErrorMessage(err), 'error'); }
  };

  const totalStashed = buckets.reduce((s, b) => s + parseFloat(String(b.bucket_balance)), 0);

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.emerald} colors={[Colors.emerald]} />}>

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.screenTitle}>Save It 🪣</Text>
              <Text style={styles.screenSub}>Your stash buckets</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => setCreateOpen(true)} accessibilityRole="button">
              <Text style={styles.addBtnText}>＋ New</Text>
            </TouchableOpacity>
          </View>

          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Stashed</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalStashed)}</Text>
            <Text style={styles.summaryMeta}>{buckets.length} bucket{buckets.length !== 1 ? 's' : ''}</Text>
          </GlassCard>

          {loading ? <SkeletonList count={3} /> : buckets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🪣</Text>
              <Text style={styles.emptyTitle}>No buckets yet</Text>
              <Text style={styles.emptyText}>Tap "＋ New" to create your first stash bucket.</Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {buckets.map((bucket) => {
                const bal = parseFloat(String(bucket.bucket_balance));
                return (
                  <GlassCard key={bucket.id} style={[styles.bucketCard, { borderLeftColor: bucket.color, borderLeftWidth: 4 }]}>
                    <View style={styles.bucketHeader}>
                      <View style={[styles.bucketIcon, { backgroundColor: bucket.color + '22' }]}>
                        <Text style={styles.bucketEmoji}>{bucket.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bucketName}>{bucket.name}</Text>
                        <Text style={[styles.bucketBalance, { color: bucket.color }]}>{formatCurrency(bal)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(bucket)} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.bucketActions}>
                      {/* ── Deposit button: opens manual amount input ── */}
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.emeraldMuted }]}
                        onPress={() => { setTxModal({ bucket, mode: 'deposit' }); setTxAmount(''); }} accessibilityRole="button">
                        <Text style={[styles.actionBtnText, { color: Colors.emerald }]}>⬇ Deposit</Text>
                      </TouchableOpacity>
                      {/* ── Withdraw button: opens manual amount input ── */}
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(59,130,246,0.12)', opacity: bal === 0 ? 0.4 : 1 }]}
                        onPress={() => { setTxModal({ bucket, mode: 'withdraw' }); setTxAmount(''); }} disabled={bal === 0} accessibilityRole="button">
                        <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>⬆ Withdraw</Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                );
              })}
            </Animated.View>
          )}
        </ScrollView>

        {/* Create Bucket Modal */}
        <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Bucket</Text>
              <TextInput style={styles.input} placeholder="Bucket name" placeholderTextColor={Colors.textMuted}
                value={bName} onChangeText={setBName} accessibilityLabel="Bucket name" />
              <Text style={styles.pickerLabel}>Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row' }}>
                  {EMOJIS.map((e) => (
                    <TouchableOpacity key={e} onPress={() => setBEmoji(e)}
                      style={[styles.emojiBtn, bEmoji === e && styles.emojiBtnActive]}>
                      <Text style={{ fontSize: 24 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.pickerLabel}>Color</Text>
              <View style={styles.colorRow}>
                {PALETTE.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setBColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, bColor === c && styles.colorDotActive]} />
                ))}
              </View>
              <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Create Bucket</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        {/* ── Deposit / Withdraw Manual Input Modal ── */}
        <Modal visible={!!txModal} transparent animationType="slide" onRequestClose={() => setTxModal(null)}>
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {txModal?.mode === 'deposit' ? '⬇ Deposit to Bucket' : '⬆ Withdraw from Bucket'}
              </Text>
              <Text style={styles.modalSub}>{txModal?.bucket.emoji} {txModal?.bucket.name}</Text>

              {/* Balance context so user knows limits */}
              <View style={styles.balanceInfoRow}>
                <View style={styles.balanceInfoBox}>
                  <Text style={styles.balanceInfoLabel}>Wallet Balance</Text>
                  <Text style={[styles.balanceInfoValue, { color: Colors.emerald }]}>
                    {formatCurrency(parseFloat(String(user?.balance ?? 0)))}
                  </Text>
                </View>
                <View style={styles.balanceInfoDivider} />
                <View style={styles.balanceInfoBox}>
                  <Text style={styles.balanceInfoLabel}>Bucket Balance</Text>
                  <Text style={[styles.balanceInfoValue, { color: '#3B82F6' }]}>
                    {formatCurrency(parseFloat(String(txModal?.bucket.bucket_balance ?? 0)))}
                  </Text>
                </View>
              </View>

              {/* Controlled numeric input — strips non-numeric chars */}
              <Text style={styles.pickerLabel}>
                {txModal?.mode === 'deposit' ? 'Amount to Deposit' : 'Amount to Withdraw'}
              </Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                value={txAmount}
                onChangeText={(raw) => setTxAmount(sanitizeAmount(raw))}
                keyboardType="decimal-pad"
                accessibilityLabel="Transaction amount"
              />

              {/* Validation hint */}
              {txModal?.mode === 'deposit' && parseFloat(txAmount || '0') > parseFloat(String(user?.balance ?? 0)) && (
                <Text style={styles.validationHint}>⚠ Amount exceeds wallet balance</Text>
              )}
              {txModal?.mode === 'withdraw' && parseFloat(txAmount || '0') > parseFloat(String(txModal?.bucket.bucket_balance ?? 0)) && (
                <Text style={styles.validationHint}>⚠ Amount exceeds bucket balance</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.btn,
                  txLoading && { opacity: 0.6 },
                  txModal?.mode === 'withdraw' && { backgroundColor: '#3B82F6' },
                ]}
                onPress={handleTransaction}
                disabled={txLoading}
              >
                {txLoading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>{txModal?.mode === 'deposit' ? 'Deposit 💰' : 'Withdraw ✓'}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTxModal(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        {/* Delete Blocked Modal */}
        <Modal visible={!!deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(null)}>
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>⚠️ Cannot Delete</Text>
              <Text style={[styles.modalSub, { color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg }]}>
                This bucket still has{' '}
                <Text style={{ color: Colors.emerald, fontWeight: Typography.bold }}>
                  {formatCurrency(parseFloat(String(deleteModal?.bucket_balance ?? 0)))}
                </Text>{' '}
                inside.{'\n\n'}Please withdraw all funds before deleting.
              </Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#3B82F6' }]}
                onPress={() => { const b = deleteModal!; setDeleteModal(null); setTxModal({ bucket: b, mode: 'withdraw' }); setTxAmount(String(b.bucket_balance)); }}>
                <Text style={styles.btnText}>Withdraw Now ⬆</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModal(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:          { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  screenTitle:        { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  screenSub:          { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  addBtn:             { backgroundColor: Colors.emerald, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, minHeight: MIN_TOUCH, justifyContent: 'center' },
  addBtnText:         { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.sm },
  summaryCard:        { padding: Spacing.lg, marginBottom: Spacing.lg, alignItems: 'center' },
  summaryLabel:       { fontSize: Typography.sm, color: Colors.textMuted },
  summaryAmount:      { fontSize: Typography.xxxl, fontWeight: Typography.extrabold, color: Colors.emerald, marginTop: 4 },
  summaryMeta:        { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4 },
  empty:              { alignItems: 'center', marginTop: 80 },
  emptyEmoji:         { fontSize: 60 },
  emptyTitle:         { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: Spacing.md },
  emptyText:          { color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  bucketCard:         { padding: Spacing.md, marginBottom: Spacing.md, overflow: 'hidden' },
  bucketHeader:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  bucketIcon:         { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  bucketEmoji:        { fontSize: 24 },
  bucketName:         { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  bucketBalance:      { fontSize: Typography.xl, fontWeight: Typography.extrabold },
  deleteBtn:          { padding: 8, minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText:      { color: Colors.error, fontSize: Typography.md },
  bucketActions:      { flexDirection: 'row', gap: Spacing.sm },
  actionBtn:          { flex: 1, height: MIN_TOUCH, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  actionBtnText:      { fontWeight: Typography.semibold, fontSize: Typography.sm },
  overlay:            { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalCard:          { margin: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.xl },
  modalTitle:         { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  modalSub:           { fontSize: Typography.md, color: Colors.textSecondary, marginBottom: 4 },
  balanceInfoRow:     { flexDirection: 'row', backgroundColor: Colors.slateLight, borderRadius: Radius.md, padding: Spacing.sm, marginVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  balanceInfoBox:     { flex: 1, alignItems: 'center' },
  balanceInfoLabel:   { fontSize: Typography.xs, color: Colors.textMuted },
  balanceInfoValue:   { fontSize: Typography.base, fontWeight: Typography.bold, marginTop: 2 },
  balanceInfoDivider: { width: 1, backgroundColor: Colors.border },
  pickerLabel:        { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginTop: Spacing.sm, marginBottom: 6 },
  emojiBtn:           { padding: 8, borderRadius: Radius.sm, marginRight: 8 },
  emojiBtnActive:     { backgroundColor: Colors.emeraldMuted, borderWidth: 1, borderColor: Colors.emerald },
  colorRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  colorDot:           { width: 32, height: 32, borderRadius: 16 },
  colorDotActive:     { borderWidth: 3, borderColor: Colors.white },
  input:              { backgroundColor: Colors.slateLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: MIN_TOUCH + 6, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  amountInput:        { fontSize: 32, fontWeight: Typography.extrabold, textAlign: 'center', height: 72, marginTop: 4 },
  validationHint:     { fontSize: Typography.xs, color: Colors.error, textAlign: 'center', marginBottom: Spacing.sm },
  btn:                { backgroundColor: Colors.emerald, borderRadius: Radius.md, height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, marginTop: Spacing.sm },
  btnText:            { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  cancelBtn:          { height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  cancelText:         { color: Colors.textMuted, fontSize: Typography.sm },
});
