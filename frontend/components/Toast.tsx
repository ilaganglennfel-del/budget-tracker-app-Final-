import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Platform,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

// ── Error code → friendly message map ────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: "You don't have enough funds for this transfer.",
  USER_NOT_FOUND:     'No account found with that email.',
  AUTH_EXPIRED:       'Your session expired. Please log in again.',
  DB_TIMEOUT:         'Server is busy. Please try again in a moment.',
  VALIDATION_ERROR:   'Please check your inputs and try again.',
  CONFLICT:           'An account with this email already exists.',
  RATE_LIMITED:       'Too many attempts. Please wait a moment.',
  INTERNAL_ERROR:     'Something went wrong. Please try again.',
};

export function getToastMessage(error: any): { message: string; type: 'error' | 'success' | 'info' } {
  const code = error?.response?.data?.error?.code || error?.code;
  if (code && ERROR_MESSAGES[code]) {
    return { message: ERROR_MESSAGES[code], type: 'error' };
  }
  const msg = error?.response?.data?.error?.message || error?.message || 'An unexpected error occurred.';
  return { message: msg, type: 'error' };
}

// ── Toast types ───────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showError: (error: any) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  showError: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Single Toast component ────────────────────────────────────
function ToastItem({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const opacity     = useRef(new Animated.Value(0)).current;
  const translateY  = useRef(new Animated.Value(-20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80 }),
      Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(onDone);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const bgColor =
    item.type === 'success' ? Colors.emerald :
    item.type === 'error'   ? Colors.error   : Colors.info;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <Text style={styles.toastText} numberOfLines={3}>{item.message}</Text>
    </Animated.View>
  );
}

// ── Provider ──────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
  }, []);

  const showError = useCallback((error: any) => {
    const { message, type } = getToastMessage(error);
    showToast(message, type);
  }, [showToast]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showError }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDone={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  toast: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    lineHeight: 20,
  },
});
