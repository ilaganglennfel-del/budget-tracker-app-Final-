import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius } from '../theme';

interface SkeletonProps {
  width?:  number | string;
  height?: number;
  radius?: number;
  style?:  StyleProp<ViewStyle>;
}

/**
 * Shimmer skeleton placeholder for loading states.
 */
export function Skeleton({ width = '100%', height = 20, radius = 8, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: Colors.slateLight, opacity },
        style,
      ]}
    />
  );
}

/**
 * A full transaction row skeleton card.
 */
export function TransactionSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={styles.rowContent}>
        <Skeleton width="60%" height={14} radius={6} />
        <Skeleton width="40%" height={11} radius={6} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={70} height={14} radius={6} />
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TransactionSkeleton key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
});
