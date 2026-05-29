/**
 * FILE: InventoryAI.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: AI stock prediction banner showing low stock alerts and inventory velocity.
 * DEPENDENCIES: react, react-native, lucide-react-native
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap, PackageCheck } from 'lucide-react-native';

export default function InventoryAI() {
  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>88%</Text>
          <Text style={styles.statLab}>STOCK ACCURACY</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>12</Text>
          <Text style={styles.statLab}>LOW STOCK ALERTS</Text>
        </View>
      </View>
      <View style={styles.alertCard}>
        <Zap color="#6366f1" size={20} />
        <View style={{marginLeft: 15}}>
          <Text style={styles.alertTitle}>AI PREDICTION</Text>
          <Text style={styles.alertDesc}>Diesel filters expected to deplete by Thursday based on current bay velocity.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, width: '48%', alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statLab: { color: '#475569', fontSize: 8, fontWeight: 'bold', marginTop: 5 },
  alertCard: { backgroundColor: '#1e1b4b', padding: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#312e81' },
  alertTitle: { color: '#818cf8', fontWeight: 'bold', fontSize: 12 },
  alertDesc: { color: '#a5b4fc', fontSize: 11, marginTop: 4, lineHeight: 16 }
});