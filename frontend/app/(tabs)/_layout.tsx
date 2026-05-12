import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Typography } from '../../theme';

interface TabIconProps {
  emoji:   string;
  label:   string;
  focused: boolean;
}

function TabIcon({ emoji, label, focused }: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transfers"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💸" label="Transfers" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎯" label="Goals" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.slate,
    borderTopColor:  Colors.glassBorder,
    borderTopWidth:  1,
    height:          Platform.OS === 'ios' ? 85 : 65,
    paddingBottom:   Platform.OS === 'ios' ? 20 : 8,
    paddingTop:      8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 44,
  },
  emoji: {
    fontSize: 22,
  },
  label: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: Typography.medium,
  },
  labelActive: {
    color: Colors.emerald,
    fontWeight: Typography.semibold,
  },
});
