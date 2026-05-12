import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/Toast';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../../theme';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading }    = useAuthStore();
  const { showError, showToast } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showToast('Please enter your email and password.', 'error');
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (err) {
      showError(err);
    }
  };

  return (
    <LinearGradient colors={[Colors.bgDark, Colors.slateMid]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area */}
          <View style={styles.header}>
            <Text style={styles.logo}>💸</Text>
            <Text style={styles.appName}>BudgetTracker</Text>
            <Text style={styles.tagline}>Your money. Your goals.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                accessibilityLabel="Password"
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {isLoading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity accessibilityRole="link">
                  <Text style={styles.link}>Create one</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient:    { flex: 1 },
  container:   { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  header:      { alignItems: 'center', marginBottom: Spacing.xl },
  logo:        { fontSize: 64 },
  appName:     { fontSize: Typography.xxxl, fontWeight: Typography.extrabold, color: Colors.emerald, marginTop: Spacing.sm },
  tagline:     { fontSize: Typography.base, color: Colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
  },
  title:       { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  subtitle:    { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4, marginBottom: Spacing.lg },
  inputGroup:  { marginBottom: Spacing.md },
  label:       { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium, marginBottom: 6 },
  input: {
    backgroundColor: Colors.slateLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: MIN_TOUCH + 6,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btn: {
    backgroundColor: Colors.emerald,
    borderRadius: Radius.md,
    height: MIN_TOUCH + 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  footer:      { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText:  { color: Colors.textMuted, fontSize: Typography.sm },
  link:        { color: Colors.emerald, fontSize: Typography.sm, fontWeight: Typography.semibold },
});
