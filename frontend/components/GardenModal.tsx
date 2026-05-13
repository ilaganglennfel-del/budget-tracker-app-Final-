import React, { useState } from 'react';
import {
  View, Text, Modal, StyleSheet, ScrollView,
  TouchableOpacity, Animated,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, MIN_TOUCH } from '../theme';
import GlassCard from './GlassCard';

interface Flower {
  id: string;
  flower_type: string;
  is_shiny: boolean;
  earned_at: string;
  streak_value: number;
}

interface GardenModalProps {
  visible:  boolean;
  flowers:  Flower[];
  onClose:  () => void;
}

const FLOWER_META: Record<string, { emoji: string; label: string; color: string }> = {
  rose:      { emoji: '🌹', label: 'Rose',      color: '#EF4444' },
  sunflower: { emoji: '🌻', label: 'Sunflower', color: '#F59E0B' },
  tulip:     { emoji: '🌷', label: 'Tulip',     color: '#EC4899' },
  sakura:    { emoji: '🌸', label: 'Sakura',    color: '#F9A8D4' },
  hibiscus:  { emoji: '🌺', label: 'Hibiscus',  color: '#EF4444' },
  daisy:     { emoji: '🌼', label: 'Daisy',     color: '#FDE68A' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GardenModal({ visible, flowers, onClose }: GardenModalProps) {
  const shiny = flowers.filter(f => f.is_shiny);
  const dim   = flowers.filter(f => !f.is_shiny);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🌸 My Garden</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close garden">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {flowers.length === 0
              ? 'Keep your streak alive to earn flowers!'
              : `${shiny.length} shiny · ${dim.length} faded · ${flowers.length} total`}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {flowers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>Your garden is empty</Text>
                <Text style={styles.emptyText}>
                  Make a Save It deposit for 3 consecutive days to earn your first flower!
                </Text>
              </View>
            ) : (
              <>
                {shiny.length > 0 && (
                  <>
                    <Text style={styles.groupLabel}>✨ Shiny Flowers</Text>
                    <View style={styles.grid}>
                      {shiny.map((flower) => {
                        const meta = FLOWER_META[flower.flower_type] ?? { emoji: '🌸', label: flower.flower_type, color: '#10B981' };
                        return (
                          <View key={flower.id} style={[styles.flowerCard, styles.flowerCardShiny, { borderColor: meta.color + '55' }]}>
                            <View style={[styles.glow, { backgroundColor: meta.color + '22' }]} />
                            <Text style={styles.flowerEmoji}>{meta.emoji}</Text>
                            <Text style={styles.flowerName}>{meta.label}</Text>
                            <Text style={styles.flowerStreak}>🔥 Day {flower.streak_value}</Text>
                            <Text style={styles.flowerDate}>{formatDate(flower.earned_at)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                {dim.length > 0 && (
                  <>
                    <Text style={[styles.groupLabel, { color: Colors.textMuted }]}>🩶 Faded Flowers</Text>
                    <View style={styles.grid}>
                      {dim.map((flower) => {
                        const meta = FLOWER_META[flower.flower_type] ?? { emoji: '🌸', label: flower.flower_type, color: '#6B7280' };
                        return (
                          <View key={flower.id} style={[styles.flowerCard, styles.flowerCardDim]}>
                            <Text style={[styles.flowerEmoji, styles.dimEmoji]}>{meta.emoji}</Text>
                            <Text style={[styles.flowerName, { color: Colors.textMuted }]}>{meta.label}</Text>
                            <Text style={[styles.flowerStreak, { color: Colors.textMuted }]}>Day {flower.streak_value}</Text>
                            <Text style={[styles.flowerDate, { color: Colors.textMuted }]}>{formatDate(flower.earned_at)}</Text>
                            <Text style={styles.dimLabel}>Streak Lost</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#1F2937', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: Spacing.lg, paddingHorizontal: Spacing.md, paddingBottom: 40, maxHeight: '90%' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:            { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  closeBtn:         { width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  closeText:        { fontSize: Typography.xl, color: Colors.textMuted },
  subtitle:         { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.lg },
  groupLabel:       { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.emerald, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  flowerCard:       { width: '46%', borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1, position: 'relative', overflow: 'hidden' },
  flowerCardShiny:  { backgroundColor: 'rgba(16,185,129,0.07)' },
  flowerCardDim:    { backgroundColor: 'rgba(55,65,81,0.5)', borderColor: Colors.border },
  glow:             { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: Radius.lg },
  flowerEmoji:      { fontSize: 44, marginBottom: 4 },
  dimEmoji:         { opacity: 0.35 },
  flowerName:       { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  flowerStreak:     { fontSize: Typography.xs, color: Colors.emerald, marginTop: 2 },
  flowerDate:       { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  dimLabel:         { fontSize: 10, color: Colors.error, marginTop: 4, fontWeight: Typography.semibold },
  empty:            { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji:       { fontSize: 64, marginBottom: Spacing.md },
  emptyTitle:       { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  emptyText:        { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: Spacing.lg },
});
