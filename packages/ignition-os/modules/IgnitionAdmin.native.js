/**
 * FILE: IgnitionAdmin.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Mobile terminal admin screen for emergency lockouts and toggling modules.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function IgnitionAdmin({ registry, onToggle, onLockout }) {
  // Convert the registry object into an array so we can map over it
  const modules = Object.values(registry);

  const handleToggle = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(id);
  };

  const handleLockout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    onLockout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ShieldCheck color="#3b82f6" size={32} />
        <Text style={styles.title}>Terminal Admin</Text>
      </View>

      <TouchableOpacity style={styles.lockoutBtn} onPress={handleLockout}>
        <ShieldAlert color="#fff" size={24} />
        <Text style={styles.lockoutText}>TRIGGER SYSTEM LOCKOUT</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>MODULE REGISTRY TOGGLES</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {modules.map(mod => (
          <View key={mod.id} style={styles.modRow}>
            <View style={styles.modInfo}>
              <Text style={styles.modName}>{mod.label}</Text>
              <Text style={styles.modId}>ID: {mod.id}</Text>
            </View>
            <Switch 
              value={mod.active} 
              onValueChange={() => handleToggle(mod.id)} 
              trackColor={{ false: '#1e293b', true: '#10b981' }}
              thumbColor="#fff"
            />
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#020617' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, gap: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  lockoutBtn: { backgroundColor: '#ef4444', padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 30, shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  lockoutText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  sectionTitle: { color: '#475569', fontSize: 12, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
  scroll: { flex: 1 },
  modRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 20, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  modInfo: { flex: 1 },
  modName: { color: '#f8fafc', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  modId: { color: '#64748b', fontSize: 10, marginTop: 4, textTransform: 'uppercase', fontWeight: 'bold' }
});