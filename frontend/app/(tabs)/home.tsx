import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import StreakBadge from '../../components/StreakBadge';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { transfersApi, usersApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

interface Transaction {
  id: string; amount: number; direction: 'sent' | 'received';
  sender_first: string; receiver_first: string; receiver_last: string;
  sender_last: string; type: string; created_at: string; note?: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HomeScreen() {
  const { user, streak, refreshUser } = useAuthStore();
  const { showError, showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading,    setTxLoading]    = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  // Deposit modal state
  const [depositAmt,  setDepositAmt]  = useState('');
  const [depositing,  setDepositing]  = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const { data } = await transfersApi.history(1, 10);
      setTransactions(data.transactions);
    } catch (err) {
      showError(err);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadTransactions()]);
    setRefreshing(false);
  }, []);

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.emerald}
              colors={[Colors.emerald]}
            />
          }
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.name}>{user?.first_name} 👋</Text>
            </View>
            {streak && (
              <StreakBadge
                level={streak.badge_level}
                streak={streak.current_streak}
                compact
              />
            )}
          </View>

          {/* Balance card */}
          <GlassCard style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(parseFloat(String(user?.balance ?? 0)))}
            </Text>
            <View style={styles.balanceRow}>
              <TouchableOpacity
                style={styles.depositBtn}
                onPress={() => showToast('Use the deposit field below', 'info')}
                accessibilityRole="button"
                accessibilityLabel="Add money"
              >
                <Text style={styles.depositBtnText}>＋ Add Money</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Quick deposit */}
          <GlassCard style={styles.quickDeposit}>
            <Text style={styles.sectionTitle}>Quick Deposit</Text>
            <View style={styles.depositRow}>
              {[10, 50, 100, 500].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickBtn}
                  accessibilityLabel={`Deposit $${amt}`}
                  onPress={async () => {
                    setDepositing(true);
                    try {
                      const { data } = await usersApi.deposit(amt);
                      useAuthStore.getState().setBalance(data.balance);
                      showToast(`$${amt} deposited!`, 'success');
                      loadTransactions();
                    } catch (err) {
                      showError(err);
                    } finally {
                      setDepositing(false);
                    }
                  }}
                >
                  <Text style={styles.quickBtnText}>${amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {depositing && <ActivityIndicator color={Colors.emerald} style={{ marginTop: 8 }} />}
          </GlassCard>

          {/* Recent Transactions */}
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <GlassCard style={styles.txCard}>
            {txLoading ? (
              <SkeletonList count={4} />
            ) : transactions.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            ) : (
              transactions.map((tx) => {
                const isSent   = tx.direction === 'sent' && tx.type !== 'deposit';
                const isDeposit = tx.type === 'deposit';
                const counterpart = isSent
                  ? `${tx.receiver_first} ${tx.receiver_last.charAt(0)}.`
                  : isDeposit ? 'Deposit' : `${tx.sender_first} ${tx.sender_last.charAt(0)}.`;

                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: isSent ? Colors.emeraldMuted : 'rgba(59,130,246,0.15)' }]}>
                      <Text style={{ fontSize: 20 }}>{isDeposit ? '🏦' : isSent ? '↑' : '↓'}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName}>{counterpart}</Text>
                      <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: isSent ? Colors.error : Colors.emerald }]}>
                      {isSent ? '-' : '+'}{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:       { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting:        { fontSize: Typography.sm, color: Colors.textMuted },
  name:            { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  balanceCard:     { padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center' },
  balanceLabel:    { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: 4 },
  balanceAmount:   { fontSize: Typography.xxxl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  balanceRow:      { marginTop: Spacing.md },
  depositBtn: {
    backgroundColor: Colors.emeraldMuted, borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  depositBtnText:  { color: Colors.emerald, fontWeight: Typography.semibold, fontSize: Typography.sm },
  quickDeposit:    { padding: Spacing.md, marginBottom: Spacing.lg },
  depositRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  quickBtn: {
    flex: 1, marginHorizontal: 4, backgroundColor: Colors.slateLight,
    borderRadius: Radius.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  quickBtnText:    { color: Colors.emerald, fontWeight: Typography.bold, fontSize: Typography.sm },
  sectionTitle:    { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  txCard:          { overflow: 'hidden', marginBottom: Spacing.lg },
  txRow:           { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon:          { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  txInfo:          { flex: 1, marginLeft: 12 },
  txName:          { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  txDate:          { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  txAmount:        { fontSize: Typography.base, fontWeight: Typography.bold },
  empty:           { padding: Spacing.xl, alignItems: 'center' },
  emptyEmoji:      { fontSize: 40 },
  emptyText:       { color: Colors.textMuted, marginTop: Spacing.sm },
});
