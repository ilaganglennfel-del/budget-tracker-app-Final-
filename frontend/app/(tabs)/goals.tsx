import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { useToast } from '../../components/Toast';
import { goalsApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

interface Goal {
  id: string; name: string; emoji: string;
  target_amount: number; current_amount: number;
  target_date: string; daily_target: number;
  progress_pct: number; status: 'on_track' | 'overdue' | 'completed';
  days_remaining: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

const STATUS_COLOR = {
  on_track:  Colors.emerald,
  overdue:   Colors.warning,
  completed: Colors.info,
};

export default function GoalsScreen() {
  const { showError, showToast } = useToast();
  const [goals,      setGoals]      = useState<Goal[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [saving,     setSaving]     = useState(false);

  // New goal form
  const [gName,   setGName]   = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gDate,   setGDate]   = useState('');
  const [gEmoji,  setGEmoji]  = useState('🎯');

  // Add-progress modal
  const [progressModal, setProgressModal] = useState(false);
  const [activeGoal,    setActiveGoal]    = useState<Goal | null>(null);
  const [addAmount,     setAddAmount]     = useState('');

  const loadGoals = useCallback(async () => {
    try {
      const { data } = await goalsApi.list();
      setGoals(data.goals);
    } catch (err) { showError(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGoals(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  }, []);

  const handleCreate = async () => {
    if (!gName.trim() || !gTarget || !gDate) {
      showToast('Name, target amount, and date are required.', 'error'); return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(gDate)) {
      showToast('Date must be in YYYY-MM-DD format.', 'error'); return;
    }
    setSaving(true);
    try {
      await goalsApi.create({ name: gName.trim(), target_amount: parseFloat(gTarget), target_date: gDate, emoji: gEmoji });
      showToast('Goal created! 🎯', 'success');
      setModalOpen(false);
      setGName(''); setGTarget(''); setGDate(''); setGEmoji('🎯');
      loadGoals();
    } catch (err) { showError(err); }
    finally { setSaving(false); }
  };

  const handleAddProgress = async () => {
    if (!activeGoal || !addAmount) return;
    const parsed = parseFloat(addAmount);
    if (isNaN(parsed) || parsed <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    try {
      const newAmount = Math.min(
        parseFloat(String(activeGoal.target_amount)),
        parseFloat(String(activeGoal.current_amount)) + parsed
      );
      await goalsApi.update(activeGoal.id, { current_amount: newAmount });
      showToast(`+${formatCurrency(parsed)} added!`, 'success');
      setProgressModal(false); setAddAmount('');
      loadGoals();
    } catch (err) { showError(err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await goalsApi.delete(id);
      showToast('Goal deleted.', 'info');
      loadGoals();
    } catch (err) { showError(err); }
  };

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.emerald} colors={[Colors.emerald]} />}
        >
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>My Goals</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)} accessibilityRole="button" accessibilityLabel="Add new goal">
              <Text style={styles.addBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.emerald} size="large" style={{ marginTop: 60 }} />
          ) : goals.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>No goals yet</Text>
              <Text style={styles.emptyText}>Tap "+ New" to start saving toward something.</Text>
            </View>
          ) : (
            goals.map((goal) => {
              const statusColor = STATUS_COLOR[goal.status] ?? Colors.textMuted;
              const pct = Math.min(100, goal.progress_pct ?? 0);
              return (
                <GlassCard key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {goal.status === 'overdue' ? '⚠️ Overdue' : goal.status === 'completed' ? '✅ Completed' : `${goal.days_remaining}d left`}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(goal.id)} style={styles.deleteBtn} accessibilityLabel="Delete goal">
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: statusColor }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressCurrent}>{formatCurrency(goal.current_amount)}</Text>
                    <Text style={styles.progressPct}>{pct}%</Text>
                    <Text style={styles.progressTarget}>{formatCurrency(goal.target_amount)}</Text>
                  </View>

                  <View style={styles.dailyRow}>
                    <Text style={styles.dailyLabel}>Daily target:</Text>
                    <Text style={[styles.dailyValue, { color: statusColor }]}>{formatCurrency(goal.daily_target)}/day</Text>
                  </View>

                  {goal.status !== 'completed' && (
                    <TouchableOpacity
                      style={styles.progressBtn}
                      onPress={() => { setActiveGoal(goal); setProgressModal(true); }}
                      accessibilityRole="button" accessibilityLabel="Add savings to goal"
                    >
                      <Text style={styles.progressBtnText}>+ Add Savings</Text>
                    </TouchableOpacity>
                  )}
                </GlassCard>
              );
            })
          )}
        </ScrollView>

        {/* Create Goal Modal */}
        <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Goal</Text>
              <TextInput style={styles.input} placeholder="Goal name" placeholderTextColor={Colors.textMuted} value={gName} onChangeText={setGName} accessibilityLabel="Goal name" />
              <TextInput style={styles.input} placeholder="Target amount (e.g. 500)" placeholderTextColor={Colors.textMuted} value={gTarget} onChangeText={setGTarget} keyboardType="decimal-pad" accessibilityLabel="Target amount" />
              <TextInput style={styles.input} placeholder="Target date (YYYY-MM-DD)" placeholderTextColor={Colors.textMuted} value={gDate} onChangeText={setGDate} accessibilityLabel="Target date" />
              <TextInput style={styles.input} placeholder="Emoji (optional)" placeholderTextColor={Colors.textMuted} value={gEmoji} onChangeText={setGEmoji} maxLength={2} accessibilityLabel="Emoji" />
              <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Create Goal</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setModalOpen(false)} accessibilityRole="button">
                <Text style={styles.backBtnText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        {/* Add Progress Modal */}
        <Modal visible={progressModal} transparent animationType="slide" onRequestClose={() => setProgressModal(false)}>
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Savings</Text>
              <Text style={styles.modalSubtitle}>{activeGoal?.name}</Text>
              <TextInput style={styles.input} placeholder="Amount saved" placeholderTextColor={Colors.textMuted} value={addAmount} onChangeText={setAddAmount} keyboardType="decimal-pad" accessibilityLabel="Amount saved" />
              <TouchableOpacity style={styles.btn} onPress={handleAddProgress} accessibilityRole="button">
                <Text style={styles.btnText}>Save Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => setProgressModal(false)} accessibilityRole="button">
                <Text style={styles.backBtnText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:       { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  screenTitle:     { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  addBtn:          { backgroundColor: Colors.emerald, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, minHeight: MIN_TOUCH, justifyContent: 'center' },
  addBtnText:      { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.sm },
  empty:           { alignItems: 'center', marginTop: 80 },
  emptyEmoji:      { fontSize: 60 },
  emptyTitle:      { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: Spacing.md },
  emptyText:       { color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  goalCard:        { padding: Spacing.md, marginBottom: Spacing.md },
  goalHeader:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  goalEmoji:       { fontSize: 32 },
  goalName:        { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  statusBadge:     { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusText:      { fontSize: Typography.xs, fontWeight: Typography.semibold },
  deleteBtn:       { padding: 8, minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText:   { color: Colors.error, fontSize: Typography.md },
  progressTrack:   { height: 8, backgroundColor: Colors.slateLight, borderRadius: 4, overflow: 'hidden', marginVertical: Spacing.sm },
  progressFill:    { height: '100%', borderRadius: 4 },
  progressLabels:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressCurrent: { fontSize: Typography.xs, color: Colors.textSecondary },
  progressPct:     { fontSize: Typography.xs, color: Colors.textMuted },
  progressTarget:  { fontSize: Typography.xs, color: Colors.textSecondary },
  dailyRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  dailyLabel:      { fontSize: Typography.sm, color: Colors.textMuted },
  dailyValue:      { fontSize: Typography.sm, fontWeight: Typography.bold },
  progressBtn:     { backgroundColor: Colors.emeraldMuted, borderRadius: Radius.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  progressBtnText: { color: Colors.emerald, fontWeight: Typography.semibold, fontSize: Typography.sm },
  modalOverlay:    { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalCard:       { margin: Spacing.md, padding: Spacing.lg, marginBottom: Spacing.xl },
  modalTitle:      { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  modalSubtitle:   { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  input:           { backgroundColor: Colors.slateLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: MIN_TOUCH + 6, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  btn:             { backgroundColor: Colors.emerald, borderRadius: Radius.md, height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, marginTop: Spacing.sm },
  btnText:         { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  backBtn:         { height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  backBtnText:     { color: Colors.textMuted, fontSize: Typography.sm },
});
