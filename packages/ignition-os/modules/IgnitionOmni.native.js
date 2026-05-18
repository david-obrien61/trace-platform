/**
 * FILE: IgnitionOmni.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Mobile dashboard displaying shop-wide vital signs, financials, and active bay rosters.
 * DEPENDENCIES: react, react-native, lucide-react-native
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react-native';

export default function IgnitionOmni({ shopData = [] }) {
  // Aggregate data safely with fallbacks to prevent NaN or undefined crashes
  const totalGhost = shopData.reduce((acc, curr) => {
    const sell = curr?.sell || 0;
    const cost = curr?.cost || 0;
    return acc + (sell - cost);
  }, 0);
  
  const efficiency = 94; // This would eventually tie to BayVelocity

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>SHOP-WIDE VITAL SIGNS</Text>
      
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <DollarSign color="#10b981" size={20} />
          <Text style={styles.metricVal}>${totalGhost}</Text>
          <Text style={styles.metricLab}>GHOST RECOVERY</Text>
        </View>
        <View style={styles.metricCard}>
          <Activity color="#3b82f6" size={20} />
          <Text style={styles.metricVal}>{efficiency}%</Text>
          <Text style={styles.metricLab}>BAY VELOCITY</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>ACTIVE BAY ROSTER</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {['BAY 1 (Diesel)', 'BAY 2 (Fleet)', 'BAY 3 (Triage)'].map((bay, i) => (
          <View key={i} style={styles.bayRow}>
            <View>
              <Text style={styles.bayTitle}>{bay}</Text>
              <Text style={styles.baySub}>TECH: T. OBRIEN</Text>
            </View>
            <View style={styles.statusIndicator}>
              <View style={styles.pulse} />
              <Text style={styles.statusText}>ACTIVE</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionLabel: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  metricCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, width: '48%', borderWidth: 1, borderColor: '#1e293b' },
  metricVal: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 10 },
  metricLab: { color: '#475569', fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  bayRow: { backgroundColor: '#0f172a', padding: 18, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  bayTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  baySub: { color: '#475569', fontSize: 9, marginTop: 2 },
  statusIndicator: { flexDirection: 'row', alignItems: 'center' },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 8 },
  statusText: { color: '#10b981', fontSize: 9, fontWeight: '900' }
});