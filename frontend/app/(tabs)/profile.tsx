import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import StreakBadge from '../../components/StreakBadge';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { streaksApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

interface StreakData {
  current_streak: number;
  longest_streak: number;
  badge_level: 'seedling' | 'sprout' | 'plant' | 'tree';
  restore_uses_this_month: number;
  restore_month_year: string;
}

export default function ProfileScreen() {
  const { user, streak: storeStreak, logout, pingStreak } = useAuthStore();
  const { showError, showToast } = useToast();
  const [streak,     setStreak]     = useState<StreakData | null>(storeStreak as any);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [restoring,  setRestoring]  = useState(false);

  const loadStreak = useCallback(async () => {
    try {
      const { data } = await streaksApi.get();
      setStreak(data.streak);
    } catch (err) { showError(err); }
  }, []);

  useEffect(() => { loadStreak(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStreak();
    setRefreshing(false);
  }, []);

  const handleRestore = async () => {
    if (!streak) return;
    const usesLeft = 5 - (streak.restore_uses_this_month || 0);
    Alert.alert(
      'Restore Streak',
      `You have ${usesLeft} restore${usesLeft !== 1 ? 's' : ''} remaining this month. Use one now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', style: 'default',
          onPress: async () => {
            setRestoring(true);
            try {
              const { data } = await streaksApi.restore();
              setStreak(data.streak);
              pingStreak();
              showToast('Streak restored! Keep it going 🔥', 'success');
            } catch (err) { showError(err); }
            finally { setRestoring(false); }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const restoreUsesLeft = 5 - (streak?.restore_uses_this_month || 0);
  const canRestore      = restoreUsesLeft > 0;

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.emerald} colors={[Colors.emerald]} />}
        >
          <Text style={styles.screenTitle}>Profile</Text>

          {/* User info card */}
          <GlassCard style={styles.userCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.first_name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </GlassCard>

          {/* Streak card */}
          <GlassCard style={styles.streakCard}>
            <Text style={styles.sectionTitle}>Your Streak</Text>
            {streak ? (
              <>
                <StreakBadge
                  level={streak.badge_level}
                  streak={streak.current_streak}
                  longestStreak={streak.longest_streak}
                />

                {/* Restore button */}
                <View style={styles.restoreRow}>
                  <View>
                    <Text style={styles.restoreLabel}>Streak Restores</Text>
                    <Text style={styles.restoreCount}>
                      {restoreUsesLeft} / 5 remaining this month
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.restoreBtn, !canRestore && styles.restoreBtnDisabled]}
                    onPress={handleRestore}
                    disabled={!canRestore || restoring}
                    accessibilityRole="button"
                    accessibilityLabel="Restore streak"
                  >
                    {restoring
                      ? <ActivityIndicator color={Colors.white} size="small" />
                      : <Text style={styles.restoreBtnText}>
                          {canRestore ? '🔄 Restore' : '🚫 Used up'}
                        </Text>
                    }
                  </TouchableOpacity>
                </View>

                {/* Badge progression */}
                <View style={styles.badgeRow}>
                  {(['seedling', 'sprout', 'plant', 'tree'] as const).map((lvl, i) => {
                    const emojis   = { seedling: '🌱', sprout: '🌿', plant: '🪴', tree: '🌳' };
                    const thresholds = { seedling: 0, sprout: 5, plant: 10, tree: 15 };
                    const active   = streak.current_streak >= thresholds[lvl];
                    return (
                      <View key={lvl} style={[styles.badgeStep, active && styles.badgeStepActive]}>
                        <Text style={{ fontSize: 20 }}>{emojis[lvl]}</Text>
                        <Text style={[styles.badgeStepLabel, { color: active ? Colors.emerald : Colors.textMuted }]}>
                          {thresholds[lvl]}d
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <ActivityIndicator color={Colors.emerald} />
            )}
          </GlassCard>

          {/* Stats card */}
          <GlassCard style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Account Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  ${parseFloat(String(user?.balance ?? 0)).toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Balance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{streak?.longest_streak ?? 0}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
            </View>
          </GlassCard>

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:         { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  screenTitle:       { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  userCard:          { alignItems: 'center', padding: Spacing.xl, marginBottom: Spacing.md },
  avatarCircle:      { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.emerald, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },
  avatarText:        { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: Colors.white },
  userName:          { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  userEmail:         { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4 },
  streakCard:        { padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle:      { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  restoreRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  restoreLabel:      { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  restoreCount:      { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  restoreBtn:        { backgroundColor: Colors.emerald, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', minWidth: 100 },
  restoreBtnDisabled:{ backgroundColor: Colors.slateLight },
  restoreBtnText:    { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.sm },
  badgeRow:          { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg },
  badgeStep:         { alignItems: 'center', flex: 1, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.slateLight, marginHorizontal: 4 },
  badgeStepActive:   { backgroundColor: Colors.emeraldMuted, borderWidth: 1, borderColor: Colors.glassBorder },
  badgeStepLabel:    { fontSize: Typography.xs, marginTop: 2, fontWeight: Typography.medium },
  statsCard:         { padding: Spacing.lg, marginBottom: Spacing.md },
  statsRow:          { flexDirection: 'row', alignItems: 'center' },
  statBox:           { flex: 1, alignItems: 'center' },
  statValue:         { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.emerald },
  statLabel:         { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4 },
  statDivider:       { width: 1, height: 40, backgroundColor: Colors.border },
  logoutBtn:         { borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  logoutText:        { color: Colors.error, fontWeight: Typography.semibold, fontSize: Typography.md },
});
