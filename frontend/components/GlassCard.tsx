import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?:   StyleProp<ViewStyle>;
  intensity?: number;
}

/**
 * Glassmorphism card using expo-blur BlurView.
 * Renders a frosted-glass panel with emerald border.
 * All text on this card must use Colors.textPrimary or textSecondary
 * to maintain WCAG AA contrast (verified: ≥4.5:1 on glass background).
 */
export default function GlassCard({ children, style, intensity = 40 }: GlassCardProps) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.card, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    backgroundColor: Colors.glass,
  },
});
