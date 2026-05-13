import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import StreakBadge from '../../components/StreakBadge';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { usersApi, expensesApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

/** Extract a user-friendly error message from an Axios error response. */
function extractErrorMessage(err: any): string {
  const apiMsg = err?.response?.data?.error?.message;
  if (apiMsg) return apiMsg;
  if (err?.message) return err.message;
  return 'Database Sync Error';
}

interface Expense {
  id: string; amount: number; category: string; note?: string; created_at: string;
}

const EXPENSE_CATEGORIES = [
  { key: 'food',          emoji: '🍔', label: 'Food',      color: '#F59E0B' },
  { key: 'transport',     emoji: '🚗', label: 'Transport', color: '#3B82F6' },
  { key: 'bills',         emoji: '💡', label: 'Bills',     color: '#EF4444' },
  { key: 'entertainment', emoji: '🎮', label: 'Fun',       color: '#8B5CF6' },
  { key: 'health',        emoji: '💊', label: 'Health',    color: '#10B981' },
  { key: 'shopping',      emoji: '🛍️', label: 'Shopping', color: '#EC4899' },
  { key: 'other',         emoji: '💸', label: 'Other',     color: '#6B7280' },
];

const CAT_EMOJI: Record<string, string> = {
  food: '🍔', transport: '🚗', bills: '💡', entertainment: '🎮',
  health: '💊', shopping: '🛍️', other: '💸',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function HomeScreen() {
  const { user, streak, refreshUser } = useAuthStore();
  const { showError, showToast }      = useToast();

  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [txLoading,   setTxLoading]   = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [depositing,  setDepositing]  = useState(false);

  // Expense modal
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expCat,      setExpCat]      = useState('food');
  const [expAmount,   setExpAmount]   = useState('');
  const [expNote,     setExpNote]     = useState('');
  const [expSaving,   setExpSaving]   = useState(false);

  const loadExpenses = useCallback(async () => {
    try {
      const { data } = await expensesApi.list(1, 10);
      setExpenses(data.expenses);
    } catch (err) { showError(err); }
    finally { setTxLoading(false); }
  }, []);

  useEffect(() => { loadExpenses(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadExpenses()]);
    setRefreshing(false);
  }, []);

  const handleAddExpense = async () => {
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }

    // ── Client-side balance validation ────────────────────────────────
    const currentBalance = parseFloat(String(user?.balance ?? 0));
    if (amount > currentBalance) {
      showToast('Insufficient Funds', 'error');
      return;
    }

    setExpSaving(true);
    try {
      const { data } = await expensesApi.add({ amount, category: expCat, note: expNote || undefined });
      useAuthStore.getState().setBalance(data.new_balance);
      const apiMessage = data.message || 'Transaction Successful';
      showToast(`${CAT_EMOJI[expCat] ?? '💸'} ${apiMessage} — -${formatCurrency(amount)} recorded!`, 'success');
      setExpenseOpen(false); setExpAmount(''); setExpNote(''); setExpCat('food');
      loadExpenses();
    } catch (err) { showToast(extractErrorMessage(err), 'error'); }
    finally { setExpSaving(false); }
  };

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
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
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.name}>{user?.first_name} 👋</Text>
            </View>
            {streak && <StreakBadge level={streak.badge_level} streak={streak.current_streak} compact />}
          </View>

          {/* Balance Card */}
          <GlassCard style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(parseFloat(String(user?.balance ?? 0)))}
            </Text>

            {/* Quick Deposit */}
            <Text style={styles.quickLabel}>Quick Deposit</Text>
            <View style={styles.depositRow}>
              {[10, 50, 100, 500].map((amt) => (
                <TouchableOpacity key={amt} style={styles.quickBtn} accessibilityLabel={`Deposit $${amt}`}
                  onPress={async () => {
                    setDepositing(true);
                    try {
                      const { data } = await usersApi.deposit(amt);
                      useAuthStore.getState().setBalance(data.balance);
                      showToast(`+${formatCurrency(amt)} added!`, 'success');
                    } catch (err) { showError(err); }
                    finally { setDepositing(false); }
                  }}>
                  <Text style={styles.quickBtnText}>${amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {depositing && <ActivityIndicator color={Colors.emerald} style={{ marginTop: 8 }} />}

            {/* Add Expense button */}
            <TouchableOpacity style={styles.expenseBtn} onPress={() => setExpenseOpen(true)}
              accessibilityRole="button" accessibilityLabel="Add expense">
              <Text style={styles.expenseBtnText}>➖ Add Expense</Text>
            </TouchableOpacity>
          </GlassCard>

          {/* Recent Expenses */}
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <GlassCard style={styles.txCard}>
            {txLoading ? (
              <SkeletonList count={4} />
            ) : expenses.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>No expenses yet.{'\n'}Tap "Add Expense" to start tracking!</Text>
              </View>
            ) : (
              expenses.map((exp) => {
                const cat = EXPENSE_CATEGORIES.find(c => c.key === exp.category) ?? EXPENSE_CATEGORIES[6];
                return (
                  <View key={exp.id} style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: cat.color + '22' }]}>
                      <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName}>{exp.note || cat.label}</Text>
                      <Text style={styles.txDate}>{formatDate(exp.created_at)}</Text>
                    </View>
                    <Text style={styles.txAmount}>-{formatCurrency(parseFloat(String(exp.amount)))}</Text>
                  </View>
                );
              })
            )}
          </GlassCard>
        </ScrollView>
      </SafeAreaView>

      {/* ── Expense Modal ── */}
      <Modal visible={expenseOpen} transparent animationType="slide" onRequestClose={() => setExpenseOpen(false)}>
        <View style={styles.overlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <Text style={styles.modalSub}>
              Available: {formatCurrency(parseFloat(String(user?.balance ?? 0)))}
            </Text>

            <Text style={styles.pickerLabel}>Category</Text>
            <View style={styles.catGrid}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat.key}
                  style={[styles.catChip, expCat === cat.key && { backgroundColor: cat.color + '33', borderColor: cat.color }]}
                  onPress={() => setExpCat(cat.key)} accessibilityRole="button">
                  <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                  <Text style={[styles.catChipText, expCat === cat.key && { color: cat.color }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { fontSize: 28, fontWeight: Typography.bold, textAlign: 'center', height: 64 }]}
              placeholder="0.00" placeholderTextColor={Colors.textMuted}
              value={expAmount} onChangeText={setExpAmount}
              keyboardType="decimal-pad" accessibilityLabel="Expense amount"
            />
            <TextInput
              style={styles.input} placeholder="Note (optional)"
              placeholderTextColor={Colors.textMuted}
              value={expNote} onChangeText={setExpNote}
              maxLength={200} accessibilityLabel="Expense note"
            />

            <TouchableOpacity style={[styles.expenseSubmitBtn, expSaving && { opacity: 0.6 }]}
              onPress={handleAddExpense} disabled={expSaving} accessibilityRole="button">
              {expSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Record Expense</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setExpenseOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:        { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting:         { fontSize: Typography.sm, color: Colors.textMuted },
  name:             { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  balanceCard:      { padding: Spacing.lg, marginBottom: Spacing.lg, alignItems: 'center' },
  balanceLabel:     { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: 4 },
  balanceAmount:    { fontSize: Typography.xxxl, fontWeight: Typography.extrabold, color: Colors.textPrimary, marginBottom: Spacing.md },
  quickLabel:       { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 6, alignSelf: 'flex-start' },
  depositRow:       { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  quickBtn:         { flex: 1, marginHorizontal: 4, backgroundColor: Colors.slateLight, borderRadius: Radius.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  quickBtnText:     { color: Colors.emerald, fontWeight: Typography.bold, fontSize: Typography.sm },
  expenseBtn:       { marginTop: Spacing.md, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: Radius.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', width: '100%' },
  expenseBtnText:   { color: Colors.error, fontWeight: Typography.semibold, fontSize: Typography.sm },
  sectionTitle:     { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  txCard:           { overflow: 'hidden', marginBottom: Spacing.lg },
  txRow:            { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon:           { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txInfo:           { flex: 1, marginLeft: 12 },
  txName:           { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  txDate:           { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  txAmount:         { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.error },
  empty:            { padding: Spacing.xl, alignItems: 'center' },
  emptyEmoji:       { fontSize: 40 },
  emptyText:        { color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20 },
  overlay:          { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalCard:        { margin: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.xl },
  modalTitle:       { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  modalSub:         { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  pickerLabel:      { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginBottom: 8 },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  catChip:          { alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 8, minWidth: 60 },
  catChipText:      { fontSize: 10, color: Colors.textSecondary, marginTop: 2, fontWeight: Typography.medium },
  input:            { backgroundColor: Colors.slateLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: MIN_TOUCH + 6, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, width: '100%' },
  expenseSubmitBtn: { backgroundColor: Colors.error, borderRadius: Radius.md, height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, marginTop: Spacing.sm },
  btnText:          { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  cancelBtn:        { height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  cancelText:       { color: Colors.textMuted, fontSize: Typography.sm },
});
