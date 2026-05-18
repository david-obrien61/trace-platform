/**
 * FILE: TriageOptimizer.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Triage and route optimizer list displaying dispatch events and distances.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Navigation, MapPin, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function TriageOptimizer({ currentJobLocation }) {
  // Mocking the North Austin / Leander proximity logic
  const dispatchEvents = [
    { id: 1, type: 'BREAKDOWN', location: 'Hwy 183 & Hero Way', dist: '4.2 mi', urgency: 'HIGH' },
    { id: 2, type: 'PARTS PICKUP', location: 'Cedar Park Supply', dist: '8.1 mi', urgency: 'LOW' }
  ];

  const handleRoute = (loc) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    alert(`Routing to ${loc} via System Optimizer`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AlertTriangle color="#ef4444" size={14} />
        <Text style={styles.headerText}>TRIAGE & ROUTE OPTIMIZER</Text>
      </View>

      {dispatchEvents.map(event => (
        <TouchableOpacity 
          key={event.id} 
          style={[styles.card, event.urgency === 'HIGH' && styles.highUrgency]}
          onPress={() => handleRoute(event.location)}
        >
          <View>
            <Text style={styles.typeText}>{event.type}</Text>
            <View style={styles.locRow}>
              <MapPin color="#64748b" size={12} />
              <Text style={styles.locText}>{event.location}</Text>
            </View>
          </View>
          <View style={styles.distBadge}>
            <Navigation color="#ffffff" size={12} />
            <Text style={styles.distText}>{event.dist}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 15 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headerText: { color: '#ef4444', fontSize: 9, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },
  card: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  highUrgency: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  typeText: { color: '#f8fafc', fontSize: 11, fontWeight: 'bold' },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locText: { color: '#64748b', fontSize: 10, marginLeft: 4 },
  distBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center' },
  distText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }
});