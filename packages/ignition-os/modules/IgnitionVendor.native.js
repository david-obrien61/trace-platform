/**
 * FILE: IgnitionVendor.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Fulfillment portal view tracking active part bids and orders from external vendors.
 * DEPENDENCIES: react, react-native, lucide-react-native
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Store, PackageOpen, CheckCircle } from 'lucide-react-native';

export default function IgnitionVendor() {
  const orders = [
    { id: 'ORD-882', shop: 'LEANDER FLEET', item: 'TURBOCHARGER', status: 'PICKING', priority: 'HIGH' },
    { id: 'ORD-879', shop: 'AUSTIN DIESEL', item: 'SEAL KIT (x4)', status: 'OUT FOR DEL', priority: 'NORMAL' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>VENDOR FULFILLMENT PORTAL</Text>
      
      <View style={styles.statsRow}>
        <View style={styles.statSquare}>
          <Text style={styles.statVal}>04</Text>
          <Text style={styles.statLab}>ACTIVE BIDS</Text>
        </View>
        <View style={styles.statSquare}>
          <Text style={styles.statVal}>$3.2k</Text>
          <Text style={styles.statLab}>DAILY SALES</Text>
        </View>
      </View>

      <ScrollView>
        {orders.map(o => (
          <TouchableOpacity key={o.id} style={styles.orderCard}>
            <View style={styles.cardHeader}>
              <View style={styles.shopInfo}>
                <Store color="#3b82f6" size={16} />
                <Text style={styles.shopName}>{o.shop}</Text>
              </View>
              <Text style={styles.orderId}>{o.id}</Text>
            </View>
            <Text style={styles.itemText}>{o.item}</Text>
            <View style={styles.footer}>
              <Text style={[styles.statusText, { color: o.status === 'PICKING' ? '#f59e0b' : '#10b981' }]}>
                {o.status}
              </Text>
              <View style={[styles.prioBadge, { backgroundColor: o.priority === 'HIGH' ? '#451a03' : '#0f172a' }]}>
                <Text style={styles.prioText}>{o.priority}</Text>
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
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statSquare: { backgroundColor: '#0f172a', padding: 15, borderRadius: 16, width: '48%', borderWidth: 1, borderColor: '#1e293b' },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statLab: { color: '#475569', fontSize: 8, fontWeight: 'bold', marginTop: 4 },
  orderCard: { backgroundColor: '#0f172a', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  shopInfo: { flexDirection: 'row', alignItems: 'center' },
  shopName: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginLeft: 8 },
  orderId: { color: '#475569', fontSize: 10, fontWeight: 'bold' },
  itemText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  prioBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  prioText: { color: '#f59e0b', fontSize: 8, fontWeight: '900' }
});