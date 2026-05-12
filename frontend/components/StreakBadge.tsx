import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

type BadgeLevel = 'seedling' | 'sprout' | 'plant' | 'tree';

const BADGE_CONFIG: Record<BadgeLevel, { emoji: string; label: string; color: string; next?: string }> = {
  seedling: { emoji: '🌱', label: 'Seedling',  color: '#6EE7B7', next: '5-day streak for Sprout' },
  sprout:   { emoji: '🌿', label: 'Sprout',    color: '#10B981', next: '10-day streak for Plant' },
  plant:    { emoji: '🪴', label: 'Plant',     color: '#059669', next: '15-day streak for Tree' },
  tree:     { emoji: '🌳', label: 'Tree',      color: '#065F46', next: undefined },
};

interface StreakBadgeProps {
  level:          BadgeLevel;
  streak:         number;
  longestStreak?: number;
  compact?:       boolean;
}

export default function StreakBadge({ level, streak, longestStreak, compact }: StreakBadgeProps) {
  const config = BADGE_CONFIG[level] ?? BADGE_CONFIG.seedling;

  if (compact) {
    return (
      <View style={[styles.compact, { borderColor: config.color }]}>
        <Text style={styles.compactEmoji}>{config.emoji}</Text>
        <Text style={[styles.compactStreak, { color: config.color }]}>{streak}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{config.emoji}</Text>
      <View style={styles.info}>
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.streak}>
          {streak} day{streak !== 1 ? 's' : ''} streak
        </Text>
        {longestStreak !== undefined && (
          <Text style={styles.longest}>Best: {longestStreak} days</Text>
        )}
        {config.next && (
          <Text style={styles.next}>{config.next}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 48,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  streak: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.semibold,
  },
  longest: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  next: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // Compact
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compactEmoji: {
    fontSize: 16,
  },
  compactStreak: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
});
