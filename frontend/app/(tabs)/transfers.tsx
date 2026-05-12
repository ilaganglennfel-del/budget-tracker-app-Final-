import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';
import { usersApi, transfersApi } from '../../services/api';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

type Step = 'search' | 'confirm' | 'amount';

export default function TransfersScreen() {
  const { user, refreshUser } = useAuthStore();
  const { showError, showToast } = useToast();
  const [step,          setStep]          = useState<Step>('search');
  const [emailInput,    setEmailInput]    = useState('');
  const [displayName,   setDisplayName]   = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount,        setAmount]        = useState('');
  const [note,          setNote]          = useState('');
  const [searching,     setSearching]     = useState(false);
  const [sending,       setSending]       = useState(false);
  const slideX = useRef(new Animated.Value(0)).current;

  const animateForward = () => {
    slideX.setValue(300);
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
  };

  const handleSearch = async () => {
    if (!emailInput.trim()) { showToast('Enter a recipient email.', 'error'); return; }
    if (emailInput.trim().toLowerCase() === user?.email?.toLowerCase()) {
      showToast("You can't send to yourself.", 'error'); return;
    }
    setSearching(true);
    try {
      const { data } = await usersApi.search(emailInput.trim());
      setDisplayName(data.display_name);
      setReceiverEmail(data.email);
      animateForward(); setStep('confirm');
    } catch (err) { showError(err); }
    finally { setSearching(false); }
  };

  const handleSend = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    if (parsed > parseFloat(String(user?.balance ?? 0))) {
      showToast("Insufficient funds.", 'error'); return;
    }
    setSending(true);
    try {
      await transfersApi.send({ receiver_email: receiverEmail, amount: parsed, note });
      await refreshUser();
      showToast(`$${parsed.toFixed(2)} sent to ${displayName}!`, 'success');
      setStep('search'); setEmailInput(''); setAmount(''); setNote('');
    } catch (err) { showError(err); }
    finally { setSending(false); }
  };

  const steps: Step[] = ['search', 'confirm', 'amount'];
  const stepIndex = steps.indexOf(step);

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.screenTitle}>Send Money</Text>
            <View style={styles.stepDots}>
              {steps.map((s, i) => (
                <View key={s} style={[styles.dot, i <= stepIndex && styles.dotActive]} />
              ))}
            </View>
            <Animated.View style={{ transform: [{ translateX: slideX }] }}>
              {step === 'search' && (
                <GlassCard style={styles.card}>
                  <Text style={styles.stepLabel}>Step 1 of 3</Text>
                  <Text style={styles.cardTitle}>Who are you sending to?</Text>
                  <Text style={styles.inputLabel}>Recipient Email</Text>
                  <TextInput style={styles.input} placeholder="recipient@example.com"
                    placeholderTextColor={Colors.textMuted} value={emailInput}
                    onChangeText={setEmailInput} keyboardType="email-address"
                    autoCapitalize="none" autoCorrect={false} accessibilityLabel="Recipient email" />
                  <TouchableOpacity style={[styles.btn, searching && styles.btnDisabled]}
                    onPress={handleSearch} disabled={searching} accessibilityRole="button">
                    {searching ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Search →</Text>}
                  </TouchableOpacity>
                </GlassCard>
              )}
              {step === 'confirm' && (
                <GlassCard style={styles.card}>
                  <Text style={styles.stepLabel}>Step 2 of 3</Text>
                  <Text style={styles.cardTitle}>Confirm Recipient</Text>
                  <View style={styles.recipientBox}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.recipientName}>{displayName}</Text>
                      <Text style={styles.recipientEmail}>{receiverEmail}</Text>
                    </View>
                  </View>
                  <Text style={styles.confirmNote}>⚠️ Verify this is correct before continuing.</Text>
                  <TouchableOpacity style={styles.btn} onPress={() => { animateForward(); setStep('amount'); }} accessibilityRole="button">
                    <Text style={styles.btnText}>Yes, Continue →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setStep('search')} accessibilityRole="button">
                    <Text style={styles.backBtnText}>← Search Again</Text>
                  </TouchableOpacity>
                </GlassCard>
              )}
              {step === 'amount' && (
                <GlassCard style={styles.card}>
                  <Text style={styles.stepLabel}>Step 3 of 3</Text>
                  <Text style={styles.cardTitle}>How much?</Text>
                  <Text style={styles.sendingTo}>To <Text style={{ color: Colors.emerald }}>{displayName}</Text></Text>
                  <TextInput style={[styles.input, styles.amountInput]} placeholder="0.00"
                    placeholderTextColor={Colors.textMuted} value={amount}
                    onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Amount" />
                  <Text style={styles.balanceHint}>
                    Available: ${parseFloat(String(user?.balance ?? 0)).toFixed(2)}
                  </Text>
                  <Text style={styles.inputLabel}>Note (optional)</Text>
                  <TextInput style={styles.input} placeholder="Lunch, rent…"
                    placeholderTextColor={Colors.textMuted} value={note}
                    onChangeText={setNote} maxLength={200} accessibilityLabel="Note" />
                  <TouchableOpacity style={[styles.btn, sending && styles.btnDisabled]}
                    onPress={handleSend} disabled={sending} accessibilityRole="button">
                    {sending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Send Money 💸</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setStep('confirm')} accessibilityRole="button">
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                </GlassCard>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:     { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  screenTitle:   { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary, marginBottom: Spacing.md },
  stepDots:      { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  dot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.slateLight },
  dotActive:     { backgroundColor: Colors.emerald, width: 24 },
  card:          { padding: Spacing.lg },
  stepLabel:     { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 4 },
  cardTitle:     { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  inputLabel:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginBottom: 6 },
  input: {
    backgroundColor: Colors.slateLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: MIN_TOUCH + 6,
    color: Colors.textPrimary, fontSize: Typography.base,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  amountInput:   { fontSize: Typography.xxl, fontWeight: Typography.bold, textAlign: 'center', height: 64 },
  balanceHint:   { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'right', marginTop: -12, marginBottom: Spacing.md },
  btn: {
    backgroundColor: Colors.emerald, borderRadius: Radius.md,
    height: MIN_TOUCH + 6, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.emerald, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  backBtn:       { height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm },
  backBtnText:   { color: Colors.textMuted, fontSize: Typography.sm },
  recipientBox:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.slateLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  avatar:        { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.emerald, justifyContent: 'center', alignItems: 'center' },
  avatarText:    { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  recipientName: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  recipientEmail:{ fontSize: Typography.sm, color: Colors.textMuted },
  confirmNote:   { fontSize: Typography.xs, color: Colors.warning, marginBottom: Spacing.md, textAlign: 'center' },
  sendingTo:     { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
});
