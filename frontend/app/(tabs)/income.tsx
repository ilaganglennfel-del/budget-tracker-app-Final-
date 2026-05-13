import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useToast } from '../../components/Toast';
import { incomeApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

/** Extract a user-friendly error message from an Axios error response. */
function extractErrorMessage(err: any): string {
  const apiMsg = err?.response?.data?.error?.message;
  if (apiMsg) return apiMsg;
  if (err?.message) return err.message;
  return 'Database Sync Error';
}

interface IncomeSource {
  id: string; name: string; category: string;
  amount: number; frequency: string;
  created_at: string;
}

type Category = 'job' | 'freelance' | 'business' | 'investment' | 'other';
type Frequency = 'weekly' | 'biweekly' | 'monthly';

const CATEGORY_META: Record<Category, { icon: string; label: string; color: string }> = {
  job:        { icon: '💼', label: 'Job',        color: '#3B82F6' },
  freelance:  { icon: '🔧', label: 'Freelance',  color: '#8B5CF6' },
  business:   { icon: '🏪', label: 'Business',   color: '#F59E0B' },
  investment: { icon: '📈', label: 'Investment', color: '#10B981' },
  other:      { icon: '💡', label: 'Other',      color: '#6B7280' },
};

const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly',
};

const FREQUENCY_MULTIPLIER: Record<Frequency, number> = {
  weekly: 4.33, biweekly: 2.165, monthly: 1,
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function IncomeScreen() {
  const { showToast } = useToast();
  const [sources,    setSources]    = useState<IncomeSource[]>([]);
  const [monthly,    setMonthly]    = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Form fields
  const [iName,      setIName]      = useState('');
  const [iCat,       setICat]       = useState<Category>('job');
  const [iAmount,    setIAmount]    = useState('');
  const [iFreq,      setIFreq]      = useState<Frequency>('monthly');

  const loadIncome = useCallback(async () => {
    try {
      const { data } = await incomeApi.list();
      setSources(data.income_sources);
      setMonthly(data.monthly_total);
    } catch (err) { showToast(extractErrorMessage(err), 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadIncome(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIncome();
    setRefreshing(false);
  }, []);

  const handleCreate = async () => {
    if (!iName.trim()) { showToast('Name is required.', 'error'); return; }
    const amt = parseFloat(iAmount);
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    setSaving(true);
    try {
      await incomeApi.create({ name: iName.trim(), category: iCat, amount: amt, frequency: iFreq });
      showToast(`${CATEGORY_META[iCat].icon} "${iName}" added!`, 'success');
      setModalOpen(false);
      setIName(''); setIAmount(''); setICat('job'); setIFreq('monthly');
      loadIncome();
    } catch (err) { showToast(extractErrorMessage(err), 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await incomeApi.delete(id);
      showToast('Income source removed.', 'info');
      loadIncome();
    } catch (err) { showToast(extractErrorMessage(err), 'error'); }
  };

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={Colors.emerald} colors={[Colors.emerald]} />
          }
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.screenTitle}>My Income 💰</Text>
              <Text style={styles.screenSub}>Sources of income</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)} accessibilityRole="button">
              <Text style={styles.addBtnText}>＋ Add</Text>
            </TouchableOpacity>
          </View>

          {/* Monthly Total Card */}
          <GlassCard style={styles.totalCard}>
            <Text style={styles.totalLabel}>Monthly Total Income</Text>
            <Text style={styles.totalAmount}>{formatCurrency(monthly)}</Text>
            <Text style={styles.totalMeta}>{sources.length} source{sources.length !== 1 ? 's' : ''}</Text>
            <View style={styles.totalDivider} />
            {/* Category breakdown */}
            {(['job','freelance','business','investment','other'] as Category[]).map((cat) => {
              const catSources = sources.filter(s => s.category === cat);
              if (catSources.length === 0) return null;
              const catTotal = catSources.reduce((sum, s) => {
                const mult = FREQUENCY_MULTIPLIER[s.frequency as Frequency] || 1;
                return sum + parseFloat(String(s.amount)) * mult;
              }, 0);
              const meta = CATEGORY_META[cat];
              return (
                <View key={cat} style={styles.breakdownRow}>
                  <Text style={styles.breakdownIcon}>{meta.icon}</Text>
                  <Text style={styles.breakdownLabel}>{meta.label}</Text>
                  <Text style={[styles.breakdownAmount, { color: meta.color }]}>{formatCurrency(catTotal)}/mo</Text>
                </View>
              );
            })}
          </GlassCard>

          {/* Income Source List */}
          <Text style={styles.sectionTitle}>All Sources</Text>

          {loading ? (
            <SkeletonList count={3} />
          ) : sources.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyTitle}>No income sources</Text>
              <Text style={styles.emptyText}>Tap "＋ Add" to track your income streams.</Text>
            </View>
          ) : (
            sources.map((src) => {
              const meta = CATEGORY_META[src.category as Category] ?? CATEGORY_META.other;
              const monthlyAmt = parseFloat(String(src.amount)) * (FREQUENCY_MULTIPLIER[src.frequency as Frequency] || 1);
              return (
                <GlassCard key={src.id} style={[styles.sourceCard, { borderLeftColor: meta.color, borderLeftWidth: 3 }]}>
                  <View style={styles.sourceHeader}>
                    <View style={[styles.sourceIcon, { backgroundColor: meta.color + '22' }]}>
                      <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sourceName}>{src.name}</Text>
                      <View style={[styles.catBadge, { backgroundColor: meta.color + '22' }]}>
                        <Text style={[styles.catBadgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(src.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sourceAmounts}>
                    <View style={styles.amountBox}>
                      <Text style={styles.amountBoxLabel}>{FREQUENCY_LABEL[src.frequency as Frequency]}</Text>
                      <Text style={[styles.amountBoxValue, { color: meta.color }]}>{formatCurrency(parseFloat(String(src.amount)))}</Text>
                    </View>
                    <View style={styles.amountDivider} />
                    <View style={styles.amountBox}>
                      <Text style={styles.amountBoxLabel}>Monthly</Text>
                      <Text style={[styles.amountBoxValue, { color: Colors.emerald }]}>{formatCurrency(monthlyAmt)}</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </ScrollView>

        {/* Add Income Modal */}
        <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Income Source</Text>

              <TextInput style={styles.input} placeholder="Source name (e.g. Day Job)"
                placeholderTextColor={Colors.textMuted} value={iName} onChangeText={setIName}
                accessibilityLabel="Income source name" />

              <Text style={styles.pickerLabel}>Category</Text>
              <View style={styles.catGrid}>
                {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
                  const m = CATEGORY_META[cat];
                  return (
                    <TouchableOpacity key={cat}
                      style={[styles.catChip, iCat === cat && { backgroundColor: m.color + '33', borderColor: m.color }]}
                      onPress={() => setICat(cat)} accessibilityRole="button">
                      <Text>{m.icon}</Text>
                      <Text style={[styles.catChipText, iCat === cat && { color: m.color }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput style={styles.input} placeholder="Amount (e.g. 3000)"
                placeholderTextColor={Colors.textMuted} value={iAmount} onChangeText={setIAmount}
                keyboardType="decimal-pad" accessibilityLabel="Amount" />

              <Text style={styles.pickerLabel}>Frequency</Text>
              <View style={styles.freqRow}>
                {(['weekly','biweekly','monthly'] as Frequency[]).map((f) => (
                  <TouchableOpacity key={f} style={[styles.freqChip, iFreq === f && styles.freqChipActive]}
                    onPress={() => setIFreq(f)} accessibilityRole="button">
                    <Text style={[styles.freqChipText, iFreq === f && styles.freqChipTextActive]}>
                      {FREQUENCY_LABEL[f]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]}
                onPress={handleCreate} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Add Income Source</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
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
  container:        { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  screenTitle:      { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  screenSub:        { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  addBtn:           { backgroundColor: Colors.emerald, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, minHeight: MIN_TOUCH, justifyContent: 'center' },
  addBtnText:       { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.sm },
  totalCard:        { padding: Spacing.lg, marginBottom: Spacing.lg },
  totalLabel:       { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },
  totalAmount:      { fontSize: 40, fontWeight: Typography.extrabold, color: Colors.emerald, textAlign: 'center', marginTop: 4 },
  totalMeta:        { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  totalDivider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  breakdownRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  breakdownIcon:    { fontSize: 16, marginRight: 8 },
  breakdownLabel:   { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  breakdownAmount:  { fontSize: Typography.sm, fontWeight: Typography.semibold },
  sectionTitle:     { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  empty:            { alignItems: 'center', marginTop: 80 },
  emptyEmoji:       { fontSize: 60 },
  emptyTitle:       { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: Spacing.md },
  emptyText:        { color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  sourceCard:       { padding: Spacing.md, marginBottom: Spacing.md, overflow: 'hidden' },
  sourceHeader:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sourceIcon:       { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sourceName:       { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  catBadge:         { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  catBadgeText:     { fontSize: Typography.xs, fontWeight: Typography.semibold },
  deleteBtn:        { padding: 8, minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText:    { color: Colors.error, fontSize: Typography.md },
  sourceAmounts:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.slateLight, borderRadius: Radius.md, padding: Spacing.sm },
  amountBox:        { flex: 1, alignItems: 'center' },
  amountBoxLabel:   { fontSize: Typography.xs, color: Colors.textMuted },
  amountBoxValue:   { fontSize: Typography.base, fontWeight: Typography.bold, marginTop: 2 },
  amountDivider:    { width: 1, height: 30, backgroundColor: Colors.border },
  overlay:          { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalCard:        { margin: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.xl },
  modalTitle:       { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  pickerLabel:      { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginBottom: 8, marginTop: 4 },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  catChipText:      { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  freqRow:          { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  freqChip:         { flex: 1, height: 36, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  freqChipActive:   { backgroundColor: Colors.emeraldMuted, borderColor: Colors.emerald },
  freqChipText:     { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
  freqChipTextActive:{ color: Colors.emerald },
  input:            { backgroundColor: Colors.slateLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: MIN_TOUCH + 6, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  btn:              { backgroundColor: Colors.emerald, borderRadius: Radius.md, height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, marginTop: Spacing.sm },
  btnText:          { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  cancelBtn:        { height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  cancelText:       { color: Colors.textMuted, fontSize: Typography.sm },
});
