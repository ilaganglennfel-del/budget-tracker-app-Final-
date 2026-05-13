import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import StreakBadge from '../../components/StreakBadge';
import GardenModal from '../../components/GardenModal';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { streaksApi, gardenApi, expensesApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

interface StreakData {
  current_streak: number; longest_streak: number;
  badge_level: 'seedling' | 'sprout' | 'plant' | 'tree';
  restore_uses_this_month: number; restore_month_year: string;
}
interface Flower { id: string; flower_type: string; is_shiny: boolean; earned_at: string; streak_value: number; }

const EXPENSE_CATEGORIES = [
  { key: 'food',          emoji: '🍔', label: 'Food' },
  { key: 'transport',     emoji: '🚗', label: 'Transport' },
  { key: 'bills',         emoji: '💡', label: 'Bills' },
  { key: 'entertainment', emoji: '🎮', label: 'Fun' },
  { key: 'health',        emoji: '💊', label: 'Health' },
  { key: 'shopping',      emoji: '🛍️', label: 'Shopping' },
  { key: 'other',         emoji: '💸', label: 'Other' },
];

export default function ProfileScreen() {
  const { user, streak: storeStreak, logout, pingStreak } = useAuthStore();
  const { showError, showToast } = useToast();
  const [streak,      setStreak]      = useState<StreakData | null>(storeStreak as any);
  const [flowers,     setFlowers]     = useState<Flower[]>([]);
  const [refreshing,  setRefreshing]  = useState(false);
  const [restoring,   setRestoring]   = useState(false);
  const [gardenOpen,  setGardenOpen]  = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [streakRes, gardenRes] = await Promise.all([streaksApi.get(), gardenApi.list()]);
      setStreak(streakRes.data.streak);
      setFlowers(gardenRes.data.flowers);
    } catch (err) { showError(err); }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleRestore = async () => {
    if (!streak) return;
    const usesLeft = 5 - (streak.restore_uses_this_month || 0);
    Alert.alert('Restore Streak', `You have ${usesLeft} restore${usesLeft !== 1 ? 's' : ''} remaining this month. Use one now?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', style: 'default', onPress: async () => {
        setRestoring(true);
        try {
          const { data } = await streaksApi.restore();
          setStreak(data.streak); pingStreak();
          showToast('Streak restored! Keep it going 🔥', 'success');
        } catch (err) { showError(err); }
        finally { setRestoring(false); }
      }},
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const restoreUsesLeft = 5 - (streak?.restore_uses_this_month || 0);
  const canRestore      = restoreUsesLeft > 0;
  const shinyCount      = flowers.filter(f => f.is_shiny).length;
  const previewFlowers  = flowers.slice(0, 6);

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.emerald} colors={[Colors.emerald]} />}>

          <Text style={styles.screenTitle}>Profile</Text>

          {/* User info card */}
          <GlassCard style={styles.userCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{user?.first_name?.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </GlassCard>

          {/* Streak card */}
          <GlassCard style={styles.streakCard}>
            <Text style={styles.sectionTitle}>Your Streak</Text>
            {streak ? (
              <>
                <StreakBadge level={streak.badge_level} streak={streak.current_streak} longestStreak={streak.longest_streak} />
                <View style={styles.restoreRow}>
                  <View>
                    <Text style={styles.restoreLabel}>Streak Restores</Text>
                    <Text style={styles.restoreCount}>{restoreUsesLeft} / 5 remaining this month</Text>
                  </View>
                  <TouchableOpacity style={[styles.restoreBtn, !canRestore && styles.restoreBtnDisabled]}
                    onPress={handleRestore} disabled={!canRestore || restoring} accessibilityRole="button">
                    {restoring ? <ActivityIndicator color={Colors.white} size="small" />
                      : <Text style={styles.restoreBtnText}>{canRestore ? '🔄 Restore' : '🚫 Used up'}</Text>}
                  </TouchableOpacity>
                </View>
                <View style={styles.badgeRow}>
                  {(['seedling','sprout','plant','tree'] as const).map((lvl) => {
                    const emojis     = { seedling: '🌱', sprout: '🌿', plant: '🪴', tree: '🌳' };
                    const thresholds = { seedling: 0, sprout: 5, plant: 10, tree: 15 };
                    const active = streak.current_streak >= thresholds[lvl];
                    return (
                      <View key={lvl} style={[styles.badgeStep, active && styles.badgeStepActive]}>
                        <Text style={{ fontSize: 20 }}>{emojis[lvl]}</Text>
                        <Text style={[styles.badgeStepLabel, { color: active ? Colors.emerald : Colors.textMuted }]}>{thresholds[lvl]}d</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : <ActivityIndicator color={Colors.emerald} />}
          </GlassCard>

          {/* ── Garden Preview ── */}
          <GlassCard style={styles.gardenCard}>
            <View style={styles.gardenHeader}>
              <View>
                <Text style={styles.sectionTitle}>🌸 My Garden</Text>
                <Text style={styles.gardenMeta}>
                  {flowers.length === 0
                    ? 'Deposit for 3 days to earn your first flower!'
                    : `${shinyCount} shiny · ${flowers.length - shinyCount} faded`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setGardenOpen(true)} style={styles.gardenViewBtn} accessibilityRole="button">
                <Text style={styles.gardenViewBtnText}>View All →</Text>
              </TouchableOpacity>
            </View>

            {flowers.length === 0 ? (
              <View style={styles.gardenEmpty}>
                <Text style={{ fontSize: 48 }}>🌱</Text>
                <Text style={styles.gardenEmptyText}>Keep your streak alive to grow flowers</Text>
              </View>
            ) : (
              <View style={styles.flowerPreviewRow}>
                {previewFlowers.map((f) => {
                  const EMOJIS: Record<string, string> = {
                    rose:'🌹', sunflower:'🌻', tulip:'🌷', sakura:'🌸', hibiscus:'🌺', daisy:'🌼',
                  };
                  return (
                    <View key={f.id} style={[styles.flowerPreview, !f.is_shiny && styles.flowerPreviewDim]}>
                      <Text style={[styles.flowerPreviewEmoji, !f.is_shiny && { opacity: 0.3 }]}>
                        {EMOJIS[f.flower_type] ?? '🌸'}
                      </Text>
                    </View>
                  );
                })}
                {flowers.length > 6 && (
                  <View style={styles.flowerPreviewMore}>
                    <Text style={styles.flowerPreviewMoreText}>+{flowers.length - 6}</Text>
                  </View>
                )}
              </View>
            )}
          </GlassCard>

          {/* Stats card */}
          <GlassCard style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Account Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>${parseFloat(String(user?.balance ?? 0)).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Balance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{streak?.longest_streak ?? 0}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{flowers.length}</Text>
                <Text style={styles.statLabel}>Flowers</Text>
              </View>
            </View>
          </GlassCard>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>

        <GardenModal visible={gardenOpen} flowers={flowers} onClose={() => setGardenOpen(false)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:          { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  screenTitle:        { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  userCard:           { alignItems: 'center', padding: Spacing.xl, marginBottom: Spacing.md },
  avatarCircle:       { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.emerald, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },
  avatarText:         { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: Colors.white },
  userName:           { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  userEmail:          { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4 },
  streakCard:         { padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle:       { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  restoreRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  restoreLabel:       { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  restoreCount:       { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  restoreBtn:         { backgroundColor: Colors.emerald, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', minWidth: 100 },
  restoreBtnDisabled: { backgroundColor: Colors.slateLight },
  restoreBtnText:     { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.sm },
  badgeRow:           { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg },
  badgeStep:          { alignItems: 'center', flex: 1, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.slateLight, marginHorizontal: 4 },
  badgeStepActive:    { backgroundColor: Colors.emeraldMuted, borderWidth: 1, borderColor: Colors.glassBorder },
  badgeStepLabel:     { fontSize: Typography.xs, marginTop: 2, fontWeight: Typography.medium },
  gardenCard:         { padding: Spacing.lg, marginBottom: Spacing.md },
  gardenHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  gardenMeta:         { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  gardenViewBtn:      { paddingVertical: 4, paddingHorizontal: 8 },
  gardenViewBtnText:  { color: Colors.emerald, fontWeight: Typography.semibold, fontSize: Typography.sm },
  gardenEmpty:        { alignItems: 'center', paddingVertical: Spacing.lg },
  gardenEmptyText:    { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 8 },
  flowerPreviewRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  flowerPreview:      { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.emeraldMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  flowerPreviewDim:   { backgroundColor: Colors.slateLight, borderColor: Colors.border },
  flowerPreviewEmoji: { fontSize: 26 },
  flowerPreviewMore:  { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.slateLight, justifyContent: 'center', alignItems: 'center' },
  flowerPreviewMoreText:{ fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.bold },
  statsCard:          { padding: Spacing.lg, marginBottom: Spacing.md },
  statsRow:           { flexDirection: 'row', alignItems: 'center' },
  statBox:            { flex: 1, alignItems: 'center' },
  statValue:          { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.emerald },
  statLabel:          { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4 },
  statDivider:        { width: 1, height: 40, backgroundColor: Colors.border },
  logoutBtn:          { borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  logoutText:         { color: Colors.error, fontWeight: Typography.semibold, fontSize: Typography.md },
});
