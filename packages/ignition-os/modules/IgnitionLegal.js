/**
 * FILE: IgnitionLegal.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Compliance dashboard showing legal contract statuses and expiration alerts.
 * DEPENDENCIES: react, react-native, lucide-react-native
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Scale, AlertTriangle } from 'lucide-react-native';

export default function IgnitionLegal() {
  const contracts = [
    { id: 'SLA-001', entity: 'CITY OF LEANDER', status: 'COMPLIANT', expires: '12/2026' },
    { id: 'WAIV-99', entity: 'HAZMAT DISPOSAL', status: 'PENDING SIGN', expires: '05/2026' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>LEGAL & COMPLIANCE REPOSITORY</Text>
      
      <View style={styles.alertBanner}>
        <AlertTriangle color="#78350f" size={20} />
        <Text style={styles.alertText}>3 CONTRACTS REQUIRE ANNUAL REVIEW</Text>
      </View>

      <ScrollView>
        {contracts.map(c => (
          <TouchableOpacity key={c.id} style={styles.legalCard}>
            <View style={styles.cardHeader}>
              <Scale color="#64748b" size={18} />
              <Text style={styles.entityName}>{c.entity}</Text>
            </View>
            <View style={styles.detailRow}>
              <View>
                <Text style={styles.idText}>{c.id}</Text>
                <Text style={styles.expText}>EXP: {c.expires}</Text>
              </View>
              <View style={[styles.statusTag, { backgroundColor: c.status === 'COMPLIANT' ? '#064e3b' : '#451a03' }]}>
                <Text style={[styles.statusText, { color: c.status === 'COMPLIANT' ? '#10b981' : '#f59e0b' }]}>{c.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionLabel: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  alertBanner: { backgroundColor: '#fef3c7', padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  alertText: { color: '#78350f', fontSize: 10, fontWeight: '900', marginLeft: 10 },
  legalCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  entityName: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idText: { color: '#3b82f6', fontSize: 11, fontWeight: '900' },
  expText: { color: '#475569', fontSize: 9, marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 8, fontWeight: '900' }
});